from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Any, Callable, Protocol

from imperium_news_pipeline.phase3.canonical import CleanedArticleRecord


class Cursor(Protocol):
    def execute(self, query: str, params: dict[str, Any]) -> None:
        ...

    def fetchone(self) -> Any:
        ...


class Connection(Protocol):
    def cursor(self) -> Any:
        ...

    def commit(self) -> None:
        ...


ConnectionFactory = Callable[[], Connection]


SELECT_CLEANED_ARTICLE_PAYLOAD_SQL = """
SELECT payload
FROM {article_table}
WHERE article_id = %(article_id)s
"""


UPSERT_CLEANED_ARTICLE_SQL = """
INSERT INTO {article_table} (
    article_id,
    source_news_id,
    payload,
    schema_version,
    classification_status,
    dimension_status,
    published_at,
    crawled_at,
    processed_at
)
VALUES (
    %(article_id)s,
    %(source_news_id)s,
    %(payload)s,
    %(schema_version)s,
    %(classification_status)s,
    %(dimension_status)s,
    %(published_at)s,
    %(crawled_at)s,
    %(processed_at)s
)
ON CONFLICT (article_id) DO UPDATE SET
    source_news_id = EXCLUDED.source_news_id,
    payload = EXCLUDED.payload,
    schema_version = EXCLUDED.schema_version,
    classification_status = EXCLUDED.classification_status,
    dimension_status = EXCLUDED.dimension_status,
    published_at = EXCLUDED.published_at,
    crawled_at = EXCLUDED.crawled_at,
    processed_at = EXCLUDED.processed_at,
    updated_at = now()
"""


@dataclass
class PostgresCleanedArticleRepository:
    connection_factory: ConnectionFactory
    article_table: str = "imperium_articles"

    def upsert(self, record: CleanedArticleRecord) -> bool:
        return self.upsert_many((record,))[0]

    def upsert_many(self, records: list[CleanedArticleRecord] | tuple[CleanedArticleRecord, ...]) -> tuple[bool, ...]:
        if not records:
            return ()

        payloads_by_article_id = {
            record.article_id: json.dumps(record.payload, sort_keys=True)
            for record in records
        }
        existing_payloads = self._load_existing_payloads(tuple(payloads_by_article_id))

        to_write = []
        decisions = []
        for record in records:
            payload_json = payloads_by_article_id[record.article_id]
            existing_payload = existing_payloads.get(record.article_id)
            if existing_payload is not None and _payload_json(existing_payload) == payload_json:
                decisions.append(False)
                continue
            decisions.append(True)
            to_write.append(
                {
                    "article_id": record.article_id,
                    "source_news_id": record.source_news_id,
                    "payload": payload_json,
                    "schema_version": record.payload["schema_version"],
                    "classification_status": record.payload["classification_status"],
                    "dimension_status": record.payload["dimension_status"],
                    "published_at": record.payload["published_at"],
                    "crawled_at": record.payload["crawled_at"],
                    "processed_at": record.payload["processed_at"],
                }
            )

        if not to_write:
            return tuple(decisions)

        connection = self.connection_factory()
        upsert_sql = self._upsert_sql()
        with connection.cursor() as cursor:
            if hasattr(cursor, "executemany"):
                cursor.executemany(upsert_sql, tuple(to_write))
            else:
                for params in to_write:
                    cursor.execute(upsert_sql, params)
        connection.commit()
        return tuple(decisions)

    def _load_existing_payloads(self, article_ids: tuple[str, ...]) -> dict[str, Any]:
        connection = self.connection_factory()
        existing_payloads: dict[str, Any] = {}
        with connection.cursor() as cursor:
            for article_id in article_ids:
                cursor.execute(
                    SELECT_CLEANED_ARTICLE_PAYLOAD_SQL.format(article_table=self.article_table),
                    {"article_id": article_id},
                )
                existing = cursor.fetchone()
                if existing is not None:
                    existing_payloads[article_id] = existing[0]
        return existing_payloads

    def _upsert_sql(self) -> str:
        return UPSERT_CLEANED_ARTICLE_SQL.format(article_table=self.article_table)


def _payload_json(value: Any) -> str:
    if isinstance(value, str):
        return json.dumps(json.loads(value), sort_keys=True)
    return json.dumps(value, sort_keys=True)
