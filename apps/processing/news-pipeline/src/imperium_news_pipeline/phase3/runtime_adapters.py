from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
import json
from urllib import error, request
from typing import Any, Mapping, Protocol, Sequence

from imperium_news_pipeline.phase3.canonical import CanonicalArticle
from imperium_news_pipeline.phase3.pending_feed_runtime import PendingCanonicalFeedRuntime
from imperium_news_pipeline.phase3.postgres import PostgresCleanedArticleRepository
from imperium_news_pipeline.phase3.redis_projection import RedisFeedProjector
from imperium_news_pipeline.phase3.runtime_config import NvidiaRuntimeConfig, Phase3RuntimeConfig
from imperium_news_pipeline.phase3.dimensions import DimensionRecord
from imperium_news_pipeline.phase3.postgres import ConnectionFactory
from imperium_news_pipeline.phase3.projection_state import ProjectionState
from imperium_news_pipeline.phase3.qdrant_projection import QdrantClient
from imperium_news_pipeline.phase3.redis_projection import RedisClient
from imperium_news_pipeline.phase3.topic_bootstrap import TopicSpec
from imperium_news_pipeline.phase3.topics import Topic, TopicEmbedding


class CanonicalEventConsumer(Protocol):
    def poll(self, *, status: str | None = None) -> Sequence[tuple[str, Mapping[str, Any]]]:
        ...


@dataclass
class KafkaCanonicalArticleProducer:
    producer: Any
    topic: str

    def emit(self, article: CanonicalArticle) -> None:
        self.emit_many((article,))

    def emit_many(self, articles: Sequence[CanonicalArticle]) -> None:
        for article in articles:
            payload = json.dumps(article.to_event(), sort_keys=True).encode("utf-8")
            self.producer.produce(self.topic, key=article.article_id.encode("utf-8"), value=payload)
        flush = getattr(self.producer, "flush", None)
        if flush is not None:
            flush()


@dataclass
class KafkaJsonProducer:
    producer: Any
    topic: str

    def emit(self, key: str, payload: Mapping[str, object]) -> None:
        self.producer.produce(
            self.topic,
            key=str(key).encode("utf-8"),
            value=json.dumps(payload, sort_keys=True).encode("utf-8"),
        )
        flush = getattr(self.producer, "flush", None)
        if flush is not None:
            flush()


def build_pending_feed_runtime(config: Phase3RuntimeConfig) -> PendingCanonicalFeedRuntime:
    dimension_repository = PostgresDimensionRepository(_postgres_connection_factory(config.postgres.dsn))
    return PendingCanonicalFeedRuntime.from_repositories(
        dimension_repository=dimension_repository,
        cleaned_articles=PostgresCleanedArticleRepository(
            _postgres_connection_factory(config.postgres.dsn),
            article_table=config.postgres.article_table,
        ),
        canonical_producer=KafkaCanonicalArticleProducer(
            producer=_kafka_producer(config.kafka.bootstrap_servers),
            topic=config.kafka.canonical_topic,
        ),
        redis_projector=RedisFeedProjector(build_redis_client(config.redis.url)),
        dlq_producer=KafkaJsonProducer(
            producer=_kafka_producer(config.kafka.bootstrap_servers),
            topic=config.kafka.canonical_dlq_topic,
        ),
        window_days=config.window_days,
    )


def build_redis_client(redis_url: str) -> RedisRuntimeClient:
    try:
        import redis
    except ImportError as exc:
        raise RuntimeError("redis package is required for Phase 3 Redis runtime jobs") from exc
    return RedisRuntimeClient(redis.Redis.from_url(redis_url, decode_responses=True))


def build_qdrant_client(config: Phase3RuntimeConfig) -> QdrantRuntimeClient:
    return QdrantRuntimeClient(
        client=_HttpQdrantClient(config.qdrant.url),
        collection_name=config.qdrant.collection_name,
        vector_size=config.qdrant.vector_size,
        distance=config.qdrant.distance,
    )


