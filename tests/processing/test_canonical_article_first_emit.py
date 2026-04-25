from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import unittest

from imperium_news_pipeline.phase3.canonical import (
    CLASSIFICATION_STATUS_PENDING,
    CanonicalArticleBuilder,
    CanonicalArticleFirstEmitProcessor,
    InMemoryCanonicalArticleProducer,
    InMemoryCleanedArticleRepository,
    NewsArticleIdProvider,
    RawNewsRecord,
)
from imperium_news_pipeline.phase3.postgres import PostgresCleanedArticleRepository


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


class FakeCursor:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection = connection
        self.selected_article_id = None

    def __enter__(self) -> FakeCursor:
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def execute(self, query: str, params: dict[str, object]) -> None:
        self.connection.executed.append((query, params))
        if query.lstrip().startswith("SELECT"):
            self.selected_article_id = str(params["article_id"])
            return
        self.connection.rows[str(params["article_id"])] = dict(params)

    def fetchone(self) -> object:
        if self.selected_article_id in self.connection.rows:
            return (self.connection.rows[self.selected_article_id]["payload"],)
        return None


class FakeConnection:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, object]] = {}
        self.executed: list[tuple[str, dict[str, object]]] = []
        self.commits = 0

    def cursor(self) -> FakeCursor:
        return FakeCursor(self)

    def commit(self) -> None:
        self.commits += 1


class CanonicalArticleFirstEmitTests(unittest.TestCase):
    def test_builds_pending_canonical_article_from_raw_news(self) -> None:
        processed_at = datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)
        article = CanonicalArticleBuilder(
            id_provider=NewsArticleIdProvider(),
            clock=FixedClock(processed_at),
        ).build(
            RawNewsRecord(
                id=42,
                link_id=7,
                authority_id=11,
                rubrique_id=3,
                langue_id=1,
                more_title="  Big   Story ",
                more_url="https://example.test/story",
                more_inner_text="<p>One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twenty-one twenty-two twenty-three twenty-four twenty-five twenty-six twenty-seven twenty-eight twenty-nine thirty thirty-one.</p>",
                more_image_url="https://example.test/image.jpg",
                more_meta_keywords="news, test",
                pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
                crawl_date=datetime(2026, 4, 24, 9, 0, tzinfo=timezone.utc),
                valide=True,
            )
        )

        event = article.to_event()

        self.assertEqual(article.article_id, "news:42")
        self.assertEqual(article.source_news_id, 42)
        self.assertEqual(article.classification_status, CLASSIFICATION_STATUS_PENDING)
        self.assertIsNone(article.classification_method)
        self.assertEqual(article.title, "Big Story")
        self.assertEqual(article.url, "https://example.test/story")
        self.assertEqual(len(article.excerpt.split()), 30)
        self.assertTrue(article.is_valid)
        self.assertTrue(article.is_visible)
        self.assertEqual(event["schema_version"], 1)
        self.assertEqual(event["processed_at"], "2026-04-25T12:00:00+00:00")
        self.assertEqual(event["topic_candidates"], [])


    def test_process_upserts_cleaned_article_and_emits_once_for_identical_replay(self) -> None:
        processor = CanonicalArticleFirstEmitProcessor(
            builder=CanonicalArticleBuilder(
                id_provider=NewsArticleIdProvider(),
                clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
            ),
            repository=InMemoryCleanedArticleRepository(),
            producer=InMemoryCanonicalArticleProducer(),
        )
        raw = RawNewsRecord(
            id=100,
            link_id=1,
            authority_id=2,
            rubrique_id=3,
            more_title="Replay-safe story",
            more_url="https://example.test/replay",
            more_inner_text="Replay should converge on one cleaned record.",
            pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
            valide=True,
        )

        first = processor.process(raw)
        second = processor.process(raw)

        self.assertTrue(first.emitted)
        self.assertFalse(second.emitted)
        self.assertEqual(len(processor.repository.rows), 1)
        self.assertEqual(len(processor.producer.emitted), 1)
        self.assertEqual(processor.repository.rows["news:100"]["article_id"], "news:100")


    def test_missing_minimum_fields_are_not_visible_and_track_pending_required(self) -> None:
        article = CanonicalArticleBuilder(
            id_provider=NewsArticleIdProvider(),
            clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
        ).build(RawNewsRecord(id=8, more_title="", more_url="", valide=True))

        self.assertEqual(article.article_id, "news:8")
        self.assertFalse(article.is_valid)
        self.assertFalse(article.is_visible)
        self.assertEqual(article.dimension_status, "pending_required")
        self.assertEqual(
            article.missing_dimensions,
            (
                "title",
                "url",
                "published_at_or_crawled_at",
                "link_id",
                "authority_id",
                "rubric_id",
            ),
        )

    def test_postgres_repository_upserts_and_skips_identical_payload_replay(self) -> None:
        connection = FakeConnection()
        repository = PostgresCleanedArticleRepository(lambda: connection)
        payload = {
            "article_id": "news:300",
            "source_news_id": 300,
            "schema_version": 1,
            "classification_status": "pending",
            "dimension_status": "complete",
            "is_visible": True,
            "is_deleted": False,
            "published_at": "2026-04-24T08:30:00+00:00",
            "crawled_at": "2026-04-24T09:00:00+00:00",
            "processed_at": "2026-04-25T12:00:00+00:00",
        }

        first = repository.upsert(
            record=type("Record", (), {"article_id": "news:300", "source_news_id": 300, "payload": payload})()
        )
        second = repository.upsert(
            record=type("Record", (), {"article_id": "news:300", "source_news_id": 300, "payload": payload})()
        )

        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(len(connection.rows), 1)
        self.assertEqual(connection.commits, 1)


if __name__ == "__main__":
    unittest.main()
