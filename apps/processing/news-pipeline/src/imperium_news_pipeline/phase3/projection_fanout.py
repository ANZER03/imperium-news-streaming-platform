from __future__ import annotations

from dataclasses import dataclass

from imperium_news_pipeline.phase3.canonical import CanonicalArticle
from imperium_news_pipeline.phase3.qdrant_projection import QdrantArticleProjector, QdrantProjectionResult
from imperium_news_pipeline.phase3.redis_projection import RedisFeedProjector, RedisProjectionResult


@dataclass(frozen=True)
class ProjectionFanoutResult:
    redis: RedisProjectionResult
    qdrant: QdrantProjectionResult


@dataclass
class ProjectionFanout:
    redis: RedisFeedProjector
    qdrant: QdrantArticleProjector

    def project(
        self,
        article: CanonicalArticle,
        previous_root_topic_id: int | None = None,
        previous_country_id: int | None = None,
    ) -> ProjectionFanoutResult:
        redis_result = self.redis.project(article)
        if article.classification_status == "classified" or previous_root_topic_id is not None:
            redis_result = self.redis.update_topic_membership(
                article,
                previous_root_topic_id=previous_root_topic_id,
                previous_country_id=previous_country_id,
            )
        qdrant_result = self.qdrant.project(article)
        return ProjectionFanoutResult(redis=redis_result, qdrant=qdrant_result)
