from __future__ import annotations

import json
import os
import time
import urllib.request
from hashlib import sha256

import psycopg

from imperium_news_pipeline.phase3.topics import (
    TopicEmbeddingInput,
    TopicEmbeddingInputBuilder,
    TopicTaxonomyService,
    seed_phase3_topics,
)

# ---------------------------------------------------------------------------
# DDL — drop+recreate so the schema always matches the current definition
# ---------------------------------------------------------------------------

_DROP_EMBEDDINGS = "DROP TABLE IF EXISTS imperium_topic_embeddings CASCADE;"
_DROP_TAXONOMY   = "DROP TABLE IF EXISTS imperium_topic_taxonomy CASCADE;"

_DDL_TAXONOMY = """
CREATE TABLE IF NOT EXISTS imperium_topic_taxonomy (
    topic_id          text PRIMARY KEY,
    parent_topic_id   text REFERENCES imperium_topic_taxonomy (topic_id),
    topic_key         text NOT NULL,
    display_name      text NOT NULL,
    description       text NOT NULL,
    taxonomy_version  text NOT NULL,
    is_active         boolean NOT NULL DEFAULT true,
    review_status     text NOT NULL DEFAULT 'draft',
    embedding_seeds   jsonb NOT NULL DEFAULT '[]'::jsonb,
    signals_strong    jsonb NOT NULL DEFAULT '[]'::jsonb,
    signals_medium    jsonb NOT NULL DEFAULT '[]'::jsonb,
    signals_weak      jsonb NOT NULL DEFAULT '[]'::jsonb,
    dimensions_event  jsonb NOT NULL DEFAULT '[]'::jsonb,
    dimensions_impact jsonb NOT NULL DEFAULT '[]'::jsonb,
    dimensions_actors jsonb NOT NULL DEFAULT '[]'::jsonb,
    reviewed_by       text,
    reviewed_at       timestamp with time zone,
    created_at        timestamp with time zone NOT NULL DEFAULT now(),
    updated_at        timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT imperium_topic_taxonomy_topic_key_version_key
        UNIQUE (topic_key, taxonomy_version),
    CONSTRAINT imperium_topic_taxonomy_review_status_check
        CHECK (review_status IN ('draft', 'approved', 'rejected'))
);
CREATE INDEX IF NOT EXISTS imperium_topic_taxonomy_parent_idx
    ON imperium_topic_taxonomy (parent_topic_id);
CREATE INDEX IF NOT EXISTS imperium_topic_taxonomy_active_version_idx
    ON imperium_topic_taxonomy (taxonomy_version, is_active);
"""

_DDL_EMBEDDINGS = """
CREATE TABLE IF NOT EXISTS imperium_topic_embeddings (
    topic_id             text NOT NULL REFERENCES imperium_topic_taxonomy (topic_id),
    taxonomy_version     text NOT NULL,
    embedding_model      text NOT NULL,
    embedding_dimension  integer NOT NULL,
    embedding_input_text text NOT NULL,
    embedding_input_hash text NOT NULL,
    embedding_vector     double precision[] NOT NULL,
    is_active            boolean NOT NULL DEFAULT true,
    created_at           timestamp with time zone NOT NULL DEFAULT now(),
    updated_at           timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (topic_id, taxonomy_version, embedding_model)
);
CREATE INDEX IF NOT EXISTS imperium_topic_embeddings_active_idx
    ON imperium_topic_embeddings (taxonomy_version, embedding_model, is_active);
"""

_INSERT_TOPIC = """
INSERT INTO imperium_topic_taxonomy (
    topic_id, parent_topic_id, topic_key, display_name, description,
    taxonomy_version, is_active, review_status,
    embedding_seeds,
    signals_strong, signals_medium, signals_weak,
    dimensions_event, dimensions_impact, dimensions_actors,
    updated_at
) VALUES (
    %(topic_id)s, %(parent_topic_id)s, %(topic_key)s, %(display_name)s, %(description)s,
    %(taxonomy_version)s, %(is_active)s, 'approved',
    %(embedding_seeds)s,
    %(signals_strong)s, %(signals_medium)s, %(signals_weak)s,
    %(dimensions_event)s, %(dimensions_impact)s, %(dimensions_actors)s,
    now()
)
"""

_INSERT_EMBEDDING = """
INSERT INTO imperium_topic_embeddings (
    topic_id, taxonomy_version, embedding_model, embedding_dimension,
    embedding_input_text, embedding_input_hash, embedding_vector, is_active, updated_at
) VALUES (
    %(topic_id)s, %(taxonomy_version)s, %(embedding_model)s, %(embedding_dimension)s,
    %(embedding_input_text)s, %(embedding_input_hash)s, %(embedding_vector)s, true, now()
)
"""


# ---------------------------------------------------------------------------
# llama-cpp embedding via OpenAI-compatible /v1/embeddings
# ---------------------------------------------------------------------------

