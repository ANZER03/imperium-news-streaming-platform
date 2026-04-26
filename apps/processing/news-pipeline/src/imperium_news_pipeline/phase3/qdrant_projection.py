from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol, Sequence

from imperium_news_pipeline.phase3.canonical import CanonicalArticle


class QdrantClient(Protocol):
    def upsert(self, point_id: int, vector: Sequence[float], payload: dict[str, Any]) -> None:
        ...


class ArticleVectorGateway(Protocol):
    def vector_for(self, article: CanonicalArticle) -> Sequence[float]:
        ...


@dataclass(frozen=True)
class QdrantProjectionResult:
    projected: bool
    errors: tuple[str, ...] = ()


@dataclass
class QdrantArticleProjector:
    qdrant: QdrantClient
    vectors: ArticleVectorGateway

    def project(self, article: CanonicalArticle) -> QdrantProjectionResult:
        try:
            vector = tuple(float(value) for value in self.vectors.vector_for(article))
            self.qdrant.upsert(qdrant_point_id(article), vector, qdrant_payload(article))
            return QdrantProjectionResult(projected=True)
        except Exception as exc:  # pragma: no cover - exact client errors are adapter-specific.
            return QdrantProjectionResult(projected=False, errors=(str(exc),))


@dataclass
class InMemoryArticleVectorGateway:
    vectors: dict[str, tuple[float, ...]] = field(default_factory=dict)
    fail: bool = False

    def vector_for(self, article: CanonicalArticle) -> Sequence[float]:
        if self.fail:
            raise RuntimeError("embedding gateway unavailable")
        vector = self.vectors.get(article.article_id)
        if vector is None:
            raise KeyError(f"missing embedding for {article.article_id}")
        return vector


@dataclass
class InMemoryQdrantClient:
    points: dict[str, dict[str, Any]] = field(default_factory=dict)
    fail_writes: bool = False
    upsert_count: int = 0

    def upsert(self, point_id: int, vector: Sequence[float], payload: dict[str, Any]) -> None:
        if self.fail_writes:
            raise RuntimeError("qdrant unavailable")
        self.upsert_count += 1
        self.points[point_id] = {"vector": tuple(vector), "payload": dict(payload)}


def qdrant_payload(article: CanonicalArticle) -> dict[str, Any]:
    secondary_topic_ids = [
        candidate["topic_id"]
        for candidate in article.topic_candidates
        if candidate.get("topic_id") != article.primary_topic_id
    ]
    topic_tags = []
    for label in (article.root_topic_label, article.primary_topic_label):
        if label and label not in topic_tags:
            topic_tags.append(label)
    payload: dict[str, Any] = {
        "article_id": article.article_id,
        "country_id": article.country_id,
        "root_topic_id": article.root_topic_id,
        "primary_topic_id": article.primary_topic_id,
        "secondary_topic_ids": secondary_topic_ids,
        "topic_tags": topic_tags,
        "authority_id": article.authority_id,
        "language_id": article.language_id,
        "rubric_id": article.rubric_id,
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "is_visible": article.is_visible and not article.is_deleted,
        "source_domain": article.source_domain,
    }
    return payload


def qdrant_point_id(article: CanonicalArticle) -> int:
    return int(article.source_news_id)
