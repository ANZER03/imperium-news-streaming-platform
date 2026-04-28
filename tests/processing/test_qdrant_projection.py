from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import unittest

from imperium_news_pipeline.phase3.canonical import (
    CanonicalArticleBuilder,
    CanonicalArticleFirstEmitProcessor,
    InMemoryCanonicalArticleProducer,
    InMemoryCleanedArticleRepository,
    NewsArticleIdProvider,
    RawNewsRecord,
)
from imperium_news_pipeline.phase3.projection_fanout import ProjectionFanout
from imperium_news_pipeline.phase3.projection_state import InMemoryProjectionStateRepository
from imperium_news_pipeline.phase3.qdrant_projection import (
    InMemoryArticleVectorGateway,
    InMemoryQdrantClient,
    QdrantArticleProjector,
    qdrant_point_id,
)
from imperium_news_pipeline.phase3.redis_projection import InMemoryRedisClient, RedisFeedProjector


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


class QdrantProjectionTests(unittest.TestCase):
    def test_qdrant_projection_writes_vector_and_filter_payload(self) -> None:
        article = _classified_article()
        qdrant = InMemoryQdrantClient()
        projector = QdrantArticleProjector(
            qdrant=qdrant,
            vectors=InMemoryArticleVectorGateway({article.article_id: (0.1, 0.2, 0.3)}),
        )

        result = projector.project(article)

        self.assertTrue(result.projected)
        point = qdrant.points[qdrant_point_id(article)]
        self.assertEqual(point["vector"], (0.1, 0.2, 0.3))
        self.assertEqual(point["payload"]["article_id"], article.article_id)
        self.assertEqual(point["payload"]["country_id"], 504)
        self.assertEqual(point["payload"]["root_topic_id"], 11000000)
        self.assertEqual(point["payload"]["primary_topic_id"], 11000000)
        self.assertEqual(point["payload"]["secondary_topic_ids"], [4000000, 13000000])
        self.assertEqual(point["payload"]["topic_tags"], ["Politics and government"])
        self.assertEqual(point["payload"]["authority_id"], 2)
        self.assertEqual(point["payload"]["language_id"], 6)
        self.assertEqual(point["payload"]["rubric_id"], 3)
        self.assertEqual(point["payload"]["source_domain"], "news.example")
        self.assertTrue(point["payload"]["published_at"].startswith("2026-04-24T08:30:00"))
        self.assertTrue(point["payload"]["is_visible"])

    def test_qdrant_projection_marks_hidden_or_deleted_articles_invisible(self) -> None:
        article = _classified_article()
        hidden = type(article)(**{**article.__dict__, "is_visible": False})
        qdrant = InMemoryQdrantClient()
        projector = QdrantArticleProjector(
            qdrant=qdrant,
            vectors=InMemoryArticleVectorGateway({article.article_id: (0.1, 0.2)}),
        )

        result = projector.project(hidden)

        self.assertTrue(result.projected)
        self.assertFalse(qdrant.points[qdrant_point_id(article)]["payload"]["is_visible"])

    def test_projection_fanout_keeps_redis_and_qdrant_failures_isolated(self) -> None:
        article = _classified_article()

        redis_failure = ProjectionFanout(
            redis=RedisFeedProjector(InMemoryRedisClient(fail_writes=True)),
            qdrant=QdrantArticleProjector(
                qdrant=InMemoryQdrantClient(),
                vectors=InMemoryArticleVectorGateway({article.article_id: (0.1, 0.2)}),
            ),
        ).project(article)

        qdrant_failure = ProjectionFanout(
            redis=RedisFeedProjector(InMemoryRedisClient()),
            qdrant=QdrantArticleProjector(
                qdrant=InMemoryQdrantClient(fail_writes=True),
                vectors=InMemoryArticleVectorGateway({article.article_id: (0.1, 0.2)}),
            ),
        ).project(article)

        self.assertEqual(redis_failure.redis.errors, ("redis unavailable",))
        self.assertTrue(redis_failure.qdrant.projected)
        self.assertTrue(qdrant_failure.redis.updated_topic_feeds)
        self.assertEqual(qdrant_failure.qdrant.errors, ("qdrant unavailable",))

    def test_projection_fanout_uses_projection_state_for_idempotent_replay_and_reclassification_cleanup(self) -> None:
        article = _classified_article()
        redis = InMemoryRedisClient()
        qdrant = InMemoryQdrantClient()
        state = InMemoryProjectionStateRepository()
        fanout = ProjectionFanout(
            redis=RedisFeedProjector(redis),
            qdrant=QdrantArticleProjector(
                qdrant=qdrant,
                vectors=InMemoryArticleVectorGateway({article.article_id: (0.1, 0.2)}),
            ),
            projection_state=state,
        )

        first = fanout.project(article)
        replay = fanout.project(article)
        reclassified = type(article)(
            **{
                **article.__dict__,
                "country_id": 250,
                "country_name": "France",
                "root_topic_id": 13000000,
                "root_topic_label": "Science and technology",
            }
        )
        changed = fanout.project(reclassified)

        self.assertTrue(first.redis.projected)
        self.assertTrue(first.qdrant.projected)
        self.assertFalse(first.replay_skipped)
        self.assertTrue(replay.replay_skipped)
        self.assertEqual(qdrant.upsert_count, 2)
        self.assertIn("news:88", redis.sorted_sets["feed:country:250"])
        self.assertNotIn("news:88", redis.sorted_sets["feed:country:504"])
        self.assertIn("news:88", redis.sorted_sets["feed:topic:13000000"])
        self.assertNotIn("news:88", redis.sorted_sets["feed:topic:11000000"])
        self.assertIn("news:88", redis.sorted_sets["feed:country:250:topic:13000000"])
        self.assertNotIn("news:88", redis.sorted_sets["feed:country:504:topic:11000000"])
        self.assertFalse(changed.replay_skipped)
        self.assertEqual(state.rows["news:88"].country_id, 250)
        self.assertEqual(state.rows["news:88"].root_topic_id, 13000000)

    def test_projection_fanout_delete_visibility_cleanup_and_qdrant_visibility_replay_safety(self) -> None:
        article = _classified_article()
        hidden = type(article)(**{**article.__dict__, "is_visible": False})
        redis = InMemoryRedisClient()
        qdrant = InMemoryQdrantClient()
        state = InMemoryProjectionStateRepository()
        fanout = ProjectionFanout(
            redis=RedisFeedProjector(redis),
            qdrant=QdrantArticleProjector(
                qdrant=qdrant,
                vectors=InMemoryArticleVectorGateway({article.article_id: (0.1, 0.2)}),
            ),
            projection_state=state,
        )

        fanout.project(article)
        hidden_first = fanout.project(hidden)
        hidden_replay = fanout.project(hidden)

        self.assertTrue(hidden_first.redis.removed)
        self.assertFalse(qdrant.points[qdrant_point_id(article)]["payload"]["is_visible"])
        self.assertNotIn("article:news:88", redis.hashes)
        self.assertNotIn("news:88", redis.sorted_sets["feed:global"])
        self.assertNotIn("news:88", redis.sorted_sets["feed:country:504"])
        self.assertNotIn("news:88", redis.sorted_sets["feed:topic:11000000"])
        self.assertNotIn("news:88", redis.sorted_sets["feed:country:504:topic:11000000"])
        self.assertTrue(hidden_replay.replay_skipped)
        self.assertEqual(qdrant.upsert_count, 2)


def _classified_article():
    processor = CanonicalArticleFirstEmitProcessor(
        builder=CanonicalArticleBuilder(
            id_provider=NewsArticleIdProvider(),
            clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
        ),
        repository=InMemoryCleanedArticleRepository(),
        producer=InMemoryCanonicalArticleProducer(),
    )
    article = processor.process(
        RawNewsRecord(
            id=88,
            link_id=10,
            authority_id=2,
            rubrique_id=3,
            langue_id=6,
            more_title="Semantic search story",
            more_url="https://news.example/story",
            more_inner_text="alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
            pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
            valide=True,
        )
    ).article
    return type(article)(
            **{
                **article.__dict__,
                "country_id": 504,
                "source_domain": "news.example",
                "root_topic_id": 11000000,
                "root_topic_label": "Politics and government",
                "primary_topic_id": 11000000,
                "primary_topic_label": "Politics and government",
                "topic_candidates": (
                    {"topic_id": 11000000, "topic_label": "Politics and government"},
                    {"topic_id": 4000000, "topic_label": "Economy, business and finance"},
                    {"topic_id": 13000000, "topic_label": "Science and technology"},
                ),
                "classification_status": "classified",
            }
        )


if __name__ == "__main__":
    unittest.main()
