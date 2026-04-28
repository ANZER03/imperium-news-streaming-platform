from __future__ import annotations

from dataclasses import dataclass, field, replace
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
from imperium_news_pipeline.phase3.classification import (
    ArticleClassificationProcessor,
    EmbeddingSimilarityClassifier,
)
from imperium_news_pipeline.phase3.dimensions import (
    DimensionEnrichmentService,
    DimensionMaterializer,
    InMemoryDimensionRepository,
    authority_dimension,
    country_dimension,
    language_dimension,
    link_dimension,
    rubric_dimension,
    sedition_dimension,
)
from imperium_news_pipeline.phase3.embedding_gateway import EmbeddingGatewayResult, EmbeddingRequestItem
from imperium_news_pipeline.phase3.projection_fanout import ProjectionFanout
from imperium_news_pipeline.phase3.projection_state import InMemoryProjectionStateRepository
from imperium_news_pipeline.phase3.qdrant_projection import (
    InMemoryArticleVectorGateway,
    InMemoryQdrantClient,
    QdrantArticleProjector,
    qdrant_point_id,
)
from imperium_news_pipeline.phase3.redis_projection import InMemoryRedisClient, RedisFeedProjector
from imperium_news_pipeline.phase3.topics import (
    DEFAULT_EMBEDDING_MODEL,
    InMemoryTopicEmbeddingRepository,
    InMemoryTopicTaxonomyRepository,
    TopicEmbedding,
    TopicTaxonomyService,
    seed_phase3_topics,
)


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


@dataclass
class StaticGateway:
    vectors: dict[str, tuple[float, ...]]
    calls: list[tuple[EmbeddingRequestItem, ...]] = field(default_factory=list)

    def embed(self, items) -> EmbeddingGatewayResult:
        item_tuple = tuple(items)
        self.calls.append(item_tuple)
        return EmbeddingGatewayResult(
            embeddings={
                item.item_id: self.vectors[item.item_id]
                for item in item_tuple
                if item.item_id in self.vectors
            }
        )


