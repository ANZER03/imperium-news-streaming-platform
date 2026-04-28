from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Protocol

from imperium_news_pipeline.phase3.canonical import CanonicalArticle


@dataclass(frozen=True)
class ProjectionState:
    article_id: str
    country_id: int | None
    root_topic_id: int | None
    published_at: datetime | None

    @classmethod
    def from_article(cls, article: CanonicalArticle) -> ProjectionState:
        return cls(
            article_id=article.article_id,
            country_id=article.country_id,
            root_topic_id=article.root_topic_id,
            published_at=article.published_at,
        )

    def matches(self, article: CanonicalArticle) -> bool:
        return self == ProjectionState.from_article(article)


class ProjectionStateRepository(Protocol):
    def get(self, article_id: str) -> ProjectionState | None:
        ...

    def upsert(self, state: ProjectionState) -> None:
        ...


@dataclass
class InMemoryProjectionStateRepository:
    rows: dict[str, ProjectionState] = field(default_factory=dict)

    def get(self, article_id: str) -> ProjectionState | None:
        return self.rows.get(article_id)

    def upsert(self, state: ProjectionState) -> None:
        self.rows[state.article_id] = state
