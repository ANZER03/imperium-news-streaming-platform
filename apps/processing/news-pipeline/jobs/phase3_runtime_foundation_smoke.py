from __future__ import annotations

import sys
from urllib.parse import urlparse
from urllib.request import urlopen
import socket

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.runtime_adapters import InMemoryRuntimeKafkaAdmin
from imperium_news_pipeline.phase3.topic_bootstrap import ensure_runtime_topics, runtime_topic_specs


def main() -> int:
    checks: list[tuple[str, bool, str]] = []

    try:
        config = Phase3RuntimeConfig.from_env()
        checks.append(("config load", True, f"window_days={config.window_days} canonical_topic={config.kafka.canonical_topic}"))
    except Exception as exc:  # noqa: BLE001 - smoke should report all failures compactly.
        print(f"FAIL config load: {exc}")
        return 1

    checks.append(("NVIDIA config presence", config.nvidia.api_key_present, "NVIDIA_API_KEY present" if config.nvidia.api_key_present else "NVIDIA_API_KEY missing"))

    try:
        change = DebeziumAvroCdcDecoder().decode(
            key={"id": 1},
            value={
                "op": "c",
                "source": {"schema": "public", "table": "table_news"},
                "after": {"id": 1, "more_title": "Runtime smoke"},
                "ts_ms": 1777200000000,
            },
        )
        checks.append(("CDC decode fixture", change.source_table == "public.table_news", change.source_table))
    except Exception as exc:  # noqa: BLE001
        checks.append(("CDC decode fixture", False, str(exc)))

    admin = InMemoryRuntimeKafkaAdmin()
    try:
        ensure_runtime_topics(admin, runtime_topic_specs(config))
        checks.append(("Kafka topic bootstrap spec", config.kafka.canonical_topic in admin.topics, ",".join(sorted(admin.topics))))
    except Exception as exc:  # noqa: BLE001
        checks.append(("Kafka topic bootstrap spec", False, str(exc)))

    checks.append(("PostgreSQL connectivity", *_socket_check_from_url(config.postgres.dsn)))
    checks.append(("Kafka broker connectivity", *_socket_check_from_bootstrap(config.kafka.bootstrap_servers)))
    checks.append(("Schema Registry connectivity", *_http_check(config.kafka.schema_registry_url)))
    checks.append(("Redis connectivity", *_socket_check_from_url(config.redis.url)))
    checks.append(("Qdrant connectivity", *_http_check(f"{config.qdrant.url.rstrip('/')}/collections")))

    failed = False
    for name, passed, detail in checks:
        status = "PASS" if passed else "FAIL"
        if name == "NVIDIA config presence" and not passed:
            status = "WARN"
        if name in {"config load", "CDC decode fixture", "Kafka topic bootstrap spec"} and not passed:
            failed = True
        if name.endswith("connectivity") and not passed:
            failed = True
        print(f"{status} {name}: {detail}")
    return 1 if failed else 0


def _socket_check_from_url(url: str) -> tuple[bool, str]:
    parsed = urlparse(url)
    host = parsed.hostname
    port = parsed.port
    if host is None or port is None:
        return False, f"cannot parse host/port from {url}"
    return _socket_check(host, port)


def _socket_check_from_bootstrap(bootstrap_servers: str) -> tuple[bool, str]:
    errors = []
    for server in bootstrap_servers.split(","):
        host_port = server.strip()
        if not host_port:
            continue
        host, separator, port_text = host_port.rpartition(":")
        if not separator:
            errors.append(f"{host_port}: missing port")
            continue
        passed, detail = _socket_check(host, int(port_text))
        if passed:
            return True, detail
        errors.append(detail)
    return False, "; ".join(errors) or "no bootstrap servers configured"


def _socket_check(host: str, port: int) -> tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=2):
            return True, f"{host}:{port} reachable"
    except OSError as exc:
        return False, f"{host}:{port} unreachable: {exc}"


def _http_check(url: str) -> tuple[bool, str]:
    try:
        with urlopen(url, timeout=2) as response:  # noqa: S310 - local runtime smoke uses configured local URLs.
            return 200 <= response.status < 500, f"{url} status={response.status}"
    except Exception as exc:  # noqa: BLE001 - smoke must report raw local runtime failures.
        return False, f"{url} unreachable: {exc}"


if __name__ == "__main__":
    raise SystemExit(main())