class Phase3EndToEndValidationTests(unittest.TestCase):
    def test_full_flow_from_dimension_cdc_to_replay_and_delete_cleanup(self) -> None:
        dim_repo = InMemoryDimensionRepository()
        materializer = DimensionMaterializer(repository=dim_repo)
        for record in (
            link_dimension(
                {
                    "id": 10,
                    "url": "https://news.example/election",
                    "domain": "news.example",
                    "source_name": "Example News",
                    "pays_id": 504,
                }
            ),
            authority_dimension({"id": 2, "name": "Example News", "domain": "news.example", "sedition_id": 30}),
            sedition_dimension({"id": 30, "pays_id": 504}),
            country_dimension({"id": 504, "name": "Morocco"}),
            rubric_dimension({"id": 3, "title": "Politics"}),
            language_dimension({"id": 6, "code": "fr"}),
        ):
            self.assertTrue(materializer.materialize(record))

        enrichment = DimensionEnrichmentService(dim_repo)
        cleaned_repo = InMemoryCleanedArticleRepository()
        canonical_producer = InMemoryCanonicalArticleProducer()
        first_emit_processor = CanonicalArticleFirstEmitProcessor(
            builder=CanonicalArticleBuilder(
                id_provider=NewsArticleIdProvider(),
                clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
            ),
            repository=cleaned_repo,
            producer=canonical_producer,
            dimension_enrichment=enrichment,
        )
        pending = first_emit_processor.process(
            RawNewsRecord(
                id=5001,
                link_id=10,
                authority_id=2,
                rubrique_id=3,
                langue_id=6,
                more_title="Election debate drives turnout",
                more_url="https://news.example/election",
                more_inner_text="Election candidates debate turnout and campaign strategy for next vote.",
                pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
                valide=True,
            )
        ).article

        self.assertEqual(pending.classification_status, "pending")
        self.assertEqual(pending.dimension_status, "complete")
        self.assertEqual(cleaned_repo.rows[pending.article_id]["classification_status"], "pending")

        redis = InMemoryRedisClient()
        redis_projector = RedisFeedProjector(redis)
        pending_redis = redis_projector.project(pending)
        self.assertTrue(pending_redis.projected)
        self.assertIn(pending.article_id, redis.sorted_sets["feed:global"])
        self.assertIn(pending.article_id, redis.sorted_sets["feed:country:504"])
        self.assertNotIn(pending.article_id, redis.sorted_sets.get("feed:topic:11000000", {}))

        classification_gateway = StaticGateway({pending.article_id: (1.0, 0.0)})
        classifier = EmbeddingSimilarityClassifier(
            gateway=classification_gateway,
            taxonomy_service=TopicTaxonomyService(InMemoryTopicTaxonomyRepository(seed_phase3_topics())),
            topic_embedding_repository=InMemoryTopicEmbeddingRepository(
                (
                    TopicEmbedding(
                        topic_id=11000000,
                        taxonomy_version="phase3-v1",
                        embedding_model=DEFAULT_EMBEDDING_MODEL,
                        embedding_dimension=2,
                        embedding_input_text="politics",
                        embedding_input_hash="a",
                        embedding_vector=(1.0, 0.0),
                    ),
                    TopicEmbedding(
                        topic_id=4000000,
                        taxonomy_version="phase3-v1",
                        embedding_model=DEFAULT_EMBEDDING_MODEL,
                        embedding_dimension=2,
                        embedding_input_text="business",
                        embedding_input_hash="b",
                        embedding_vector=(0.8, 0.2),
                    ),
                    TopicEmbedding(
                        topic_id=13000000,
                        taxonomy_version="phase3-v1",
                        embedding_model=DEFAULT_EMBEDDING_MODEL,
                        embedding_dimension=2,
                        embedding_input_text="technology",
                        embedding_input_hash="c",
                        embedding_vector=(0.0, 1.0),
                    ),
                )
            ),
        )
        classification_producer = InMemoryCanonicalArticleProducer()
        classification_processor = ArticleClassificationProcessor(
            classifier=classifier,
            repository=cleaned_repo,
            producer=classification_producer,
            clock=FixedClock(datetime(2026, 4, 25, 12, 1, tzinfo=timezone.utc)),
        )
        self.assertTrue(classification_processor.process(pending))
        classified_event = classification_producer.emitted[-1]

        self.assertEqual(classified_event["classification_status"], "classified")
        self.assertEqual(classified_event["root_topic_id"], 11000000)
        self.assertEqual(classified_event["primary_topic_id"], 11000000)
        self.assertEqual(len(classified_event["topic_candidates"]), 3)
        self.assertEqual(cleaned_repo.rows[pending.article_id]["classification_status"], "classified")

        classified = replace(
            pending,
            root_topic_id=classified_event["root_topic_id"],
            root_topic_label=classified_event["root_topic_label"],
            primary_topic_id=classified_event["primary_topic_id"],
            primary_topic_label=classified_event["primary_topic_label"],
            topic_confidence=classified_event["topic_confidence"],
            topic_candidates=tuple(classified_event["topic_candidates"]),
            classification_status=classified_event["classification_status"],
            classification_method=classified_event["classification_method"],
            classification_model=classified_event["classification_model"],
            classified_at=datetime.fromisoformat(classified_event["classified_at"]),
            classification_input_hash=classified_event["classification_input_hash"],
            processed_at=datetime.fromisoformat(classified_event["processed_at"]),
        )

        qdrant = InMemoryQdrantClient()
        state_repo = InMemoryProjectionStateRepository()
        fanout = ProjectionFanout(
            redis=redis_projector,
            qdrant=QdrantArticleProjector(
                qdrant=qdrant,
                vectors=InMemoryArticleVectorGateway({classified.article_id: (0.11, 0.22, 0.33)}),
            ),
            projection_state=state_repo,
        )
        first_projection = fanout.project(classified)

        self.assertTrue(first_projection.redis.updated_topic_feeds)
        self.assertTrue(first_projection.qdrant.projected)
        self.assertIn(classified.article_id, redis.sorted_sets["feed:topic:11000000"])
        self.assertIn(classified.article_id, redis.sorted_sets["feed:country:504:topic:11000000"])

        point = qdrant.points[qdrant_point_id(classified)]
        self.assertEqual(point["payload"]["country_id"], 504)
        self.assertEqual(point["payload"]["root_topic_id"], 11000000)
        self.assertTrue(point["payload"]["is_visible"])
        self.assertEqual(state_repo.rows[classified.article_id].country_id, 504)
        self.assertEqual(state_repo.rows[classified.article_id].root_topic_id, 11000000)

        replay_projection = fanout.project(classified)
        self.assertTrue(replay_projection.replay_skipped)
        self.assertEqual(qdrant.upsert_count, 1)
        self.assertIn(classified.article_id, redis.sorted_sets["feed:topic:11000000"])

        hidden = replace(classified, is_visible=False, is_deleted=True)
        delete_projection = fanout.project(hidden)
        self.assertTrue(delete_projection.redis.removed)
        self.assertFalse(qdrant.points[qdrant_point_id(classified)]["payload"]["is_visible"])
        self.assertNotIn(f"article:{classified.article_id}", redis.hashes)
        self.assertNotIn(classified.article_id, redis.sorted_sets["feed:global"])
        self.assertNotIn(classified.article_id, redis.sorted_sets["feed:country:504"])
        self.assertNotIn(classified.article_id, redis.sorted_sets["feed:topic:11000000"])
        self.assertNotIn(classified.article_id, redis.sorted_sets["feed:country:504:topic:11000000"])


if __name__ == "__main__":
    unittest.main()
