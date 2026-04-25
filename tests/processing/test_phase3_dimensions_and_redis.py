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
from imperium_news_pipeline.phase3.dimensions import (
    DimensionEnrichmentService,
    DimensionMaterializer,
    InMemoryDimensionEventProducer,
    InMemoryDimensionRepository,
    authority_dimension,
    country_dimension,
    link_dimension,
    rubric_dimension,
    sedition_dimension,
)
from imperium_news_pipeline.phase3.redis_projection import InMemoryRedisClient, RedisFeedProjector


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


class DimensionAndRedisProjectionTests(unittest.TestCase):
    def test_dimension_materializer_upserts_filtered_records_and_publishes_compacted_events(self) -> None:
        repository = InMemoryDimensionRepository()
        producer = InMemoryDimensionEventProducer()
        materializer = DimensionMaterializer(repository=repository, event_producer=producer)

        changed = materializer.materialize(
            link_dimension(
                {
                    "id": 10,
                    "url": "https://source.test",
                    "domain": "source.test",
                    "source_name": "Source",
                    "pays_id": 504,
                    "irrelevant_column": "discarded",
                }
            )
        )

        record = repository.get("links", 10)
        self.assertTrue(changed)
        self.assertIsNotNone(record)
        self.assertEqual(record.compacted_topic_key, "links:10")
        self.assertEqual(record.payload["source_domain"], "source.test")
        self.assertNotIn("irrelevant_column", record.payload)
        self.assertEqual(producer.published, [record])

    def test_deleted_dimension_becomes_inactive_and_is_not_used_for_enrichment(self) -> None:
        repository = InMemoryDimensionRepository()
        materializer = DimensionMaterializer(repository=repository)

        materializer.materialize(rubric_dimension({"id": 8, "title": "Politics"}))
        materializer.materialize(rubric_dimension({"id": 8, "title": "Politics", "__deleted": True}))

        self.assertIsNone(repository.get("rubrics", 8))

    def test_country_resolution_prefers_authority_sedition_and_falls_back_to_link_country(self) -> None:
        repository = InMemoryDimensionRepository()
        materializer = DimensionMaterializer(repository=repository)
        materializer.materialize(link_dimension({"id": 1, "domain": "fallback.test", "pays_id": 504}))
        materializer.materialize(authority_dimension({"id": 2, "name": "Authority", "sedition_id": 30}))
        materializer.materialize(sedition_dimension({"id": 30, "pays_id": 250}))
        materializer.materialize(country_dimension({"id": 250, "name": "France"}))
        materializer.materialize(country_dimension({"id": 504, "name": "Morocco"}))

        snapshot = DimensionEnrichmentService(repository).snapshot_for(1, 2, None, None)
        fallback_snapshot = DimensionEnrichmentService(repository).snapshot_for(1, None, None, None)

        self.assertEqual(snapshot.country_id, 250)
        self.assertEqual(snapshot.country_name, "France")
        self.assertEqual(snapshot.source_name, "Authority")
        self.assertEqual(fallback_snapshot.country_id, 504)
        self.assertEqual(fallback_snapshot.country_name, "Morocco")

    def test_canonical_processing_uses_curated_dimensions_without_blocking_optional_missing_data(self) -> None:
        repository = InMemoryDimensionRepository()
        materializer = DimensionMaterializer(repository=repository)
        materializer.materialize(link_dimension({"id": 7, "domain": "link.test", "pays_id": 504}))
        materializer.materialize(country_dimension({"id": 504, "name": "Morocco"}))

        processor = CanonicalArticleFirstEmitProcessor(
            builder=CanonicalArticleBuilder(
                id_provider=NewsArticleIdProvider(),
                clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
            ),
            repository=InMemoryCleanedArticleRepository(),
            producer=InMemoryCanonicalArticleProducer(),
            dimension_enrichment=DimensionEnrichmentService(repository),
        )

        result = processor.process(
            RawNewsRecord(
                id=99,
                link_id=7,
                authority_id=200,
                rubrique_id=300,
                more_title="Visible before all dimensions arrive",
                more_url="https://example.test/99",
                pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
                valide=True,
            )
        )

        self.assertTrue(result.emitted)
        self.assertTrue(result.article.is_visible)
        self.assertEqual(result.article.country_id, 504)
        self.assertEqual(result.article.dimension_status, "partial")
        self.assertIn("authority", result.article.missing_dimensions)
        self.assertIn("rubric", result.article.missing_dimensions)

    def test_redis_projector_writes_compact_card_and_global_country_feeds(self) -> None:
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
                id=44,
                link_id=1,
                authority_id=2,
                rubrique_id=3,
                more_title="Feed story",
                more_url="https://example.test/feed",
                more_inner_text="Body text must stay out of redis cards.",
                pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
                valide=True,
            )
        ).article
        article = type(article)(**{**article.__dict__, "country_id": 504, "country_name": "Morocco"})
        redis = InMemoryRedisClient()

        result = RedisFeedProjector(redis).project(article)

        self.assertTrue(result.projected)
        self.assertIn("article:news:44", redis.hashes)
        self.assertNotIn("body_text", redis.hashes["article:news:44"])
        self.assertIn("news:44", redis.sorted_sets["feed:global"])
        self.assertIn("news:44", redis.sorted_sets["feed:country:504"])

    def test_redis_projector_removes_hidden_articles_and_captures_failures(self) -> None:
        processor = CanonicalArticleFirstEmitProcessor(
            builder=CanonicalArticleBuilder(
                id_provider=NewsArticleIdProvider(),
                clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
            ),
            repository=InMemoryCleanedArticleRepository(),
            producer=InMemoryCanonicalArticleProducer(),
        )
        visible = processor.process(
            RawNewsRecord(
                id=45,
                link_id=1,
                authority_id=2,
                rubrique_id=3,
                more_title="Feed story",
                more_url="https://example.test/feed",
                pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
                valide=True,
            )
        ).article
        hidden = type(visible)(**{**visible.__dict__, "is_visible": False})
        redis = InMemoryRedisClient()
        projector = RedisFeedProjector(redis)
        projector.project(visible)

        removed = projector.project(hidden)
        failed = RedisFeedProjector(InMemoryRedisClient(fail_writes=True)).project(visible)

        self.assertTrue(removed.removed)
        self.assertNotIn("article:news:45", redis.hashes)
        self.assertNotIn("news:45", redis.sorted_sets["feed:global"])
        self.assertEqual(failed.errors, ("redis unavailable",))


if __name__ == "__main__":
    unittest.main()