def _embed_with_llamacpp(
    base_url: str,
    model: str,
    texts: list[str],
    batch_size: int = 13,
    max_retries: int = 5,
    backoff: float = 2.0,
) -> list[list[float]]:
    url = f"{base_url.rstrip('/')}/v1/embeddings"
    all_vectors: list[list[float]] = []

    for i in range(0, len(texts), batch_size):
        chunk = texts[i : i + batch_size]
        payload = json.dumps({"model": model, "input": chunk}).encode()
        attempt = 0
        while True:
            try:
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=60) as resp:
                    body = json.loads(resp.read())
                items = sorted(body["data"], key=lambda x: x["index"])
                all_vectors.extend(item["embedding"] for item in items)
                break
            except Exception as exc:
                attempt += 1
                if attempt > max_retries:
                    raise RuntimeError(
                        f"llama-cpp embedding failed after {max_retries} retries: {exc}"
                    ) from exc
                wait = backoff * (2 ** (attempt - 1))
                print(f"  [retry {attempt}/{max_retries}] {exc} — waiting {wait:.1f}s")
                time.sleep(wait)

    return all_vectors


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    dsn = os.environ.get(
        "POSTGRES_DSN",
        "postgresql://postgres:postgres@localhost:35432/imperium-news-source",
    )
    llama_base_url  = os.environ.get("LLAMA_CPP_BASE_URL", "http://llama-cpp:8080")
    embedding_model = os.environ.get("NVIDIA_EMBEDDING_MODEL", "embeddinggemma-300M-Q8_0.gguf")
    taxonomy_version = os.environ.get("TAXONOMY_VERSION", "medtop-v2")
    batch_size = int(os.environ.get("EMBEDDING_BATCH_SIZE", "13"))

    print("imperium-topic-embedding-refresh starting")
    print(f"  llama-cpp: {llama_base_url}")
    print(f"  model:     {embedding_model}")
    print(f"  version:   {taxonomy_version}")

    topics = seed_phase3_topics(taxonomy_version)
    taxonomy_service = TopicTaxonomyService(_SeedRepo(topics))
    builder = TopicEmbeddingInputBuilder(embedding_model=embedding_model)

    topic_inputs: list[TopicEmbeddingInput] = []
    for topic in topics:
        root = taxonomy_service.root_for_leaf(topic.topic_id, topic.taxonomy_version)
        inp = builder.build(topic, root)
        topic_inputs.append(inp)

    print(f"  topics={len(topics)}  embedding input texts:")
    for inp in topic_inputs:
        print(f"    [{inp.topic_id}]")
        for line in inp.input_text.splitlines():
            print(f"      {line}")

    texts = [inp.input_text for inp in topic_inputs]
    print(f"  calling llama-cpp for {len(texts)} embeddings (batch={batch_size})...")
    vectors = _embed_with_llamacpp(
        base_url=llama_base_url,
        model=embedding_model,
        texts=texts,
        batch_size=batch_size,
    )

    if len(vectors) != len(topic_inputs):
        raise RuntimeError(
            f"vector count mismatch: got {len(vectors)}, expected {len(topic_inputs)}"
        )

    print(f"  embeddings received — dimension={len(vectors[0])}")

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            print("  dropping old tables and recreating schema...")
            cur.execute(_DROP_EMBEDDINGS)
            cur.execute(_DROP_TAXONOMY)
            cur.execute(_DDL_TAXONOMY)
            cur.execute(_DDL_EMBEDDINGS)

            print("  inserting topics...")
            for topic in topics:
                cur.execute(
                    _INSERT_TOPIC,
                    {
                        "topic_id":          topic.topic_id,
                        "parent_topic_id":   topic.parent_topic_id,
                        "topic_key":         topic.topic_key,
                        "display_name":      topic.display_name,
                        "description":       topic.description,
                        "taxonomy_version":  topic.taxonomy_version,
                        "is_active":         topic.is_active,
                        "embedding_seeds":   json.dumps(list(topic.embedding_seeds)),
                        "signals_strong":    json.dumps(list(topic.signals.strong)),
                        "signals_medium":    json.dumps(list(topic.signals.medium)),
                        "signals_weak":      json.dumps(list(topic.signals.weak)),
                        "dimensions_event":  json.dumps(list(topic.dimensions.event)),
                        "dimensions_impact": json.dumps(list(topic.dimensions.impact)),
                        "dimensions_actors": json.dumps(list(topic.dimensions.actors)),
                    },
                )

            print("  inserting embeddings...")
            for inp, vector in zip(topic_inputs, vectors):
                cur.execute(
                    _INSERT_EMBEDDING,
                    {
                        "topic_id":             inp.topic_id,
                        "taxonomy_version":     inp.taxonomy_version,
                        "embedding_model":      inp.embedding_model,
                        "embedding_dimension":  len(vector),
                        "embedding_input_text": inp.input_text,
                        "embedding_input_hash": inp.input_hash,
                        "embedding_vector":     vector,
                    },
                )

        conn.commit()

    print(
        f"imperium-topic-embedding-refresh done  "
        f"topics={len(topics)}  embeddings={len(topic_inputs)}  dim={len(vectors[0])}"
    )


class _SeedRepo:
    def __init__(self, topics):
        self._topics = tuple(topics)

    def list_active_topics(self, taxonomy_version=None):
        return tuple(
            t for t in self._topics
            if t.is_active and (taxonomy_version is None or t.taxonomy_version == taxonomy_version)
        )


if __name__ == "__main__":
    main()
