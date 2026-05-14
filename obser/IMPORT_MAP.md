## Donor Mapping

Spring observability assets were imported from `/home/anouar.zerrik/projects/pfe/obs-clickhouse` before adaptation.

| Donor path | Target path | Purpose |
| --- | --- | --- |
| `otel/otel-javaagent.jar` | `obser/otel/otel-javaagent.jar` | Java auto-instrumentation for the Spring app |
| `otel-collector-config.yaml` | `obser/otel-collector-config.yaml` | OTEL Collector baseline config |
| `grafana/provisioning/datasources/clickhouse.yaml` | `obser/grafana/provisioning/datasources/clickhouse.yaml` | Grafana ClickHouse datasource provisioning |
| `grafana/provisioning/dashboards/provider.yaml` | `obser/grafana/provisioning/dashboards/provider.yaml` | Grafana dashboard provisioning |
| `grafana/dashboards/spring-app.json` | `obser/grafana/dashboards/spring-app.json` | Spring telemetry dashboard |

## Imported Services

- `clickhouse`
- `otel-collector`
- `hyperdx-mongo`
- `hyperdx`
- `grafana`
- Spring OTEL Java agent wiring

## Adaptation Scope

The current repo adaptation keeps the donor assets in `obser/` and wires only `backend/news-app` to the collector. The broader donor stack pieces for Spark, PostgreSQL, Redis, Kafka, and Debezium were intentionally not imported.
