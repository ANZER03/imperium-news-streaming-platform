from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from imperium_news_pipeline.phase3.canonical import CanonicalArticle


class ElasticsearchClient(Protocol):
    def upsert(self, index: str, document_id: str, document: dict[str, Any]) -> None:
        ...

    def delete(self, index: str, document_id: str) -> None:
        ...


@dataclass(frozen=True)
class ElasticsearchProjectionResult:
    projected: bool
    removed: bool = False
    errors: tuple[str, ...] = ()


@dataclass
class ElasticsearchArticleProjector:
    elasticsearch: ElasticsearchClient
    index_name: str = "imperium_articles_search"

    def project(self, article: CanonicalArticle) -> ElasticsearchProjectionResult:
        try:
            if not _searchable(article):
                self.elasticsearch.delete(self.index_name, article.article_id)
                return ElasticsearchProjectionResult(projected=False, removed=True)

            self.elasticsearch.upsert(self.index_name, article.article_id, elasticsearch_document(article))
            return ElasticsearchProjectionResult(projected=True)
        except Exception as exc:  # pragma: no cover - exact client errors are adapter-specific.
            return ElasticsearchProjectionResult(projected=False, errors=(str(exc),))


@dataclass
class InMemoryElasticsearchClient:
    documents: dict[str, dict[str, dict[str, Any]]] = field(default_factory=dict)
    deleted: list[tuple[str, str]] = field(default_factory=list)
    fail_writes: bool = False

    def upsert(self, index: str, document_id: str, document: dict[str, Any]) -> None:
        self._maybe_fail()
        self.documents.setdefault(index, {})[document_id] = dict(document)

    def delete(self, index: str, document_id: str) -> None:
        self._maybe_fail()
        self.documents.setdefault(index, {}).pop(document_id, None)
        self.deleted.append((index, document_id))

    def _maybe_fail(self) -> None:
        if self.fail_writes:
            raise RuntimeError("elasticsearch unavailable")


def elasticsearch_document(article: CanonicalArticle) -> dict[str, Any]:
    return _without_none(
        {
            "article_id": article.article_id,
            "source_news_id": article.source_news_id,
            "link_id": article.link_id,
            "authority_id": article.authority_id,
            "country_id": article.country_id,
            "country_name": article.country_name,
            "source_name": article.source_name,
            "source_domain": article.source_domain,
            "rubric_id": article.rubric_id,
            "rubric_title": article.rubric_title,
            "language_id": article.language_id,
            "language_code": article.language_code,
            "root_topic_id": article.root_topic_id,
            "root_topic_label": article.root_topic_label,
            "primary_topic_id": article.primary_topic_id,
            "primary_topic_label": article.primary_topic_label,
            "classification_status": article.classification_status,
            "title": article.title,
            "body_text": article.body_text,
            "body_text_clean": article.body_text_clean,
            "excerpt": article.excerpt,
            "url": article.url,
            "image_url": article.image_url,
            "reporter": article.reporter,
            "published_at": _iso_or_none(article.published_at),
            "crawled_at": _iso_or_none(article.crawled_at),
            "processed_at": _iso_or_none(article.processed_at),
            "is_video": article.is_video,
            "is_visible": _searchable(article),
            "schema_version": article.schema_version,
        }
    )


def _searchable(article: CanonicalArticle) -> bool:
    return bool(article.title and article.url and (article.body_text_clean or article.body_text))


def _iso_or_none(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _without_none(document: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in document.items() if value is not None}
