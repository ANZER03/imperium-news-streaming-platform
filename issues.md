# Known Issues & Lessons Learned

Issues encountered during the Avro migration of the processing layer (May 2026).

---

## Issue 1 — Avro schema type mismatch: `INT` vs `LONG` for ID fields

**Files affected:**
- `apps/processing/news-pipeline/resources/schema/canonical_article_v1.avsc`
- `apps/processing/news-pipeline/resources/schema/classified_article_v1.avsc`

**Symptom:**
```
IncompatibleSchemaException: Cannot convert SQL field 'source_news_id' to Avro field
'source_news_id' because schema is incompatible (sqlType = INT, avroType = "long")
```

**Root cause:**
The Avro schemas declared `source_news_id`, `link_id`, and `authority_id` as `["null", "long"]`.
The actual values coming from the PostgreSQL CDC (Debezium) are 32-bit integers — Spark infers
them as `INT`, not `BIGINT`. Avro's `to_avro()` refuses to silently widen int → long.

**Fix:**
Change those three fields to `["null", "int"]` in both schema files.

**Rule going forward:**
When writing an Avro schema by hand, verify the actual Spark SQL type of each field first:
```python
df.printSchema()  # or spark.sql("SELECT typeof(source_news_id) FROM ...").show()
```
Never assume IDs are `long` just because they could grow. Match what the source actually produces.

---

## Issue 2 — Non-nullable Avro array field receives `null` at runtime

**Files affected:**
- `apps/processing/news-pipeline/jobs/enrichment/driver.py` — `missing_dimensions`

**Symptom:**
```
NullPointerException: null value for (non-nullable) List<string> at CanonicalArticle.missing_dimensions
```

**Root cause:**
The Avro schema declares `missing_dimensions` as a non-nullable array (`{"type":"array","items":"string"}`)
with `"default": []`. Avro's default only applies during *deserialization* when the field is absent —
it does **not** substitute nulls during *serialization*. If the Spark column is `null`, Avro writes
fail at the executor with a NPE.

The column was computed via `array_remove(array(...), NULL)` which returns `null` (not `[]`) when
the input array itself is all-null on certain CDC rows.

**Fix:**
Wrap every non-nullable Avro array field with `coalesce(..., array())` in the `struct()` before
passing to `to_avro()`:
```python
expr("coalesce(missing_dimensions, array())").alias("missing_dimensions")
```

**Rule going forward:**
Any Avro field declared as a bare `array` (non-nullable) must be guarded with `coalesce(..., array())`
on the write side. Same applies to `embedding_vector` and `topic_candidates` in the classified schema —
both are already guarded in `phase3_classification_runtime.py`.

---

## Issue 3 — Schema Registry retains subjects after topic deletion

**Symptom:**
```
HTTP 409 — Schema being registered is incompatible with an earlier schema for subject
"imperium.canonical-articles-value"
```
This happened after fixing Issue 1 (changing `long` → `int`) and restarting the driver.
The topic was deleted and recreated, but the Schema Registry still held the old version.

**Root cause:**
Kafka topic deletion and Schema Registry subject deletion are **independent operations**.
Deleting a topic does not remove its Schema Registry subjects. On restart, the driver tried to
register the corrected schema, but the registry rejected it as backward-incompatible with the
stored (wrong) v1.

**Fix:**
Explicitly delete the subject from the registry before restarting after a schema change:
```bash
# From inside Docker network (most reliable):
docker exec -i imperium-schema-registry \
  curl -fsS -X DELETE "http://schema-registry:8081/subjects/<subject-name>"
docker exec -i imperium-schema-registry \
  curl -fsS -X DELETE "http://schema-registry:8081/subjects/<subject-name>?permanent=true"
```
Note: soft-delete alone is not enough — use `?permanent=true` to fully purge.

**Rule going forward:**
The `processing-clean.sh --from-enrichment` script must also delete Schema Registry subjects
for `imperium.canonical-articles-value` and `imperium.news.classified-value`. Add this to the
script so a clean run never requires a manual registry purge.

Subjects to delete on a `--from-enrichment` clean:
- `imperium.canonical-articles-value`
- `imperium.news.classified-value`

---

## Issue 4 — Schema Registry port not reachable from host

