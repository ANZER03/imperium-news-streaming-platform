from __future__ import annotations

import json

from imperium_news_pipeline.phase3.runtime_adapters import build_embedding_gateway, _postgres_connection_factory
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.embedding_gateway import EmbeddingRequestItem
from imperium_news_pipeline.phase3.topics import TopicEmbeddingInputBuilder, TopicTaxonomyService, seed_phase3_topics


UPSERT_TOPIC_SQL = """
INSERT INTO phase3_topic_taxonomy (
    topic_id, parent_topic_id, topic_key, display_name, description, tags, sub_topics, translations,
    model_hint, taxonomy_version, is_active, review_status, updated_at
)
VALUES (
    %(topic_id)s, %(parent_topic_id)s, %(topic_key)s, %(display_name)s, %(description)s, %(tags)s,
    %(sub_topics)s, %(translations)s, %(model_hint)s, %(taxonomy_version)s, %(is_active)s, 'approved', now()
)
ON CONFLICT (topic_id) DO UPDATE SET
    parent_topic_id = EXCLUDED.parent_topic_id,
    topic_key = EXCLUDED.topic_key,
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    tags = EXCLUDED.tags,
    sub_topics = EXCLUDED.sub_topics,
    translations = EXCLUDED.translations,
    model_hint = EXCLUDED.model_hint,
    taxonomy_version = EXCLUDED.taxonomy_version,
    is_active = EXCLUDED.is_active,
    review_status = 'approved',
    updated_at = now()
"""


UPSERT_EMBEDDING_SQL = """
INSERT INTO phase3_topic_embeddings (
    topic_id, taxonomy_version, embedding_model, embedding_dimension,
    embedding_input_text, embedding_input_hash, embedding_vector, is_active, updated_at
)
VALUES (
    %(topic_id)s, %(taxonomy_version)s, %(embedding_model)s, %(embedding_dimension)s,
    %(embedding_input_text)s, %(embedding_input_hash)s, %(embedding_vector)s, true, now()
)
ON CONFLICT (topic_id, taxonomy_version, embedding_model) DO UPDATE SET
    embedding_dimension = EXCLUDED.embedding_dimension,
    embedding_input_text = EXCLUDED.embedding_input_text,
    embedding_input_hash = EXCLUDED.embedding_input_hash,
    embedding_vector = EXCLUDED.embedding_vector,
    is_active = true,
    updated_at = now()
"""


def main() -> None:
    config = Phase3RuntimeConfig.from_env()
    gateway = build_embedding_gateway(config)
    topics = seed_phase3_topics()
    taxonomy_service = TopicTaxonomyService(_SeedTaxonomyRepository(topics))
    builder = TopicEmbeddingInputBuilder(embedding_model=config.nvidia.embedding_model)

    topic_inputs = []
    for topic in topics:
        root = taxonomy_service.root_for_leaf(topic.topic_id, topic.taxonomy_version)
        topic_inputs.append(builder.build(topic, root))

    result = gateway.embed(tuple(EmbeddingRequestItem(str(item.topic_id), item.input_text) for item in topic_inputs))
    if result.failures:
        raise RuntimeError(f"topic embedding refresh failures: {result.failures}")

    connection = _postgres_connection_factory(config.postgres.dsn)()
    with connection.cursor() as cursor:
        cursor.executemany(
            UPSERT_TOPIC_SQL,
            tuple(
                {
                    "topic_id": topic.topic_id,
                    "parent_topic_id": topic.parent_topic_id,
                    "topic_key": topic.topic_key,
                    "display_name": topic.display_name,
                    "description": topic.description,
                    "tags": json.dumps(list(topic.tags)),
                    "sub_topics": json.dumps(list(topic.sub_topics)),
                    "translations": json.dumps([translation.to_mapping() for translation in topic.translations]),
                    "model_hint": topic.model_hint,
                    "taxonomy_version": topic.taxonomy_version,
                    "is_active": topic.is_active,
                }
                for topic in topics
            ),
        )
        cursor.executemany(
            UPSERT_EMBEDDING_SQL,
            tuple(
                {
                    "topic_id": item.topic_id,
                    "taxonomy_version": item.taxonomy_version,
                    "embedding_model": item.embedding_model,
                    "embedding_dimension": len(result.embeddings[str(item.topic_id)]),
                    "embedding_input_text": item.input_text,
                    "embedding_input_hash": item.input_hash,
                    "embedding_vector": list(result.embeddings[str(item.topic_id)]),
                }
                for item in topic_inputs
            ),
        )
    connection.commit()
    print(f"phase3-topic-embedding-refresh topics={len(topics)} embeddings={len(topic_inputs)}")


class _SeedTaxonomyRepository:
    def __init__(self, topics):
        self._topics = tuple(topics)

    def list_active_topics(self, taxonomy_version=None):
        return tuple(
            topic
            for topic in self._topics
            if topic.is_active and (taxonomy_version is None or topic.taxonomy_version == taxonomy_version)
        )


if __name__ == "__main__":
    main()
