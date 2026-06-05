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
from imperium_news_pipeline.phase3.elasticsearch_projection import (
    ElasticsearchArticleProjector,
    InMemoryElasticsearchClient,
)


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


class ElasticsearchProjectionTests(unittest.TestCase):
    def test_elasticsearch_projection_indexes_title_body_and_filter_fields(self) -> None:
        article = _article()
        elasticsearch = InMemoryElasticsearchClient()
        projector = ElasticsearchArticleProjector(elasticsearch)

        result = projector.project(article)

        self.assertTrue(result.projected)
        document = elasticsearch.documents["imperium_articles_search"]["91"]
        self.assertEqual(document["title"], "Searchable story")
        self.assertEqual(document["body_text_clean"], "alpha beta gamma")
        self.assertEqual(document["country_id"], 504)
        self.assertEqual(document["source_name"], "Example Source")
        self.assertEqual(document["source_domain"], "news.example")
        self.assertEqual(document["language_code"], "en")
        self.assertEqual(document["published_at"], "2026-04-24T08:30:00+00:00")
        self.assertTrue(document["is_visible"])

    def test_elasticsearch_projection_deletes_unsearchable_article(self) -> None:
        article = _article()
        hidden = type(article)(**{**article.__dict__, "body_text_clean": "", "body_text": ""})
        elasticsearch = InMemoryElasticsearchClient()
        projector = ElasticsearchArticleProjector(elasticsearch)
        projector.project(article)

        result = projector.project(hidden)

        self.assertTrue(result.removed)
        self.assertNotIn("91", elasticsearch.documents["imperium_articles_search"])
        self.assertEqual(elasticsearch.deleted, [("imperium_articles_search", "91")])

    def test_elasticsearch_projection_captures_write_failures(self) -> None:
        result = ElasticsearchArticleProjector(InMemoryElasticsearchClient(fail_writes=True)).project(_article())

        self.assertEqual(result.errors, ("elasticsearch unavailable",))


def _article():
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
            id=91,
            link_id=10,
            authority_id=2,
            rubrique_id=3,
            langue_id=6,
            more_title="Searchable story",
            more_url="https://news.example/searchable",
            more_inner_text="alpha beta gamma",
            pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
            valide=True,
        )
    ).article
    return type(article)(
        **{
            **article.__dict__,
            "country_id": 504,
            "country_name": "Morocco",
            "source_name": "Example Source",
            "source_domain": "news.example",
            "language_code": "en",
        }
    )


if __name__ == "__main__":
    unittest.main()
