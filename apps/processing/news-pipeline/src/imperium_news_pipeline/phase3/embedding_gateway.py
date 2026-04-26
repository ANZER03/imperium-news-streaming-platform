from __future__ import annotations

from dataclasses import dataclass, field
import json
import time
from typing import Callable, Protocol, Sequence
from urllib import error, request

from imperium_news_pipeline.phase3.topics import DEFAULT_EMBEDDING_MODEL


DEFAULT_EMBEDDING_BATCH_SIZE = 8192
MAX_EMBEDDING_BATCH_SIZE = 8192
DEFAULT_NVIDIA_RPM_LIMIT = 40
DEFAULT_TRUNCATE_MODE = "END"


@dataclass(frozen=True)
class EmbeddingGatewayConfig:
    base_url: str
    api_key: str
    model: str = DEFAULT_EMBEDDING_MODEL
    batch_size: int = DEFAULT_EMBEDDING_BATCH_SIZE
    rate_limit_rpm: int = DEFAULT_NVIDIA_RPM_LIMIT
    truncate: str = DEFAULT_TRUNCATE_MODE
    max_retries: int = 3
    initial_backoff_seconds: float = 1.0

    def __post_init__(self) -> None:
        if not self.base_url:
            raise ValueError("base_url is required")
        if not self.api_key:
            raise ValueError("api_key is required")
        if self.batch_size < 1:
            raise ValueError("batch_size must be positive")
        if self.batch_size > MAX_EMBEDDING_BATCH_SIZE:
            raise ValueError(f"batch_size must be <= {MAX_EMBEDDING_BATCH_SIZE}")
        if self.rate_limit_rpm < 1:
            raise ValueError("rate_limit_rpm must be positive")


@dataclass(frozen=True)
class EmbeddingRequestItem:
    item_id: str
    text: str


@dataclass(frozen=True)
class EmbeddingFailure:
    item_id: str
    reason: str


@dataclass(frozen=True)
class EmbeddingGatewayResult:
    embeddings: dict[str, tuple[float, ...]]
    failures: tuple[EmbeddingFailure, ...] = ()


@dataclass(frozen=True)
class ProviderEmbeddingResponse:
    embeddings: tuple[tuple[float, ...], ...]
    latency_seconds: float


class RetryableEmbeddingError(Exception):
    pass


class EmbeddingProvider(Protocol):
    def embed(self, texts: Sequence[str], *, model: str, truncate: str) -> ProviderEmbeddingResponse:
        ...


@dataclass
class EmbeddingGatewayMetrics:
    request_count: int = 0
    retry_count: int = 0
    failure_count: int = 0
    total_latency_seconds: float = 0.0
    batch_sizes: list[int] = field(default_factory=list)
    request_timestamps: list[float] = field(default_factory=list)

    def record_request(self, *, batch_size: int, latency_seconds: float, timestamp: float) -> None:
        self.request_count += 1
        self.total_latency_seconds += latency_seconds
        self.batch_sizes.append(batch_size)
        self.request_timestamps.append(timestamp)

    @property
    def latest_rpm_usage(self) -> int:
        if not self.request_timestamps:
            return 0
        latest = self.request_timestamps[-1]
        return sum(1 for timestamp in self.request_timestamps if latest - timestamp < 60.0)


@dataclass
class InMemoryRateLimiter:
    rpm_limit: int
    now: Callable[[], float] = time.monotonic
    sleep: Callable[[float], None] = time.sleep
    _request_timestamps: list[float] = field(default_factory=list)

    def acquire(self) -> float:
        current = self.now()
        self._request_timestamps = [
            timestamp for timestamp in self._request_timestamps if current - timestamp < 60.0
        ]
        if len(self._request_timestamps) >= self.rpm_limit:
            wait_seconds = 60.0 - (current - self._request_timestamps[0])
            if wait_seconds > 0:
                self.sleep(wait_seconds)
                current = self.now()
                self._request_timestamps = [
                    timestamp for timestamp in self._request_timestamps if current - timestamp < 60.0
                ]
        self._request_timestamps.append(current)
        return current


