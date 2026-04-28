from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Mapping


VALID_DEBEZIUM_OPS = frozenset(("c", "r", "u", "d"))


@dataclass(frozen=True)
class TableChangeRecord:
    operation: str
    key: Mapping[str, Any]
    before: Mapping[str, Any] | None
    after: Mapping[str, Any] | None
    source_table: str
    event_timestamp: datetime

    @property
    def is_delete(self) -> bool:
        return self.operation == "d"

    @property
    def current_payload(self) -> Mapping[str, Any] | None:
        return self.before if self.is_delete else self.after


@dataclass(frozen=True)
class DebeziumAvroCdcDecoder:
    """Decode the dict shape produced by Spark after Avro deserialization."""

    default_schema: str = "public"

    def decode(self, *, key: Mapping[str, Any] | None, value: Mapping[str, Any] | None) -> TableChangeRecord:
        if value is None:
            raise ValueError("missing CDC value envelope")
        if not isinstance(value, Mapping):
            raise ValueError("CDC value envelope must be a mapping")

        operation = value.get("op")
        if operation not in VALID_DEBEZIUM_OPS:
            raise ValueError(f"invalid Debezium operation: {operation!r}")

        source = value.get("source")
        if not isinstance(source, Mapping):
            raise ValueError("missing Debezium source metadata")
        table = source.get("table")
        if not table:
            raise ValueError("missing Debezium source table")
        schema = source.get("schema") or self.default_schema

        before = _optional_mapping(value.get("before"), "before")
        after = _optional_mapping(value.get("after"), "after")
        if operation in ("c", "r") and after is None:
            raise ValueError("insert/read CDC envelope requires after payload")
        if operation == "u" and after is None:
            raise ValueError("update CDC envelope requires after payload")
        if operation == "d" and before is None:
            raise ValueError("delete CDC envelope requires before payload")

        return TableChangeRecord(
            operation=str(operation),
            key=dict(key or _key_from_payload(after or before)),
            before=before,
            after=after,
            source_table=f"{schema}.{table}",
            event_timestamp=_event_timestamp(value),
        )


def _optional_mapping(value: Any, field_name: str) -> Mapping[str, Any] | None:
    if value is None:
        return None
    if not isinstance(value, Mapping):
        raise ValueError(f"CDC {field_name} payload must be a mapping")
    return dict(value)


def _key_from_payload(payload: Mapping[str, Any] | None) -> Mapping[str, Any]:
    if payload is None:
        return {}
    if "id" in payload:
        return {"id": payload["id"]}
    return {}


def _event_timestamp(envelope: Mapping[str, Any]) -> datetime:
    for key in ("ts_ms", "ts_us", "ts_ns"):
        value = envelope.get(key)
        if value is None:
            continue
        numeric = int(value)
        if key == "ts_ms":
            seconds = numeric / 1_000
        elif key == "ts_us":
            seconds = numeric / 1_000_000
        else:
            seconds = numeric / 1_000_000_000
        return datetime.fromtimestamp(seconds, tz=timezone.utc)
    raise ValueError("missing Debezium event timestamp")
