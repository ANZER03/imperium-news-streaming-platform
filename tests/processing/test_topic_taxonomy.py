from __future__ import annotations

import unittest

from imperium_news_pipeline.phase3.topics import (
    DEFAULT_EMBEDDING_MODEL,
    InMemoryTopicEmbeddingRepository,
    InMemoryTopicTaxonomyRepository,
    Topic,
    TopicEmbedding,
    TopicEmbeddingInputBuilder,
    TopicTaxonomyService,
    seed_phase3_topics,
    topic_record_json,
)


class TopicTaxonomyTests(unittest.TestCase):
    def test_seed_taxonomy_has_root_medtop_topics(self) -> None:
        topics = seed_phase3_topics()
        service = TopicTaxonomyService(InMemoryTopicTaxonomyRepository(topics))

        leaves = service.active_leaf_topics()
        root = service.root_for_leaf(13000000)

        self.assertEqual(len(topics), 17)
        self.assertIn(13000000, [topic.topic_id for topic in leaves])
        self.assertEqual(root.topic_key, "science.and.technology")
        self.assertTrue(all(topic.parent_topic_id is None for topic in leaves))

    def test_topic_metadata_contains_multilingual_embedding_input_fields(self) -> None:
        topic = next(topic for topic in seed_phase3_topics() if topic.topic_id == 13000000)
        root = next(topic for topic in seed_phase3_topics() if topic.topic_id == 13000000)

        embedding_input = TopicEmbeddingInputBuilder().build(topic, root)

        self.assertEqual(embedding_input.embedding_model, DEFAULT_EMBEDDING_MODEL)
        self.assertIn("Topic: Science and technology", embedding_input.input_text)
        self.assertIn("Description:", embedding_input.input_text)
        self.assertIn("Sub-topics:", embedding_input.input_text)
        self.assertIn("Technology", embedding_input.input_text)
        self.assertEqual(len(embedding_input.input_hash), 64)

    def test_embedding_regeneration_detects_metadata_model_and_version_changes(self) -> None:
        builder = TopicEmbeddingInputBuilder()
        topic = Topic(
            topic_id=900,
            topic_key="test.topic",
            display_name="Test Topic",
            description="Original description",
            taxonomy_version="v1",
            parent_topic_id=100,
        )
        original_input = builder.build(topic)
        existing = TopicEmbedding(
            topic_id=900,
            taxonomy_version="v1",
            embedding_model=DEFAULT_EMBEDDING_MODEL,
            embedding_dimension=3,
            embedding_input_text=original_input.input_text,
            embedding_input_hash=original_input.input_hash,
            embedding_vector=(0.1, 0.2, 0.3),
        )

        changed_topic = Topic(
            topic_id=900,
            topic_key="test.topic",
            display_name="Test Topic",
            description="Changed description",
            taxonomy_version="v1",
            parent_topic_id=100,
        )

        self.assertFalse(builder.needs_regeneration(existing, original_input))
        self.assertTrue(builder.needs_regeneration(existing, builder.build(changed_topic)))
        self.assertTrue(
            TopicEmbeddingInputBuilder(embedding_model="other-model").needs_regeneration(
                existing,
                TopicEmbeddingInputBuilder(embedding_model="other-model").build(topic),
            )
        )

    def test_classifier_can_load_active_topic_embeddings(self) -> None:
        repository = InMemoryTopicEmbeddingRepository(
            (
                TopicEmbedding(
                    topic_id=13000000,
                    taxonomy_version="phase3-v1",
                    embedding_model=DEFAULT_EMBEDDING_MODEL,
                    embedding_dimension=3,
                    embedding_input_text="active",
                    embedding_input_hash="a",
                    embedding_vector=(0.1, 0.2, 0.3),
                    is_active=True,
                ),
                TopicEmbedding(
                    topic_id=4000000,
                    taxonomy_version="phase3-v1",
                    embedding_model=DEFAULT_EMBEDDING_MODEL,
                    embedding_dimension=3,
                    embedding_input_text="inactive",
                    embedding_input_hash="b",
                    embedding_vector=(0.1, 0.2, 0.3),
                    is_active=False,
                ),
            )
        )

        embeddings = repository.list_active_embeddings(
            taxonomy_version="phase3-v1",
            embedding_model=DEFAULT_EMBEDDING_MODEL,
        )

        self.assertEqual([embedding.topic_id for embedding in embeddings], [13000000])

    def test_topic_record_preserves_glossary_terms(self) -> None:
        record = topic_record_json(seed_phase3_topics()[0])

        self.assertIn("taxonomy_version", record)
        self.assertIn("parent_topic_id", record)
        self.assertIn("model_hint", record)
        self.assertIn("sub_topics", record)


if __name__ == "__main__":
    unittest.main()
