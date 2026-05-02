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