def build_embedding_gateway(config: Phase3RuntimeConfig, nvidia_config: NvidiaRuntimeConfig | None = None):
    from imperium_news_pipeline.phase3.embedding_gateway import (
        EmbeddingGateway,
        EmbeddingGatewayConfig,
        NvidiaEmbeddingProvider,
    )

    active_nvidia = nvidia_config or config.nvidia
    api_key = _get_required_env("NVIDIA_API_KEY")
    gateway_config = EmbeddingGatewayConfig(
        base_url=active_nvidia.base_url,
        api_key=api_key,
        model=active_nvidia.embedding_model,
        batch_size=active_nvidia.batch_size,
        rate_limit_rpm=active_nvidia.rate_limit_rpm,
        max_retries=active_nvidia.max_retries,
        initial_backoff_seconds=active_nvidia.initial_backoff_seconds,
        split_on_failure=active_nvidia.split_on_failure,
    )
    return EmbeddingGateway(
        provider=NvidiaEmbeddingProvider(
            base_url=active_nvidia.base_url,
            api_key=api_key,
            timeout_seconds=active_nvidia.timeout_seconds,
        ),
        config=gateway_config,
    )


def _postgres_connection_factory(dsn: str):
    def connect():
        try:
            import psycopg
        except ImportError:
            try:
                import psycopg2
            except ImportError as exc:
                raise RuntimeError("psycopg or psycopg2 is required for Phase 3 PostgreSQL runtime jobs") from exc
            return psycopg2.connect(dsn)
        return psycopg.connect(dsn)

    return connect


def _kafka_producer(bootstrap_servers: str):
    try:
        from kafka import KafkaProducer
    except ImportError as exc:
        raise RuntimeError("kafka-python package is required for Phase 3 canonical Kafka output") from exc
    return _KafkaPythonProducer(KafkaProducer(bootstrap_servers=bootstrap_servers.split(",")))


@dataclass
class _KafkaPythonProducer:
    producer: Any

    def produce(self, topic: str, *, key: bytes, value: bytes) -> None:
        self.producer.send(topic, key=key, value=value)

    def flush(self) -> None:
        self.producer.flush()


@dataclass
class InMemoryCanonicalTopic:
    events: list[tuple[str, Mapping[str, Any]]] = field(default_factory=list)

    def emit(self, article: CanonicalArticle) -> None:
        self.emit_many((article,))

    def emit_many(self, articles: Sequence[CanonicalArticle]) -> None:
        self.events.extend((article.article_id, article.to_event()) for article in articles)

    def poll(self, *, status: str | None = None) -> Sequence[tuple[str, Mapping[str, Any]]]:
        if status is None:
            return tuple(self.events)
        return tuple((key, event) for key, event in self.events if event.get("classification_status") == status)


