from __future__ import annotations

from dataclasses import dataclass

from imperium_news_pipeline.phase3.canonical import CanonicalArticle
from imperium_news_pipeline.phase3.projection_state import ProjectionState, ProjectionStateRepository
from imperium_news_pipeline.phase3.qdrant_projection import QdrantArticleProjector, QdrantProjectionResult
from imperium_news_pipeline.phase3.redis_projection import RedisFeedProjector, RedisProjectionResult


@dataclass(frozen=True)
class ProjectionFanoutResult:
    redis: RedisProjectionResult
    qdrant: QdrantProjectionResult
    replay_skipped: bool = False


@dataclass
class ProjectionFanout:
    redis: RedisFeedProjector
    qdrant: QdrantArticleProjector
    projection_state: ProjectionStateRepository | None = None

    def project(
        self,
        article: CanonicalArticle,
        previous_root_topic_id: int | None = None,
        previous_country_id: int | None = None,
    ) -> ProjectionFanoutResult:
        stored_state = self.projection_state.get(article.article_id) if self.projection_state is not None else None
        if stored_state is not None and stored_state.matches(article):
            return ProjectionFanoutResult(
                redis=RedisProjectionResult(projected=False, removed=False),
                qdrant=QdrantProjectionResult(projected=False),
                replay_skipped=True,
            )

        known_previous_root_topic_id = (
            previous_root_topic_id if previous_root_topic_id is not None else (stored_state.root_topic_id if stored_state else None)
        )
        known_previous_country_id = (
            previous_country_id if previous_country_id is not None else (stored_state.country_id if stored_state else None)
        )

        redis_result = self.redis.project_cards_and_feeds(
            article,
            previous_country_id=known_previous_country_id,
        )
        if article.classification_status == "classified" or known_previous_root_topic_id is not None:
            redis_result = self.redis.update_topic_membership(
                article,
                previous_root_topic_id=known_previous_root_topic_id,
                previous_country_id=known_previous_country_id,
            )
        qdrant_result = self.qdrant.project(article)
        if self.projection_state is not None and not redis_result.errors and not qdrant_result.errors:
            self.projection_state.upsert(ProjectionState.from_article(article))
        return ProjectionFanoutResult(redis=redis_result, qdrant=qdrant_result, replay_skipped=False)
