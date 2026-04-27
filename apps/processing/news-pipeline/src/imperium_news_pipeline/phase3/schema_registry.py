"""Confluent Schema Registry helpers for Phase 3 drivers.

Provides schema registration and Confluent wire-format magic bytes.
All calls are meant to run once at driver startup, not inside foreachBatch.
"""
from __future__ import annotations

import json
import struct
from urllib import error, request as _request


def register_schema(schema_registry_url: str, subject: str, schema_json: str) -> int:
    """Register an Avro schema with the Schema Registry (idempotent).

    Returns the schema ID assigned by the registry. If an identical schema
    already exists for the subject the registry returns the existing ID.
    """
    url = f"{schema_registry_url.rstrip('/')}/subjects/{subject}/versions"
    payload = json.dumps({"schema": schema_json, "schemaType": "AVRO"}).encode("utf-8")
    req = _request.Request(
        url,
        data=payload,
        headers={"Content-Type": "application/vnd.schemaregistry.v1+json"},
        method="POST",
    )
    try:
        with _request.urlopen(req, timeout=10) as resp:
            return int(json.loads(resp.read())["id"])
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"Schema Registry registration failed for subject '{subject}': "
            f"HTTP {exc.code} — {body}"
        ) from exc


def confluent_magic(schema_id: int) -> bytes:
    """Return the 5-byte Confluent wire-format prefix.

    Format: 0x00 (magic byte) + 4-byte big-endian schema ID.
    Must be prepended to every Avro-encoded Kafka message value so that
    Confluent-compatible consumers (Kafka UI, ksqlDB, Flink, etc.) can
    look up the schema automatically.
    """
    return b"\x00" + struct.pack(">I", schema_id)