@dataclass
class EmbeddingGateway:
    provider: EmbeddingProvider
    config: EmbeddingGatewayConfig
    rate_limiter: InMemoryRateLimiter | None = None
    metrics: EmbeddingGatewayMetrics = field(default_factory=EmbeddingGatewayMetrics)
    sleep: Callable[[float], None] = time.sleep

    def embed(self, items: Sequence[EmbeddingRequestItem]) -> EmbeddingGatewayResult:
        embeddings: dict[str, tuple[float, ...]] = {}
        failures: list[EmbeddingFailure] = []
        for batch in _chunks(tuple(items), self.config.batch_size):
            self._embed_batch(batch, embeddings, failures)
        return EmbeddingGatewayResult(embeddings=embeddings, failures=tuple(failures))

    def _embed_batch(
        self,
        batch: tuple[EmbeddingRequestItem, ...],
        embeddings: dict[str, tuple[float, ...]],
        failures: list[EmbeddingFailure],
    ) -> None:
        if not batch:
            return

        try:
            vectors = self._call_with_retries(batch)
        except Exception as exc:
            if len(batch) > 1:
                midpoint = len(batch) // 2
                self._embed_batch(batch[:midpoint], embeddings, failures)
                self._embed_batch(batch[midpoint:], embeddings, failures)
                return
            self.metrics.failure_count += 1
            failures.append(EmbeddingFailure(item_id=batch[0].item_id, reason=str(exc)))
            return

        for item, vector in zip(batch, vectors):
            embeddings[item.item_id] = vector

    def _call_with_retries(self, batch: tuple[EmbeddingRequestItem, ...]) -> tuple[tuple[float, ...], ...]:
        attempt = 0
        while True:
            try:
                request_timestamp = self._rate_limiter.acquire()
                response = self.provider.embed(
                    [item.text for item in batch],
                    model=self.config.model,
                    truncate=self.config.truncate,
                )
                if len(response.embeddings) != len(batch):
                    raise ValueError("provider returned a different embedding count than requested")
                self.metrics.record_request(
                    batch_size=len(batch),
                    latency_seconds=response.latency_seconds,
                    timestamp=request_timestamp,
                )
                return response.embeddings
            except RetryableEmbeddingError:
                if attempt >= self.config.max_retries:
                    raise
                self.metrics.retry_count += 1
                self.sleep(self.config.initial_backoff_seconds * (2**attempt))
                attempt += 1

    @property
    def _rate_limiter(self) -> InMemoryRateLimiter:
        if self.rate_limiter is None:
            self.rate_limiter = InMemoryRateLimiter(self.config.rate_limit_rpm)
        return self.rate_limiter


@dataclass
class NvidiaEmbeddingProvider:
    """Adapter for NVIDIA embeddings; API key stays at the gateway boundary."""

    base_url: str
    api_key: str
    timeout_seconds: float = 30.0
    opener: Callable[..., object] | None = None
    now: Callable[[], float] = time.monotonic

    def embed(self, texts: Sequence[str], *, model: str, truncate: str) -> ProviderEmbeddingResponse:
        payload = json.dumps(
            {
                "input": list(texts),
                "model": model,
                "encoding_format": "float",
                "truncate": truncate,
            }
        ).encode("utf-8")
        http_request = request.Request(
            self.base_url.rstrip("/") + "/embeddings",
            data=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )
        start = self.now()
        try:
            opener = self.opener or request.urlopen
            response = opener(http_request, timeout=self.timeout_seconds)
            body = response.read().decode("utf-8")
        except error.HTTPError as exc:
            if exc.code == 429 or 500 <= exc.code <= 599:
                raise RetryableEmbeddingError(f"retryable NVIDIA response: {exc.code}") from exc
            raise
        except error.URLError as exc:
            raise RetryableEmbeddingError(str(exc)) from exc

        data = json.loads(body)
        vectors = tuple(
            tuple(float(value) for value in item["embedding"])
            for item in sorted(data.get("data", ()), key=lambda value: value.get("index", 0))
        )
        return ProviderEmbeddingResponse(embeddings=vectors, latency_seconds=self.now() - start)


def _chunks(items: tuple[EmbeddingRequestItem, ...], size: int) -> tuple[tuple[EmbeddingRequestItem, ...], ...]:
    return tuple(items[index : index + size] for index in range(0, len(items), size))