**Symptom:**
`curl: (7) Failed to connect to localhost port 8081 after 0 ms: Connection refused`

**Root cause:**
The Schema Registry is mapped to an external port (`48081`), not `8081`.
All admin `curl` commands against the registry must use `localhost:48081` from the host,
or `schema-registry:8081` from inside the Docker network.

**Fix:**
Use the container-internal address for admin operations to avoid port mapping confusion:
```bash
docker exec -i imperium-schema-registry curl -fsS http://schema-registry:8081/subjects
```

---

## Issue 5 — Spark Structured Streaming checkpoint persists in a named Docker volume

**Symptom:**
After flushing Redis and force-recreating the enrichment driver container, Spark logs:
```
Resuming at batch 115 with committed offsets {"imperium.news.public.table_news":{"0":571251}}
```
The driver does not replay from offset 0 despite `startingOffsets=earliest`.

**Root cause:**
The checkpoint directory (`/tmp/imperium/checkpoints/processing`) is mounted from a named Docker
volume (`imperium-processing-checkpoints`). `--force-recreate` destroys the container but the
volume survives. Spark finds the checkpoint on startup and ignores `startingOffsets` entirely —
that option is only respected when **no checkpoint exists**.

Clearing `/tmp` inside containers (spark-master, spark-worker-*) has no effect because the
checkpoint lives in the driver container's volume, not on the workers.

**Fix:**
Clear the named volume directly using a throwaway alpine container:
```bash
docker run --rm -v imperium-processing-checkpoints:/data alpine sh -c "rm -rf /data/*"
```
Do this for all Spark volumes before restarting:
- `imperium-processing-checkpoints`
- `imperium-spark-events`
- `imperium-spark-master-data`
- `imperium-spark-worker-{1,2,3}-data`

**Rule going forward:**
`make processing-fresh-reset` now handles all of this automatically. Never restart a Spark
Structured Streaming driver expecting a clean replay without first clearing the checkpoint volume.

---

## Issue 6 — Projector Docker image bakes code at build time (no bind mount)

**Symptom:**
Editing `redis_projector.py` on the host had no effect on the running container. The container
reported `TTL_SECONDS: 1036800` (12 days) despite the file showing `7 * 24 * 60 * 60`.

**Root cause:**
The projector containers (`imperium-redis-projector`, `imperium-postgres-projector`,
`imperium-qdrant-projector`) have **no volume mounts** — their code is baked into the Docker image
at build time via `COPY`. Unlike the Spark driver containers (which bind-mount the source tree),
projector code changes require an explicit `docker-compose build` before taking effect.

**Fix:**
Always rebuild before recreating a projector after a code change:
```bash
docker-compose --env-file .env --profile processing ... build imperium-redis-projector
docker-compose --env-file .env --profile processing ... up -d --force-recreate --no-deps imperium-redis-projector
```

**Rule going forward:**
Spark driver containers → code changes are live immediately (bind mount).
Projector containers → must rebuild image first.

---

## Issue 7 — Kafka consumer group must be deleted AFTER the container stops

**Symptom:**
```
GroupNotEmptyException: The group is not empty.
```
Running `kafka-consumer-groups --delete` immediately after `docker rm -f` failed because the
Kafka broker still had the consumer registered (heartbeat timeout not yet elapsed).

**Fix:**
Poll until the delete succeeds:
```bash
until docker exec imperium-kafka-1 kafka-consumer-groups \
  --bootstrap-server imperium-kafka-1:29092 \
  --delete --group <group-id> 2>&1 | grep -qE "successful|does not exist"; do
  sleep 2
done
```

**Rule going forward:**
`make processing-fresh-reset` handles this with the poll loop. When doing manual resets, always
stop the container first and wait before deleting the group.

---

## Issue 8 — Versioned consumer group ID hidden in `.env`

**Symptom:**
Attempting to delete `imperium-redis-projector-group` and `imperium-redis-projector-group-v2`
both failed with `GroupIdNotFoundException`. The actual active group was
`imperium-redis-projector-group-v18` (set via `PHASE3_REDIS_PROJECTOR_GROUP_ID` in `.env`).

**Root cause:**
The `redis-projector-reset` Makefile target bumps the group ID version on every run and writes
it to `.env`. The actual group ID in use diverges from the hardcoded default in the source code.

