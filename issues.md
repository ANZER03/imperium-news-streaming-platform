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
