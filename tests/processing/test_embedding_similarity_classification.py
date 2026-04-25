from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import unittest

from imperium_news_pipeline.phase3.canonical import (
    CanonicalArticleBuilder,
    InMemoryCanonicalArticleProducer,
    InMemoryCleanedArticleRepository,
    NewsArticleIdProvider,
    RawNewsRecord,
)
from imperium_news_pipeline.phase3.classification import (
    ArticleClassificationProcessor,
    EmbeddingSimilarityClassifier,
    classification_input_text,
)
from imperium_news_pipeline.phase3.embedding_gateway import (
    EmbeddingFailure,
    EmbeddingGatewayResult,
    EmbeddingRequestItem,
)
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
class RecordingGateway:
    vector: tuple[float, ...] | None
    calls: list[tuple[EmbeddingRequestItem, ...]] = field(default_factory=list)

    def embed(self, items) -> EmbeddingGatewayResult:
        item_tuple = tuple(items)
        self.calls.append(item_tuple)
        if self.vector is None:
            return EmbeddingGatewayResult(
                embeddings={},
                failures=(EmbeddingFailure(item_tuple[0].item_id, "provider failed"),),
            )
        return EmbeddingGatewayResult(embeddings={item_tuple[0].item_id: self.vector})


class EmbeddingSimilarityClassificationTests(unittest.TestCase):
    def test_classification_input_is_title_plus_first_30_cleaned_body_words(self) -> None:
        article = _article_with_body_words(40)

        input_text = classification_input_text(article)

        self.assertTrue(input_text.startswith("Market update\n"))
        self.assertEqual(len(input_text.splitlines()[1].split()), 30)
        self.assertIn("word29", input_text)
        self.assertNotIn("word30", input_text)

    def test_classifier_uses_gateway_and_active_leaf_topic_embeddings(self) -> None:
        gateway = RecordingGateway((1.0, 0.0))
        classifier = _classifier(gateway)
        article = _article_with_body_words(8)

        classified = classifier.classify(article)

        self.assertEqual(gateway.calls[0][0].item_id, article.article_id)
        self.assertEqual(classified.classification_status, "classified")
        self.assertEqual(classified.classification_method, "embedding_similarity")
        self.assertEqual(classified.primary_topic_id, 101)
        self.assertEqual(classified.primary_topic_label, "Elections")
        self.assertEqual(classified.root_topic_id, 100)
        self.assertEqual(classified.root_topic_label, "Politics")
        self.assertEqual(classified.topic_confidence, 1.0)
        self.assertEqual([candidate["topic_id"] for candidate in classified.topic_candidates], [101, 201, 301])
        self.assertEqual(classified.classification_model, DEFAULT_EMBEDDING_MODEL)
        self.assertEqual(len(classified.classification_input_hash or ""), 64)

    def test_classification_failure_keeps_article_visible_and_marks_failed(self) -> None:
        classifier = _classifier(RecordingGateway(None))
        article = _article_with_body_words(8)

        failed = classifier.classify(article)

        self.assertTrue(failed.is_visible)
        self.assertEqual(failed.classification_status, "failed")
        self.assertEqual(failed.classification_method, "embedding_similarity")
        self.assertIsNone(failed.primary_topic_id)
        self.assertEqual(failed.topic_candidates, ())

    def test_reclassification_updates_same_cleaned_article_row_with_latest_result(self) -> None:
        gateway = RecordingGateway((1.0, 0.0))
        classifier = _classifier(gateway)
        repository = InMemoryCleanedArticleRepository()
        producer = InMemoryCanonicalArticleProducer()
        processor = ArticleClassificationProcessor(
            classifier=classifier,
            repository=repository,
            producer=producer,
            clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
        )
        article = _article_with_body_words(8)

        self.assertTrue(processor.process(article))
        gateway.vector = (0.0, 1.0)
        self.assertTrue(processor.process(article))

        self.assertEqual(set(repository.rows), {article.article_id})
        self.assertEqual(repository.rows[article.article_id]["primary_topic_id"], 301)
        self.assertEqual(repository.rows[article.article_id]["root_topic_id"], 300)
        self.assertEqual(len(producer.emitted), 2)
        self.assertEqual(producer.emitted[-1]["primary_topic_id"], 301)


def _classifier(gateway: RecordingGateway) -> EmbeddingSimilarityClassifier:
    topics = seed_phase3_topics()
    return EmbeddingSimilarityClassifier(
        gateway=gateway,
        taxonomy_service=TopicTaxonomyService(InMemoryTopicTaxonomyRepository(topics)),
        topic_embedding_repository=InMemoryTopicEmbeddingRepository(
            (
                TopicEmbedding(
                    topic_id=101,
                    taxonomy_version="phase3-v1",
                    embedding_model=DEFAULT_EMBEDDING_MODEL,
                    embedding_dimension=2,
                    embedding_input_text="elections",
                    embedding_input_hash="a",
                    embedding_vector=(1.0, 0.0),
                ),
                TopicEmbedding(
                    topic_id=201,
                    taxonomy_version="phase3-v1",
                    embedding_model=DEFAULT_EMBEDDING_MODEL,
                    embedding_dimension=2,
                    embedding_input_text="markets",
                    embedding_input_hash="b",
                    embedding_vector=(0.8, 0.2),
                ),
                TopicEmbedding(
                    topic_id=301,
                    taxonomy_version="phase3-v1",
                    embedding_model=DEFAULT_EMBEDDING_MODEL,
                    embedding_dimension=2,
                    embedding_input_text="ai",
                    embedding_input_hash="c",
                    embedding_vector=(0.0, 1.0),
                ),
            )
        ),
    )


def _article_with_body_words(word_count: int):
    builder = CanonicalArticleBuilder(
        id_provider=NewsArticleIdProvider(),
        clock=FixedClock(datetime(2026, 4, 25, 11, 0, tzinfo=timezone.utc)),
    )
    return builder.build(
        RawNewsRecord(
            id=55,
            link_id=10,
            authority_id=20,
            more_title="Market update",
            more_url="https://example.test/article",
            more_inner_text=" ".join(f"word{index}" for index in range(word_count)),
            pubdate=datetime(2026, 4, 25, 10, 0, tzinfo=timezone.utc),
            valide=True,
        )
    )


if __name__ == "__main__":
    unittest.main()