**Fix:**
Always check the real group ID before deleting:
```bash
docker exec imperium-kafka-1 kafka-consumer-groups \
  --bootstrap-server imperium-kafka-1:29092 --list
```

**Rule going forward:**
`processing-fresh-reset.sh` now lists all groups and deletes any matching the processing pattern
(`imperium-(redis|postgres|qdrant)-projector|canonical|classification|enrichment|phase3`)
regardless of version suffix.

---

## Issue 9 — ZSet topic feeds appear empty due to immediate score-based pruning

**Symptom:**
`feed:topic:sports` had 0 entries despite 62K classified messages being consumed with lag=0.
Classified messages confirmed to have correct `root_topic_id` values (health, sports, etc.).

**Root cause:**
The projector adds article IDs to topic ZSets scored by `published_at` timestamp, then immediately
calls `zremrangebyscore(zset, "-inf", cutoff_score)` in the same pipeline. Articles published more
than 7 days ago have a score below the cutoff and are pruned in the same pipeline execution —
they are added and removed atomically.

128K out of 596K articles in Postgres had `published_at` older than 7 days, confirming this.
`feed:global` (467K entries) vs topic feeds (13 entries total) confirmed the pruning was working
correctly — topic feeds only contain articles classified AND published within the 7-day window.

**Rule going forward:**
Empty topic feeds after a fresh replay are expected if most articles are older than the TTL window.
Topic feeds fill up naturally as the classification driver catches up to recent articles.
Check `feed:global` count to confirm the projector is working — it should match recent articles in Postgres.

---

## Issue 10 — `VARCHAR(255)` truncation on real news data

**Symptom:**
```
StringDataRightTruncation: value too long for type character varying(255)
```
Postgres projector crash-looped immediately after receiving canonical records.

**Root cause:**
The `imperium_news_articles` DDL used `VARCHAR(255)` for fields like `reporter`, `source_name`,
`source_date_text`, `country_name`, etc. Real production news data regularly exceeds 255 characters
in these fields (long reporter by-lines, verbose date strings, full source names).

**Fix:**
Changed all unconstrained `VARCHAR(255)` columns to `TEXT` in the schema. The `processing-fresh-reset`
script now drops and recreates the table with the correct all-TEXT schema on every fresh reset.

**Rule going forward:**
Use `TEXT` for all free-form string fields. Only use `VARCHAR(n)` when there is a hard domain
constraint on the length (e.g., `language_code VARCHAR(10)`).

---

## Issue 11 — `processed_at` Avro type mismatch: string vs long

**Symptom:**
Classification driver crashed with schema incompatibility on `processed_at` field.

**Root cause:**
`classified_article_v1.avsc` declared `processed_at` as `["null", "string"]`. Spark infers
`processed_at` from the canonical Avro (epoch-millis `BIGINT`) as `LongType`, not `StringType`.
Avro's `to_avro()` refused to serialize a long into a string field.

**Fix:**
Changed `classified_article_v1.avsc` line for `processed_at` to `["null", "long"]`.
Purged the Schema Registry subject (`imperium.news.classified-value`) before restarting.

**Rule going forward:**
Any timestamp field carried through from the canonical Avro will be `long` (epoch millis/micros).
Never declare it as `string` in a downstream schema.

---

## Issue 12 — Qdrant: duplicate field `max_segment_size` on startup

**Files affected:**
- `compose/serving.yml`

**Symptom:**
```
Error: duplicate field `max_segment_size` for key `storage.optimizers`
```
Qdrant failed to start after a `docker-compose up`.

**Root cause:**
The env var `QDRANT__STORAGE__OPTIMIZERS__MAX_SEGMENT_SIZE` used the old field name. Newer Qdrant
versions renamed this field to `max_segment_size_kb`. When both the env var (old name) and the
internal default config (new name) were present, Qdrant's config deserializer saw both as the same
field and raised a duplicate error.

Additionally, setting the value to `"0"` (previously used to disable the limit) is no longer valid
in Qdrant 1.x — it must be 1 or larger, or omitted entirely to let Qdrant auto-select.

**Fix:**
Removed `QDRANT__STORAGE__OPTIMIZERS__MAX_SEGMENT_SIZE` from `compose/serving.yml` entirely.
Omitting it lets Qdrant auto-select the segment size based on available CPUs, which is the correct
default behavior.