@dataclass
class PostgresDimensionRepository:
    connection_factory: ConnectionFactory
    cache: dict[tuple[str, int], DimensionRecord | None] = field(default_factory=dict)

    def upsert(self, record: DimensionRecord) -> bool:
        self.upsert_many((record,))
        return True

    def upsert_many(self, records: tuple[DimensionRecord, ...]) -> int:
        if not records:
            return 0
        grouped: dict[str, list[DimensionRecord]] = {}
        for record in records:
            grouped.setdefault(record.dimension_type, []).append(record)

        connection = self.connection_factory()
        with connection.cursor() as cursor:
            for dimension_type, typed_records in grouped.items():
                table, id_column = _dimension_table(dimension_type)
                filtered_columns = _dimension_filtered_columns(typed_records[0])
                insert_columns = [id_column, *filtered_columns, "is_active", "payload", "updated_at"]
                insert_values = [f"%({column})s" for column in insert_columns]
                update_assignments = [
                    *(f"{column} = EXCLUDED.{column}" for column in filtered_columns),
                    "is_active = EXCLUDED.is_active",
                    "payload = EXCLUDED.payload",
                    "updated_at = EXCLUDED.updated_at",
                ]
                sql = f"""
                INSERT INTO {table} ({", ".join(insert_columns)})
                VALUES ({", ".join(insert_values)})
                ON CONFLICT ({id_column}) DO UPDATE SET
                    {", ".join(update_assignments)}
                """
                params = tuple(_dimension_params(record, id_column, filtered_columns) for record in typed_records)
                if hasattr(cursor, "executemany"):
                    cursor.executemany(sql, params)
                else:
                    for param in params:
                        cursor.execute(sql, param)
        connection.commit()
        for record in records:
            self.cache[(record.dimension_type, record.dimension_id)] = record if record.is_active else None
        return len(records)

    def get(self, dimension_type: str, dimension_id: int | None) -> DimensionRecord | None:
        if dimension_id is None:
            return None
        cache_key = (dimension_type, dimension_id)
        if cache_key in self.cache:
            return self.cache[cache_key]
        table, id_column = _dimension_table(dimension_type)
        connection = self.connection_factory()
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT payload, is_active, updated_at FROM {table} WHERE {id_column} = %(dimension_id)s",
                {"dimension_id": dimension_id},
            )
            row = cursor.fetchone()
        if row is None or not row[1]:
            self.cache[cache_key] = None
            return None
        record = DimensionRecord(
            dimension_type=dimension_type,
            dimension_id=dimension_id,
            payload=_json_mapping(row[0]),
            is_active=bool(row[1]),
            updated_at=row[2],
        )
        self.cache[cache_key] = record
        return record

    def get_many(self, dimension_type: str, dimension_ids: tuple[int, ...]) -> Mapping[int, DimensionRecord]:
        if not dimension_ids:
            return {}
        cached_rows: dict[int, DimensionRecord] = {}
        missing_ids: list[int] = []
        for dimension_id in dimension_ids:
            cache_key = (dimension_type, dimension_id)
            if cache_key in self.cache:
                cached = self.cache[cache_key]
                if cached is not None:
                    cached_rows[dimension_id] = cached
            else:
                missing_ids.append(dimension_id)
        if not missing_ids:
            return cached_rows
        table, id_column = _dimension_table(dimension_type)
        connection = self.connection_factory()
        with connection.cursor() as cursor:
            cursor.execute(
                f"SELECT {id_column}, payload, is_active, updated_at FROM {table} WHERE {id_column} = ANY(%(dimension_ids)s)",
                {"dimension_ids": missing_ids},
            )
            rows = _fetchall(cursor)
        found_ids = set()
        loaded_rows = {
            int(row[0]): DimensionRecord(
                dimension_type=dimension_type,
                dimension_id=int(row[0]),
                payload=_json_mapping(row[1]),
                is_active=bool(row[2]),
                updated_at=row[3],
            )
            for row in rows
            if bool(row[2])
        }
        for dimension_id, record in loaded_rows.items():
            found_ids.add(dimension_id)
            self.cache[(dimension_type, dimension_id)] = record
        for dimension_id in missing_ids:
            if dimension_id not in found_ids:
                self.cache[(dimension_type, dimension_id)] = None
        return {**cached_rows, **loaded_rows}


@dataclass
class PostgresTopicTaxonomyRepository:
    connection_factory: ConnectionFactory
    table_name: str = "imperium_topic_taxonomy"

    def list_active_topics(self, taxonomy_version: str | None = None) -> Sequence[Topic]:
        query = """
        SELECT topic_id, topic_key, display_name, description, tags, sub_topics, translations,
               model_hint, taxonomy_version, parent_topic_id, is_active
        FROM {table_name}
        WHERE is_active = true
        """
        params: dict[str, Any] = {}
        if taxonomy_version is not None:
            query += " AND taxonomy_version = %(taxonomy_version)s"
            params["taxonomy_version"] = taxonomy_version
        connection = self.connection_factory()
        with connection.cursor() as cursor:
            cursor.execute(query.format(table_name=self.table_name), params)
            rows = _fetchall(cursor)
        return tuple(
            Topic(
                topic_id=row[0],
                topic_key=row[1],
                display_name=row[2],
                description=row[3],
                tags=tuple(_json_sequence(row[4])),
                sub_topics=tuple(_json_sequence(row[5])),
                translations=(),
                model_hint=row[7],
                taxonomy_version=row[8],
                parent_topic_id=row[9],
                is_active=bool(row[10]),
            )
            for row in rows
        )


