import json
import os
import time
from datetime import datetime, timezone
from typing import Any, Dict, List

import requests
from confluent_kafka import Message

from utils import build_avro_deserializer, build_consumer, consume_microbatches, get_logger


logger = get_logger("ElasticsearchProjector")

DEFAULT_CANONICAL_TOPIC = "imperium.canonical-articles"
DEFAULT_INDEX_NAME = "imperium_articles_search"


INDEX_SETTINGS = {
    "settings": {
        "analysis": {
            "analyzer": {
                "imperium_text": {
                    "type": "standard",
                    "stopwords": "_none_",
                }
            }
        }
    },
    "mappings": {
        "dynamic": "false",
        "properties": {
            "article_id": {"type": "keyword"},
            "source_news_id": {"type": "integer"},
            "link_id": {"type": "integer"},
            "authority_id": {"type": "integer"},
            "country_id": {"type": "integer"},
            "country_name": {"type": "keyword"},
            "source_name": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
            },
            "source_domain": {"type": "keyword"},
            "rubric_id": {"type": "integer"},
            "rubric_title": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
            },
            "language_id": {"type": "integer"},
            "language_code": {"type": "keyword"},
            "classification_status": {"type": "keyword"},
            "title": {
                "type": "text",
                "analyzer": "imperium_text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 512}},
            },
            "body_text": {"type": "text", "analyzer": "imperium_text"},
            "body_text_clean": {"type": "text", "analyzer": "imperium_text"},
            "excerpt": {"type": "text", "analyzer": "imperium_text"},
            "url": {"type": "keyword"},
            "image_url": {"type": "keyword", "index": False},
            "video_url": {"type": "keyword", "index": False},
            "reporter": {
                "type": "text",
                "fields": {"keyword": {"type": "keyword", "ignore_above": 256}},
            },
            "source_date_text": {"type": "keyword", "index": False},
            "published_at": {"type": "date", "format": "epoch_millis||strict_date_optional_time"},
            "crawled_at": {"type": "date", "format": "epoch_millis||strict_date_optional_time"},
            "processed_at": {"type": "date", "format": "epoch_millis||strict_date_optional_time"},
            "is_video": {"type": "boolean"},
            "is_visible": {"type": "boolean"},
            "dimension_status": {"type": "keyword"},
            "missing_dimensions": {"type": "keyword"},
            "schema_version": {"type": "integer"},
        },
    },
}


class ElasticsearchHttpClient:
    def __init__(self, base_url: str, index_name: str, timeout: float = 10.0):
        self.base_url = base_url.rstrip("/")
        self.index_name = index_name
        self.timeout = timeout
        self.session = requests.Session()

    def ping(self) -> None:
        response = self.session.get(f"{self.base_url}/_cluster/health", timeout=self.timeout)
        response.raise_for_status()

    def ensure_index(self) -> None:
        response = self.session.head(f"{self.base_url}/{self.index_name}", timeout=self.timeout)
        if response.status_code == 200:
            return
        if response.status_code != 404:
            response.raise_for_status()
        create = self.session.put(
            f"{self.base_url}/{self.index_name}",
            json=INDEX_SETTINGS,
            timeout=self.timeout,
        )
        create.raise_for_status()
        logger.info(f"Created Elasticsearch index {self.index_name}")

    def bulk(self, operations: List[Dict[str, Any]]) -> int:
        if not operations:
            return 0
        lines = []
        for operation in operations:
            action = operation["action"]
            document_id = operation["id"]
            lines.append(json.dumps({action: {"_index": self.index_name, "_id": document_id}}, separators=(",", ":")))
            if action == "update":
                lines.append(
                    json.dumps(
                        {"doc": operation["document"], "doc_as_upsert": True},
                        separators=(",", ":"),
                    )
                )
            else:
                lines.append(json.dumps(operation["document"], separators=(",", ":")))
        payload = "\n".join(lines) + "\n"
        response = self.session.post(
            f"{self.base_url}/_bulk",
            data=payload,
            headers={"Content-Type": "application/x-ndjson"},
            timeout=self.timeout,
        )
        response.raise_for_status()
        result = response.json()
        if result.get("errors"):
            failures = _bulk_failures(result, operations)
            for failure in failures[:10]:
                logger.error(
                    "Elasticsearch bulk item failed: action=%s id=%s status=%s type=%s reason=%s",
                    failure.get("action"),
                    failure.get("id"),
                    failure.get("status"),
                    failure.get("type"),
                    failure.get("reason"),
                )
            if len(failures) > 10:
                logger.error("Elasticsearch bulk suppressed %s additional item failures", len(failures) - 10)
            return len(failures)
        return 0


