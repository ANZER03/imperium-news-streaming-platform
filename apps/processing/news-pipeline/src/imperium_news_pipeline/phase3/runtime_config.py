from __future__ import annotations

from dataclasses import dataclass
import os
from typing import Mapping


DEFAULT_SOURCE_TOPIC_PREFIX = "imperium.news.public"


@dataclass(frozen=True)
class KafkaRuntimeConfig:
    bootstrap_servers: str
    schema_registry_url: str
    canonical_topic: str
    canonical_dlq_topic: str
    source_topic_prefix: str

    def source_topic(self, table_name: str) -> str:
        return f"{self.source_topic_prefix}.{table_name}"


@dataclass(frozen=True)
class PostgresRuntimeConfig:
    dsn: str


@dataclass(frozen=True)
class RedisRuntimeConfig:
    url: str


@dataclass(frozen=True)
class QdrantRuntimeConfig:
    url: str
    collection_name: str
    vector_size: int
    distance: str = "Cosine"


@dataclass(frozen=True)
class NvidiaRuntimeConfig:
    api_key_present: bool
    base_url: str
    embedding_model: str
    batch_size: int
    rate_limit_rpm: int


@dataclass(frozen=True)
class CheckpointConfig:
    root: str

    def for_job(self, job_name: str) -> str:
        safe_name = job_name.strip().replace("/", "-")
        if not safe_name:
            raise ValueError("job_name is required")
        return f"{self.root.rstrip('/')}/{safe_name}"


@dataclass(frozen=True)
class Phase3RuntimeConfig:
    kafka: KafkaRuntimeConfig
    postgres: PostgresRuntimeConfig
    redis: RedisRuntimeConfig
    qdrant: QdrantRuntimeConfig
    nvidia: NvidiaRuntimeConfig
    checkpoints: CheckpointConfig
    window_days: int

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> Phase3RuntimeConfig:
        values = os.environ if env is None else env
        window_days = _positive_int(values, "PHASE3_WINDOW_DAYS", 5)
        return cls(
            kafka=KafkaRuntimeConfig(
                bootstrap_servers=_get(values, "KAFKA_BOOTSTRAP_SERVERS", "localhost:49092"),
                schema_registry_url=_get(values, "SCHEMA_REGISTRY_URL", "http://localhost:48081"),
                canonical_topic=_get(values, "PHASE3_CANONICAL_TOPIC", "phase3.canonical-articles"),
                canonical_dlq_topic=_get(values, "PHASE3_CANONICAL_DLQ_TOPIC", "phase3.canonical-articles.dlq"),
                source_topic_prefix=_get(values, "PHASE3_SOURCE_TOPIC_PREFIX", DEFAULT_SOURCE_TOPIC_PREFIX),
            ),
            postgres=PostgresRuntimeConfig(dsn=_get(values, "PHASE3_POSTGRES_DSN", "postgresql://postgres:postgres@localhost:35432/imperium-news-source")),
            redis=RedisRuntimeConfig(url=_get(values, "PHASE3_REDIS_URL", "redis://localhost:46379/0")),
            qdrant=QdrantRuntimeConfig(
                url=_get(values, "PHASE3_QDRANT_URL", "http://localhost:46333"),
                collection_name=_get(values, "PHASE3_QDRANT_COLLECTION", "phase3_articles"),
                vector_size=_positive_int(values, "PHASE3_QDRANT_VECTOR_SIZE", 1024),
                distance=_get(values, "PHASE3_QDRANT_DISTANCE", "Cosine"),
            ),
            nvidia=NvidiaRuntimeConfig(
                api_key_present=bool(values.get("NVIDIA_API_KEY", "").strip()),
                base_url=_get(values, "NVIDIA_EMBEDDING_BASE_URL", "https://integrate.api.nvidia.com/v1"),
                embedding_model=_get(values, "NVIDIA_EMBEDDING_MODEL", "baai/bge-m3"),
                batch_size=_positive_int(values, "NVIDIA_EMBEDDING_BATCH_SIZE", 8192),
                rate_limit_rpm=_positive_int(values, "NVIDIA_EMBEDDING_RATE_LIMIT_RPM", 40),
            ),
            checkpoints=CheckpointConfig(root=_get(values, "PHASE3_CHECKPOINT_ROOT", "/tmp/imperium/phase3/checkpoints")),
            window_days=window_days,
        )


def _get(env: Mapping[str, str], key: str, default: str) -> str:
    value = env.get(key, default).strip()
    if not value:
        raise ValueError(f"{key} cannot be empty")
    return value


def _positive_int(env: Mapping[str, str], key: str, default: int) -> int:
    value = int(env.get(key, str(default)))
    if value <= 0:
        raise ValueError(f"{key} must be positive")
    return value
