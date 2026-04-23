# Temp PostgreSQL Sink Validation

## Goal

Validate Kafka topic to sink connector to PostgreSQL flow by writing selected
columns from CDC topics into a temporary PostgreSQL database.

## Sink design

- Sink target: temporary PostgreSQL container on `imperium-net`
- Sink connector class: `io.debezium.connector.jdbc.JdbcSinkConnector`
- Projection strategy: sink-side SMT chain
  - `ExtractNewRecordState` unwraps Debezium envelopes
  - `ReplaceField` keeps only selected business columns
- Primary key strategy: `primary.key.mode=record_key` with `id`
- Table strategy: one sink connector per topic with a fixed destination table
  using `table.name.format` because the running Debezium JDBC sink is `2.3.4`
- Replay strategy:
  - reference topics use `earliest` because they are bounded and small
  - metadata and news use `latest` to avoid replaying large historical topics in the temp test database

## Selected columns

- `table_pays` -> `id, pays, abr`
- `table_langue` -> `id, langue, abr`
- `table_rubrique` -> `id, sedition_id, rubrique`
- `table_sedition` -> `id, support_id, langue_id, media_id, pays_id, sedition`
- `table_authority` -> `id, authority, domain, link, news, pub, rss, actif, pays_id, added_in`
- `table_links` -> `id, link, authority_id, title, langue_id, theme_id, rubrique_id, pays_id, news, rss, actif, lastchecked`
- `table_news` -> `id, added_in, link_id, authority_id, rubrique_id, langue_id, more_title, more_url, pubdate, crawl_date, valide, indexed`

## Files

- Sink connector templates: `apps/ingestion/sink-templates/temp-postgres/`
- Temp sink schema: `infrastructure/postgres/initdb/05_temp_sink_tables.sql`
- Temp database bootstrap: `scripts/setup-temp-sink-db.sh`
- Sink registration: `scripts/register-temp-sink-connectors.sh`

## Reference docs used

- Debezium JDBC sink connector docs:
  https://debezium.io/documentation/reference/3.4/connectors/jdbc.html
- Debezium event flattening SMT docs:
  https://debezium.io/documentation/reference/stable/transformations/event-flattening.html
- Kafka Connect `ReplaceField` SMT docs:
  https://kafka.apache.org/37/kafka-connect/user-guide/

## Validation notes

### Temp DB creation

- Created temporary PostgreSQL container: `imperium-sink-test-db`
- Network: `imperium-net`
- Database: `imperium_sink_test`
- User: `sink_user`
- Port mapping: `35433 -> 5432`
- Applied reduced-column schema from
  `infrastructure/postgres/initdb/05_temp_sink_tables.sql`

### Connector registration

Registered sink connectors:

- `imperium-temp-sink-ref-pays`
- `imperium-temp-sink-ref-langue`
- `imperium-temp-sink-ref-rubrique`
- `imperium-temp-sink-ref-sedition`
- `imperium-temp-sink-meta-authority`
- `imperium-temp-sink-meta-links`
- `imperium-temp-sink-news`

Observed connector state after registration:

- all seven sink connectors reached `RUNNING`
- reference topics used `earliest`
- metadata and news used `latest`

### Verification results

Reference sink counts observed during validation:

- `sink_ref_pays = 260`
- `sink_ref_langue = 186`
- `sink_ref_rubrique = 20573` and still increasing at last check
- `sink_ref_sedition = 19938` and still increasing at last check

Mutable sink verification used live source inserts after connector startup:

- inserted authority test row:
  - `authority = codex-temp-authority`
- inserted links test row:
  - `title = Codex temp sink link`
- inserted news test row:
  - `more_title = Codex temp sink news`

Rows verified in the temp PostgreSQL sink:

- `sink_meta_authority = 1`
- `sink_meta_links = 1`
- `sink_news = 1`

### Issues encountered

1. `string.Template` treated `ReplaceField$Value` as a template placeholder.
   - Symptom: sink registration script failed with `KeyError: 'Value'`.
   - Fix: escaped the SMT class suffix as `ReplaceField$$Value` in the JSON templates.

2. Debezium JDBC sink version mismatch on table naming.
   - Symptom: connectors tried to write to tables like
     `imperium_reference_public_table_pays` even though explicit target tables
     already existed.
   - Cause: the running connector is Debezium `2.3.4.Final`, which uses
     `table.name.format`; newer documentation uses `collection.name.format`.
   - Fix: switched all sink templates to `table.name.format`.

3. Large mutable topics are not practical for a temp verification replay.
   - Symptom: full historical metadata replay would require consuming millions
     of records into the temporary sink database.
   - Fix: used `consumer.override.auto.offset.reset=latest` for metadata and
     news, then inserted controlled source rows to verify live topic -> sink ->
     temp DB flow.

### Outcome

The sink path is working:

- reference topics are actively loading into the temporary PostgreSQL target
- metadata and news live changes are successfully written into the temporary
  PostgreSQL target with selected columns only
- no commit was created for this sink work