def build_document(data: Dict[str, Any]) -> Dict[str, Any]:
    document = {
        "article_id": data.get("article_id"),
        "source_news_id": _int_or_none(data.get("source_news_id")),
        "link_id": _int_or_none(data.get("link_id")),
        "authority_id": _int_or_none(data.get("authority_id")),
        "country_id": _int_or_none(data.get("country_id")),
        "country_name": data.get("country_name"),
        "source_name": data.get("source_name"),
        "source_domain": data.get("source_domain"),
        "rubric_id": _int_or_none(data.get("rubric_id")),
        "rubric_title": data.get("rubric_title"),
        "language_id": _int_or_none(data.get("language_id")),
        "language_code": data.get("language_code"),
        "classification_status": data.get("classification_status"),
        "title": data.get("title") or "",
        "body_text": data.get("body_text") or "",
        "body_text_clean": data.get("body_text_clean") or "",
        "excerpt": data.get("excerpt") or "",
        "url": data.get("url"),
        "image_url": _bounded_text(data.get("image_url"), 4096),
        "video_url": _bounded_text(data.get("video_url"), 4096),
        "reporter": data.get("reporter"),
        "source_date_text": _bounded_text(data.get("source_date_text"), 4096),
        "published_at": _timestamp_millis(data.get("published_at")),
        "crawled_at": _timestamp_millis(data.get("crawled_at")),
        "processed_at": _timestamp_millis(data.get("processed_at")),
        "is_video": bool(data.get("is_video")),
        "is_visible": _is_searchable(data),
        "dimension_status": data.get("dimension_status"),
        "missing_dimensions": data.get("missing_dimensions") or [],
        "schema_version": _int_or_none(data.get("schema_version")),
    }
    return {key: value for key, value in document.items() if value is not None}


def process_batch(
    messages: List[Message],
    client: ElasticsearchHttpClient,
    avro_deserializer,
    canonical_topic: str,
) -> None:
    operations = []
    upserted_count = 0
    skipped_count = 0

    for msg in messages:
        if msg.topic() != canonical_topic:
            continue
        try:
            data = avro_deserializer(msg.value(), None)
            if not data or not data.get("article_id"):
                skipped_count += 1
                continue

            article_id = str(data["article_id"])
            operations.append({"action": "update", "id": article_id, "document": build_document(data)})
            upserted_count += 1
        except Exception as exc:
            logger.error(f"Failed to build Elasticsearch operation: {exc}", exc_info=True)
            skipped_count += 1

    if operations:
        failed_count = client.bulk(operations)
        upserted_count = max(upserted_count - failed_count, 0)
        logger.info(
            f"Elasticsearch bulk applied: {upserted_count} upserted, "
            f"{skipped_count} skipped, {failed_count} failed."
        )


def _is_searchable(data: Dict[str, Any]) -> bool:
    return bool(
        data.get("title")
        and data.get("url")
        and (data.get("body_text_clean") or data.get("body_text"))
    )


def _timestamp_millis(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return int(value.astimezone(timezone.utc).timestamp() * 1000)
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return None
        try:
            value = float(stripped)
        except ValueError:
            return stripped
    if isinstance(value, (int, float)):
        numeric = float(value)
        if numeric > 1e15:
            return int(numeric / 1000)
        if numeric > 1e12:
            return int(numeric)
        return int(numeric * 1000)
    return None


def _bulk_failures(result: Dict[str, Any], operations: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    failures = []
    for index, item in enumerate(result.get("items", [])):
        action = next(iter(item.keys()), None)
        outcome = item.get(action) if action else None
        if not outcome or "error" not in outcome:
            continue
        operation = operations[index] if index < len(operations) else {}
        error = outcome.get("error") or {}
        failures.append(
            {
                "action": action,
                "id": outcome.get("_id") or operation.get("id"),
                "status": outcome.get("status"),
                "type": error.get("type"),
                "reason": error.get("reason"),
            }
        )
    return failures


def _int_or_none(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _bounded_text(value: Any, max_len: int) -> str | None:
    if value is None:
        return None
    text = str(value)
    if len(text) > max_len:
        return text[:max_len]
    return text


def main() -> None:
    bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
    schema_registry_url = os.environ.get("SCHEMA_REGISTRY_URL", "http://schema-registry:8081")
    canonical_topic = os.environ.get("CANONICAL_TOPIC", DEFAULT_CANONICAL_TOPIC)
    group_id = os.environ.get("KAFKA_GROUP_ID", "imperium-elasticsearch-projector-canonical-group")
    elasticsearch_url = os.environ.get("ELASTICSEARCH_URL", "http://elasticsearch:9200")
    index_name = os.environ.get("ELASTICSEARCH_INDEX", DEFAULT_INDEX_NAME)
    batch_size = int(os.environ.get("ELASTICSEARCH_BATCH_SIZE", "5000"))
    timeout_seconds = float(os.environ.get("ELASTICSEARCH_TIMEOUT_SECONDS", "60"))

    logger.info(
        f"Initializing Elasticsearch Projector for canonical_topic={canonical_topic} "
        f"batch_size={batch_size} timeout_seconds={timeout_seconds}..."
    )
    consumer = build_consumer(bootstrap_servers, group_id)
    avro_deserializer = build_avro_deserializer(schema_registry_url)

    while True:
        try:
            client = ElasticsearchHttpClient(elasticsearch_url, index_name, timeout=timeout_seconds)
            client.ping()
            client.ensure_index()
            logger.info("Connected to Elasticsearch successfully.")
            break
        except Exception as exc:
            logger.warning(f"Waiting for Elasticsearch... ({exc})")
            time.sleep(5)

    def batch_processor(messages: List[Message]) -> None:
        process_batch(messages, client, avro_deserializer, canonical_topic)

    consume_microbatches(
        consumer=consumer,
        topics=[canonical_topic],
        process_batch=batch_processor,
        batch_size=batch_size,
        timeout_ms=1.0,
        logger=logger,
    )


if __name__ == "__main__":
    main()