**Rule going forward:**
When upgrading Qdrant, check for renamed config fields. The env var naming convention maps directly
to the config file keys (`QDRANT__SECTION__FIELD` → `section.field`). If a field is renamed in the
config, the corresponding env var name must be updated to match.

---

## Issue 13 — CDC news connector fails with `RecordTooLargeException` on large articles

**Files affected:**
- `apps/ingestion/connector-bootstrap/news/news-connector.json`

**Symptom:**
```
ConnectException: Unrecoverable exception from producer send callback
Caused by: RecordTooLargeException: The message is 1113754 bytes when serialized
which is larger than 1048576, which is the value of the max.request.size configuration.
```
The `imperium-news-cdc` connector task went `FAILED`. New articles cloned from prod stopped
arriving in Kafka.

**Root cause:**
Some production `table_news` rows have very large `more_source_html` or body fields. When
Debezium serializes them as Avro, the resulting Kafka message exceeds the Kafka producer's
default `max.request.size` of 1 MB (1,048,576 bytes). The connector has no producer override
configured, so it uses the default limit.

**Fix:**
Added producer overrides to the connector config via REST API (live) and in the template
(permanent):
```json
"producer.override.max.request.size": "2097152",
"producer.override.max.block.ms": "60000"
```
Then restarted the failed task:
```bash
curl -X POST http://localhost:48083/connectors/imperium-news-cdc/tasks/0/restart
```

**Rule going forward:**
Any CDC connector sourcing tables with unbounded text columns (`more_source_html`, body, HTML)
must set `producer.override.max.request.size` to at least `2097152` (2 MB). The Kafka topic
`max.message.bytes` should match (already set to `2097152` on `imperium.news.classified`).

---

## Issue 14 — Postgres projector connects to `postgres-source` (stale image with old env var)

**Files affected:**
- `apps/processing/news-pipeline/jobs/projections/postgres_projector.py`
- `compose/projectors.yml`

**Symptom:**
```
WARNING PostgresProjector: Waiting for Postgres... ([Errno -3] Temporary failure in name resolution)
```
The postgres projector looped indefinitely on startup despite `news-source-db` being reachable
from the same network. `docker exec` into the container could connect fine.

**Root cause:**
The projector image was stale — built before the `PHASE3_` prefix removal. The code read
`os.environ.get("PHASE3_POSTGRES_DSN", "postgresql://...@postgres-source:5432/...")`. The compose
env sets `POSTGRES_DSN` (without prefix), so the code fell back to the hardcoded default DSN
pointing at `postgres-source` — the old hostname that no longer exists.

**Fix:**
Rebuilt the projector image to pick up the updated `postgres_projector.py` which reads
`POSTGRES_DSN` (no prefix):
```bash
docker-compose ... up -d --build --no-deps imperium-postgres-projector
```

**Rule going forward:**
Projector code changes are **not** live-reloaded — they are baked into the image at build time
(see Issue 6). Any env var rename or code change requires an explicit `--build`. After the
`PHASE3_` prefix removal, all projector and driver images must be rebuilt before they pick up the
new variable names.

---

## Issue 15 — Docker build context too large for clone-news container (~400 MB)

**Files affected:**
- `compose/source.yml`
- `infrastructure/docker/clone-news/Dockerfile`

**Symptom:**
`docker-compose up --build` for the `clone-news` service sent the entire project root (~400 MB)
to the Docker daemon before starting the build, causing very slow rebuilds.

**Root cause:**
The compose build context was set to `..` (project root) and no `.dockerignore` existed. The
Dockerfile only copies a single docker CLI binary — it does not `COPY` any project files — but
Docker still transfers the full context before evaluating what is needed.

**Fix:**
1. Changed `context: ..` to `context: ../infrastructure/docker/clone-news` in `compose/source.yml`
   so the build context is just the 3-file Dockerfile directory (~333 bytes).
2. Added `infrastructure/docker/clone-news/.dockerignore` with `**` as a safety net.

**Rule going forward:**
Set `context:` to the smallest directory that contains everything the Dockerfile `COPY`s.
For images that only install binaries from other images (multi-stage `COPY --from`), the context
should be just the Dockerfile directory — it needs no source files at all.