@dataclass
class PostgresTopicEmbeddingRepository:
    connection_factory: ConnectionFactory
    table_name: str = "imperium_topic_embeddings"

    def list_active_embeddings(
        self,
        *,
        taxonomy_version: str | None = None,
        embedding_model: str | None = None,
    ) -> Sequence[TopicEmbedding]:
        query = """
        SELECT topic_id, taxonomy_version, embedding_model, embedding_dimension,
               embedding_input_text, embedding_input_hash, embedding_vector, is_active
        FROM {table_name}
        WHERE is_active = true
        """
        params: dict[str, Any] = {}
        if taxonomy_version is not None:
            query += " AND taxonomy_version = %(taxonomy_version)s"
            params["taxonomy_version"] = taxonomy_version
        if embedding_model is not None:
            query += " AND embedding_model = %(embedding_model)s"
            params["embedding_model"] = embedding_model
        connection = self.connection_factory()
        with connection.cursor() as cursor:
            cursor.execute(query.format(table_name=self.table_name), params)
            rows = _fetchall(cursor)
        return tuple(
            TopicEmbedding(
                topic_id=row[0],
                taxonomy_version=row[1],
                embedding_model=row[2],
                embedding_dimension=row[3],
                embedding_input_text=row[4],
                embedding_input_hash=row[5],
                embedding_vector=tuple(float(value) for value in row[6]),
                is_active=bool(row[7]),
            )
            for row in rows
        )


@dataclass
class PostgresProjectionStateRepository:
    connection_factory: ConnectionFactory
    table_name: str = "imperium_projection_state"

    def get(self, article_id: str) -> ProjectionState | None:
        connection = self.connection_factory()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT article_id, country_id, root_topic_id, published_at
                FROM {table_name}
                WHERE article_id = %(article_id)s
                """.format(table_name=self.table_name),
                {"article_id": article_id},
            )
            row = cursor.fetchone()
        if row is None:
            return None
        return ProjectionState(
            article_id=row[0],
            country_id=row[1],
            root_topic_id=row[2],
            published_at=row[3],
        )

    def upsert(self, state: ProjectionState) -> None:
        connection = self.connection_factory()
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO {table_name} (
                    article_id, country_id, root_topic_id, published_at
                )
                VALUES (
                    %(article_id)s, %(country_id)s, %(root_topic_id)s, %(published_at)s
                )
                ON CONFLICT (article_id) DO UPDATE SET
                    country_id = EXCLUDED.country_id,
                    root_topic_id = EXCLUDED.root_topic_id,
                    published_at = EXCLUDED.published_at,
                    updated_at = now()
                """.format(table_name=self.table_name),
                {
                    "article_id": state.article_id,
                    "country_id": state.country_id,
                    "root_topic_id": state.root_topic_id,
                    "published_at": state.published_at,
                },
            )
        connection.commit()


@dataclass
class RedisRuntimeClient:
    client: Any

    def hset(self, key: str, mapping: dict[str, str]) -> None:
        self.client.hset(key, mapping=mapping)

    def zadd(self, key: str, mapping: dict[str, float]) -> None:
        self.client.zadd(key, mapping)

    def delete(self, key: str) -> None:
        self.client.delete(key)

    def zrem(self, key: str, member: str) -> None:
        self.client.zrem(key, member)


@dataclass
class QdrantRuntimeClient:
    client: Any
    collection_name: str
    vector_size: int
    distance: str = "Cosine"

    def ensure_collection(self) -> None:
        self.client.ensure_collection(self.collection_name, vector_size=self.vector_size, distance=self.distance)

    def upsert(self, point_id: int, vector: Sequence[float], payload: dict[str, Any]) -> None:
        self.client.upsert(self.collection_name, point_id=point_id, vector=list(vector), payload=payload)


