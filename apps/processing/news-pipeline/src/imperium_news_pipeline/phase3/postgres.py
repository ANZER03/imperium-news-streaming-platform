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
FROM phase3_cleaned_articles
WHERE article_id = %(article_id)s
"""


UPSERT_CLEANED_ARTICLE_SQL = """
INSERT INTO phase3_cleaned_articles (
    article_id,
    source_news_id,
    payload,
    schema_version,
    classification_status,
    dimension_status,
    is_visible,
    is_deleted,
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
    %(is_visible)s,
    %(is_deleted)s,
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
    is_visible = EXCLUDED.is_visible,
    is_deleted = EXCLUDED.is_deleted,
    published_at = EXCLUDED.published_at,
    crawled_at = EXCLUDED.crawled_at,
    processed_at = EXCLUDED.processed_at,
    updated_at = now()
"""


@dataclass
class PostgresCleanedArticleRepository:
    connection_factory: ConnectionFactory

    def upsert(self, record: CleanedArticleRecord) -> bool:
        payload_json = json.dumps(record.payload, sort_keys=True)
        connection = self.connection_factory()

        with connection.cursor() as cursor:
            cursor.execute(SELECT_CLEANED_ARTICLE_PAYLOAD_SQL, {"article_id": record.article_id})
            existing = cursor.fetchone()
            if existing is not None and _payload_json(existing[0]) == payload_json:
                return False

            params = {
                "article_id": record.article_id,
                "source_news_id": record.source_news_id,
                "payload": payload_json,
                "schema_version": record.payload["schema_version"],
                "classification_status": record.payload["classification_status"],
                "dimension_status": record.payload["dimension_status"],
                "is_visible": record.payload["is_visible"],
                "is_deleted": record.payload["is_deleted"],
                "published_at": record.payload["published_at"],
                "crawled_at": record.payload["crawled_at"],
                "processed_at": record.payload["processed_at"],
            }
            cursor.execute(UPSERT_CLEANED_ARTICLE_SQL, params)

        connection.commit()
        return True


def _payload_json(value: Any) -> str:
    if isinstance(value, str):
        return json.dumps(json.loads(value), sort_keys=True)
    return json.dumps(value, sort_keys=True)
