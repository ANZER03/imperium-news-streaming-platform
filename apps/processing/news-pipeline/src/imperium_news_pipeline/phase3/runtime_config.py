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
    article_table: str
    topic_taxonomy_table: str
    topic_embeddings_table: str
    projection_state_table: str
    dimension_table_prefix: str


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
    max_retries: int
    initial_backoff_seconds: float
    timeout_seconds: float
    split_on_failure: bool


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
                canonical_topic=_get(values, "PHASE3_CANONICAL_TOPIC", "imperium.canonical-articles"),
                canonical_dlq_topic=_get(values, "PHASE3_CANONICAL_DLQ_TOPIC", "imperium.canonical-articles.dlq"),
                source_topic_prefix=_get(values, "PHASE3_SOURCE_TOPIC_PREFIX", DEFAULT_SOURCE_TOPIC_PREFIX),
            ),
            postgres=PostgresRuntimeConfig(
                dsn=_get(values, "PHASE3_POSTGRES_DSN", "postgresql://postgres:postgres@localhost:35432/imperium-news-source"),
                article_table=_get(values, "PHASE3_ARTICLE_TABLE", "imperium_articles"),
                topic_taxonomy_table=_get(values, "PHASE3_TOPIC_TAXONOMY_TABLE", "imperium_topic_taxonomy"),
                topic_embeddings_table=_get(values, "PHASE3_TOPIC_EMBEDDINGS_TABLE", "imperium_topic_embeddings"),
                projection_state_table=_get(values, "PHASE3_PROJECTION_STATE_TABLE", "imperium_projection_state"),
                dimension_table_prefix=_get(values, "PHASE3_DIMENSION_TABLE_PREFIX", "imperium_dim_"),
            ),
            redis=RedisRuntimeConfig(url=_get(values, "PHASE3_REDIS_URL", "redis://localhost:46379/0")),
            qdrant=QdrantRuntimeConfig(
                url=_get(values, "PHASE3_QDRANT_URL", "http://localhost:46333"),
                collection_name=_get(values, "PHASE3_QDRANT_COLLECTION", "imperium_articles"),
                vector_size=_positive_int(values, "PHASE3_QDRANT_VECTOR_SIZE", 1024),
                distance=_get(values, "PHASE3_QDRANT_DISTANCE", "Cosine"),
            ),
            nvidia=NvidiaRuntimeConfig(
                api_key_present=bool(values.get("NVIDIA_API_KEY", "").strip()),
                base_url=_get(values, "NVIDIA_EMBEDDING_BASE_URL", "https://integrate.api.nvidia.com/v1"),
                embedding_model=_get(values, "NVIDIA_EMBEDDING_MODEL", "baai/bge-m3"),
                batch_size=_positive_int(values, "NVIDIA_EMBEDDING_BATCH_SIZE", 8191),
                rate_limit_rpm=_positive_int(values, "NVIDIA_EMBEDDING_RATE_LIMIT_RPM", 40),
                max_retries=_non_negative_int(values, "NVIDIA_EMBEDDING_MAX_RETRIES", 3),
                initial_backoff_seconds=_positive_float(values, "NVIDIA_EMBEDDING_INITIAL_BACKOFF_SECONDS", 1.0),
                timeout_seconds=_positive_float(values, "NVIDIA_EMBEDDING_TIMEOUT_SECONDS", 30.0),
                split_on_failure=_bool(values, "NVIDIA_EMBEDDING_SPLIT_ON_FAILURE", True),
            ),
            checkpoints=CheckpointConfig(root=_get(values, "PHASE3_CHECKPOINT_ROOT", "/tmp/imperium/checkpoints/processing")),
            window_days=window_days,
        )

    def stream_starting_offsets(self, env: Mapping[str, str], job_name: str, default: str = "earliest") -> str:
        return _get_job_setting(env, job_name, "STARTING_OFFSETS", default)

    def stream_max_offsets_per_trigger(self, env: Mapping[str, str], job_name: str) -> str | None:
        return _get_job_setting_optional(env, job_name, "MAX_OFFSETS_PER_TRIGGER")

    def stream_trigger_processing_time(self, env: Mapping[str, str], job_name: str) -> str | None:
        return _get_job_setting_optional(env, job_name, "TRIGGER_PROCESSING_TIME")

    def job_nvidia_config(self, env: Mapping[str, str], job_name: str) -> NvidiaRuntimeConfig:
        return NvidiaRuntimeConfig(
            api_key_present=bool(env.get("NVIDIA_API_KEY", "").strip()),
            base_url=_get(env, "NVIDIA_EMBEDDING_BASE_URL", self.nvidia.base_url),
            embedding_model=_get(env, "NVIDIA_EMBEDDING_MODEL", self.nvidia.embedding_model),
            batch_size=_positive_int_job(env, job_name, "EMBEDDING_BATCH_SIZE", self.nvidia.batch_size),
            rate_limit_rpm=_positive_int_job(env, job_name, "NVIDIA_RPM_BUDGET", self.nvidia.rate_limit_rpm),
            max_retries=_non_negative_int_job(env, job_name, "EMBEDDING_MAX_RETRIES", self.nvidia.max_retries),
            initial_backoff_seconds=_positive_float_job(
                env,
                job_name,
                "EMBEDDING_INITIAL_BACKOFF_SECONDS",
                self.nvidia.initial_backoff_seconds,
            ),
            timeout_seconds=_positive_float_job(env, job_name, "EMBEDDING_TIMEOUT_SECONDS", self.nvidia.timeout_seconds),
            split_on_failure=_bool_job(env, job_name, "EMBEDDING_SPLIT_ON_FAILURE", self.nvidia.split_on_failure),
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


def _non_negative_int(env: Mapping[str, str], key: str, default: int) -> int:
    value = int(env.get(key, str(default)))
    if value < 0:
        raise ValueError(f"{key} must be non-negative")
    return value


def _positive_float(env: Mapping[str, str], key: str, default: float) -> float:
    value = float(env.get(key, str(default)))
    if value <= 0:
        raise ValueError(f"{key} must be positive")
    return value


def _bool(env: Mapping[str, str], key: str, default: bool) -> bool:
    value = env.get(key)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{key} must be a boolean")


def _job_env_prefix(job_name: str) -> str:
    normalized = job_name.strip().upper().replace("-", "_")
    if not normalized:
        raise ValueError("job_name is required")
    return f"PHASE3_{normalized}"


def _get_job_setting(env: Mapping[str, str], job_name: str, key_suffix: str, default: str) -> str:
    job_key = f"{_job_env_prefix(job_name)}_{key_suffix}"
    fallback_key = f"PHASE3_{key_suffix}"
    return _get(env, job_key, env.get(fallback_key, default))


def _get_job_setting_optional(env: Mapping[str, str], job_name: str, key_suffix: str) -> str | None:
    job_key = f"{_job_env_prefix(job_name)}_{key_suffix}"
    value = env.get(job_key)
    if value is not None:
        value = value.strip()
        return value or None
    fallback_key = f"PHASE3_{key_suffix}"
    fallback = env.get(fallback_key)
    if fallback is None:
        return None
    fallback = fallback.strip()
    return fallback or None


def _positive_int_job(env: Mapping[str, str], job_name: str, key_suffix: str, default: int) -> int:
    job_key = f"{_job_env_prefix(job_name)}_{key_suffix}"
    fallback_key = f"NVIDIA_{key_suffix}"
    fallback = env.get(fallback_key, str(default))
    return _positive_int(env, job_key, int(fallback))


def _non_negative_int_job(env: Mapping[str, str], job_name: str, key_suffix: str, default: int) -> int:
    job_key = f"{_job_env_prefix(job_name)}_{key_suffix}"
    fallback_key = f"NVIDIA_{key_suffix}"
    fallback = env.get(fallback_key, str(default))
    return _non_negative_int(env, job_key, int(fallback))


def _positive_float_job(env: Mapping[str, str], job_name: str, key_suffix: str, default: float) -> float:
    job_key = f"{_job_env_prefix(job_name)}_{key_suffix}"
    fallback_key = f"NVIDIA_{key_suffix}"
    fallback = env.get(fallback_key, str(default))
    return _positive_float(env, job_key, float(fallback))


def _bool_job(env: Mapping[str, str], job_name: str, key_suffix: str, default: bool) -> bool:
    job_key = f"{_job_env_prefix(job_name)}_{key_suffix}"
    fallback_key = f"NVIDIA_{key_suffix}"
    fallback = env.get(fallback_key)
    if fallback is None:
        fallback = "true" if default else "false"
    return _bool(env, job_key, _bool(env, fallback_key, default))