@dataclass
class _HttpQdrantClient:
    base_url: str

    def ensure_collection(self, collection_name: str, *, vector_size: int, distance: str) -> None:
        body = {
            "vectors": {
                "size": vector_size,
                "distance": distance,
            }
        }
        _http_json("PUT", f"{self.base_url.rstrip('/')}/collections/{collection_name}", body)

    def upsert(self, collection_name: str, *, point_id: int, vector: list[float], payload: dict[str, Any]) -> None:
        body = {
            "points": [
                {
                    "id": point_id,
                    "vector": vector,
                    "payload": payload,
                }
            ]
        }
        _http_json("PUT", f"{self.base_url.rstrip('/')}/collections/{collection_name}/points", body)


@dataclass
class InMemoryRuntimeKafkaAdmin:
    topics: dict[str, TopicSpec] = field(default_factory=dict)

    def ensure_topic(self, spec: TopicSpec) -> None:
        self.topics[spec.name] = spec


def assert_protocol_shapes(redis: RedisClient, qdrant: QdrantClient) -> None:
    _ = redis
    _ = qdrant


def _dimension_table(dimension_type: str) -> tuple[str, str]:
    mapping = {
        "links": ("imperium_dim_links", "link_id"),
        "authorities": ("imperium_dim_authorities", "authority_id"),
        "seditions": ("imperium_dim_seditions", "sedition_id"),
        "countries": ("imperium_dim_countries", "country_id"),
        "rubrics": ("imperium_dim_rubrics", "rubric_id"),
        "languages": ("imperium_dim_languages", "language_id"),
    }
    try:
        return mapping[dimension_type]
    except KeyError as exc:
        raise ValueError(f"unknown dimension type: {dimension_type}") from exc


def _dimension_filtered_columns(record: DimensionRecord) -> tuple[str, ...]:
    mapping = {
        "links": ("url", "source_domain", "source_name", "country_id"),
        "authorities": ("source_name", "source_domain", "sedition_id"),
        "seditions": ("country_id",),
        "countries": ("country_name",),
        "rubrics": ("rubric_title",),
        "languages": ("language_code",),
    }
    try:
        return mapping[record.dimension_type]
    except KeyError as exc:
        raise ValueError(f"unknown dimension type: {record.dimension_type}") from exc


def _dimension_params(record: DimensionRecord, id_column: str, filtered_columns: tuple[str, ...]) -> dict[str, Any]:
    return {
        id_column: record.dimension_id,
        "is_active": record.is_active,
        "payload": json.dumps(record.payload, sort_keys=True),
        "updated_at": record.updated_at,
        **{column: record.payload.get(column) for column in filtered_columns},
    }


def _json_mapping(value: Any) -> Mapping[str, Any]:
    if isinstance(value, str):
        loaded = json.loads(value)
    else:
        loaded = value
    if not isinstance(loaded, Mapping):
        raise ValueError("expected JSON object")
    return dict(loaded)


def _json_sequence(value: Any) -> Sequence[Any]:
    if isinstance(value, str):
        loaded = json.loads(value)
    else:
        loaded = value
    if loaded is None:
        return ()
    if not isinstance(loaded, Sequence) or isinstance(loaded, (str, bytes)):
        raise ValueError("expected JSON array")
    return tuple(loaded)


def _fetchall(cursor: Any) -> Sequence[Any]:
    fetchall = getattr(cursor, "fetchall", None)
    if fetchall is None:
        return ()
    return fetchall()


def _http_json(method: str, url: str, payload: dict[str, Any]) -> Any:
    data = json.dumps(payload).encode("utf-8")
    http_request = request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method=method,
    )
    try:
        with request.urlopen(http_request, timeout=30.0) as response:
            body = response.read().decode("utf-8")
    except error.HTTPError as exc:
        if exc.code == 409:
            body = exc.read().decode("utf-8")
        else:
            raise
    if not body:
        return None
    return json.loads(body)


def _get_required_env(key: str) -> str:
    import os

    value = os.getenv(key, "").strip()
    if not value:
        raise RuntimeError(f"{key} is required for the Phase 3 embedding runtime")
    return value
