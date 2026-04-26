from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import unittest

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.canonical import InMemoryCanonicalArticleProducer, InMemoryCleanedArticleRepository
from imperium_news_pipeline.phase3.dimensions import InMemoryDimensionRepository
from imperium_news_pipeline.phase3.pending_feed_runtime import (
    PendingCanonicalFeedRuntime,
    dimension_record_from_change,
)
from imperium_news_pipeline.phase3.redis_projection import InMemoryRedisClient, RedisFeedProjector


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


class Phase3PendingFeedRuntimeTests(unittest.TestCase):
    def test_materializes_curated_dimensions_from_real_source_tables_and_delete_inactivates(self) -> None:
        decoder = DebeziumAvroCdcDecoder()
        repository = InMemoryDimensionRepository()
        runtime = _runtime(repository=repository)

        runtime.apply_dimension_change(
            decoder.decode(
                key={"id": 2},
                value={
                    "op": "c",
                    "source": {"schema": "public", "table": "table_authority"},
                    "after": {"id": 2, "authority": "Source", "domain": "source.test", "sedition_id": 30, "raw": "discard"},
                    "ts_ms": 1777200000000,
                },
            )
        )
        authority = repository.get("authorities", 2)
        self.assertIsNotNone(authority)
        self.assertEqual(authority.payload["source_name"], "Source")
        self.assertNotIn("raw", authority.payload)

        runtime.apply_dimension_change(
            decoder.decode(
                key={"id": 2},
                value={
                    "op": "d",
                    "source": {"schema": "public", "table": "table_authority"},
                    "before": {"id": 2, "authority": "Source", "domain": "source.test", "sedition_id": 30},
                    "ts_ms": 1777200000000,
                },
            )
        )
        self.assertIsNone(repository.get("authorities", 2))

    def test_pending_news_path_writes_cleaned_event_and_redis_before_classification(self) -> None:
        decoder = DebeziumAvroCdcDecoder()
        repository = InMemoryDimensionRepository()
        cleaned = InMemoryCleanedArticleRepository()
        producer = InMemoryCanonicalArticleProducer()
        redis = InMemoryRedisClient()
        runtime = _runtime(repository=repository, cleaned=cleaned, producer=producer, redis=redis)
        for change in _dimension_changes(decoder):
            runtime.apply_dimension_change(change)

        result = runtime.apply_news_change(
            decoder.decode(
                key={"id": 9001},
                value={
                    "op": "c",
                    "source": {"schema": "public", "table": "table_news"},
                    "after": {
                        "id": 9001,
                        "link_id": 10,
                        "authority_id": 2,
                        "rubrique_id": 3,
                        "langue_id": 6,
                        "more_title": "Visible before classification",
                        "more_url": "https://news.example/9001",
                        "more_inner_text": "Full body stays in PostgreSQL only.",
                        "pubdate": datetime(2026, 4, 25, 8, 30, tzinfo=timezone.utc),
                        "valide": True,
                    },
                    "ts_ms": 1777200000000,
                },
            )
        )

        self.assertTrue(result.emitted)
        self.assertEqual(result.article.country_id, 504)
        self.assertEqual(cleaned.rows["news:9001"]["classification_status"], "pending")
        self.assertEqual(producer.emitted[-1]["article_id"], "news:9001")
        self.assertIn("news:9001", redis.sorted_sets["feed:global"])
        self.assertIn("news:9001", redis.sorted_sets["feed:country:504"])
        self.assertNotIn("body_text", redis.hashes["article:news:9001"])

    def test_replay_and_outside_window_are_idempotent(self) -> None:
        decoder = DebeziumAvroCdcDecoder()
        repository = InMemoryDimensionRepository()
        cleaned = InMemoryCleanedArticleRepository()
        producer = InMemoryCanonicalArticleProducer()
        redis = InMemoryRedisClient()
        runtime = _runtime(repository=repository, cleaned=cleaned, producer=producer, redis=redis)
        for change in _dimension_changes(decoder):
            runtime.apply_dimension_change(change)

        news_change = decoder.decode(
            key={"id": 9002},
            value={
                "op": "c",
                "source": {"schema": "public", "table": "table_news"},
                "after": {
                    "id": 9002,
                    "link_id": 10,
                    "authority_id": 2,
                    "more_title": "Replay safe",
                    "more_url": "https://news.example/9002",
                    "pubdate": datetime(2026, 4, 25, 8, 30, tzinfo=timezone.utc),
                    "valide": True,
                },
                "ts_ms": 1777200000000,
            },
        )
        first = runtime.apply_news_change(news_change)
        replay = runtime.apply_news_change(news_change)

        self.assertTrue(first.emitted)
        self.assertFalse(replay.emitted)
        self.assertEqual(len(producer.emitted), 1)
        self.assertEqual(len(cleaned.rows), 1)
        self.assertEqual(redis.sorted_sets["feed:global"]["news:9002"], redis.sorted_sets["feed:global"]["news:9002"])

        old = runtime.apply_news_change(
            decoder.decode(
                key={"id": 1},
                value={
                    "op": "c",
                    "source": {"schema": "public", "table": "table_news"},
                    "after": {
                        "id": 1,
                        "more_title": "Old",
                        "more_url": "https://news.example/old",
                        "pubdate": datetime(2026, 4, 1, tzinfo=timezone.utc),
                        "valide": True,
                    },
                    "ts_ms": 1777200000000,
                },
            )
        )
        self.assertEqual(old.skipped_reason, "outside-window")
        self.assertNotIn("news:1", cleaned.rows)

    def test_dimension_record_from_change_rejects_unsupported_tables(self) -> None:
        decoder = DebeziumAvroCdcDecoder()
        change = decoder.decode(
            key={"id": 1},
            value={
                "op": "c",
                "source": {"schema": "public", "table": "table_news"},
                "after": {"id": 1},
                "ts_ms": 1777200000000,
            },
        )
        with self.assertRaisesRegex(ValueError, "unsupported dimension source table"):
            dimension_record_from_change(change)


def _runtime(
    *,
    repository: InMemoryDimensionRepository,
    cleaned: InMemoryCleanedArticleRepository | None = None,
    producer: InMemoryCanonicalArticleProducer | None = None,
    redis: InMemoryRedisClient | None = None,
) -> PendingCanonicalFeedRuntime:
    return PendingCanonicalFeedRuntime.from_repositories(
        dimension_repository=repository,
        cleaned_articles=cleaned or InMemoryCleanedArticleRepository(),
        canonical_producer=producer or InMemoryCanonicalArticleProducer(),
        redis_projector=RedisFeedProjector(redis or InMemoryRedisClient()),
        clock=FixedClock(datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)),
    )


def _dimension_changes(decoder: DebeziumAvroCdcDecoder):
    for table, after in (
        ("table_links", {"id": 10, "link": "https://news.example/9001", "domain": "news.example", "title": "Link Source", "pays_id": 250}),
        ("table_authority", {"id": 2, "authority": "Authority Source", "domain": "authority.example", "sedition_id": 30}),
        ("table_sedition", {"id": 30, "pays_id": 504}),
        ("table_pays", {"id": 504, "pays": "Morocco", "abr": "MA"}),
        ("table_rubrique", {"id": 3, "rubrique": "Politics"}),
        ("table_langue", {"id": 6, "langue": "French", "abr": "fr"}),
    ):
        yield decoder.decode(
            key={"id": after["id"]},
            value={"op": "c", "source": {"schema": "public", "table": table}, "after": after, "ts_ms": 1777200000000},
        )


if __name__ == "__main__":
    unittest.main()
