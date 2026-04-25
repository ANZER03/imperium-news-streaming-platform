from __future__ import annotations

from dataclasses import dataclass, field
import unittest
from urllib import error

from imperium_news_pipeline.phase3.embedding_gateway import (
    DEFAULT_EMBEDDING_BATCH_SIZE,
    DEFAULT_NVIDIA_RPM_LIMIT,
    EmbeddingGateway,
    EmbeddingGatewayConfig,
    EmbeddingRequestItem,
    InMemoryRateLimiter,
    MAX_EMBEDDING_BATCH_SIZE,
    NvidiaEmbeddingProvider,
    ProviderEmbeddingResponse,
    RetryableEmbeddingError,
)
from imperium_news_pipeline.phase3.topics import DEFAULT_EMBEDDING_MODEL


@dataclass
class FakeEmbeddingProvider:
    fail_batches: set[tuple[str, ...]] = field(default_factory=set)
    fail_first_calls: int = 0
    calls: list[tuple[tuple[str, ...], str, str]] = field(default_factory=list)

    def embed(self, texts, *, model: str, truncate: str) -> ProviderEmbeddingResponse:
        text_tuple = tuple(texts)
        self.calls.append((text_tuple, model, truncate))
        if self.fail_first_calls > 0:
            self.fail_first_calls -= 1
            raise RetryableEmbeddingError("temporary throttle")
        if text_tuple in self.fail_batches:
            raise RetryableEmbeddingError("batch rejected")
        vectors = tuple((float(len(text)), float(index)) for index, text in enumerate(text_tuple))
        return ProviderEmbeddingResponse(embeddings=vectors, latency_seconds=0.25)


class ManualClock:
    def __init__(self) -> None:
        self.current = 0.0
        self.sleeps: list[float] = []

    def now(self) -> float:
        return self.current

    def sleep(self, seconds: float) -> None:
        self.sleeps.append(seconds)
        self.current += seconds


class EmbeddingGatewayTests(unittest.TestCase):
    def test_config_defaults_and_caps_match_phase3_gateway_contract(self) -> None:
        config = EmbeddingGatewayConfig(base_url="https://integrate.api.nvidia.com/v1", api_key="secret")

        self.assertEqual(config.model, DEFAULT_EMBEDDING_MODEL)
        self.assertEqual(config.batch_size, DEFAULT_EMBEDDING_BATCH_SIZE)
        self.assertEqual(config.batch_size, MAX_EMBEDDING_BATCH_SIZE)
        self.assertEqual(config.rate_limit_rpm, DEFAULT_NVIDIA_RPM_LIMIT)
        self.assertEqual(config.truncate, "END")

        with self.assertRaises(ValueError):
            EmbeddingGatewayConfig(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key="secret",
                batch_size=MAX_EMBEDDING_BATCH_SIZE + 1,
            )

    def test_gateway_calls_provider_abstraction_and_records_metrics(self) -> None:
        provider = FakeEmbeddingProvider()
        clock = ManualClock()
        gateway = EmbeddingGateway(
            provider=provider,
            config=EmbeddingGatewayConfig(
                base_url="https://gateway.local",
                api_key="gateway-only",
                batch_size=2,
                rate_limit_rpm=40,
            ),
            rate_limiter=InMemoryRateLimiter(40, now=clock.now, sleep=clock.sleep),
        )

        result = gateway.embed(
            (
                EmbeddingRequestItem("a", "alpha"),
                EmbeddingRequestItem("b", "beta"),
                EmbeddingRequestItem("c", "gamma"),
            )
        )

        self.assertEqual(set(result.embeddings), {"a", "b", "c"})
        self.assertEqual(result.failures, ())
        self.assertEqual([len(call[0]) for call in provider.calls], [2, 1])
        self.assertEqual(provider.calls[0][1], DEFAULT_EMBEDDING_MODEL)
        self.assertEqual(gateway.metrics.request_count, 2)
        self.assertEqual(gateway.metrics.batch_sizes, [2, 1])
        self.assertEqual(gateway.metrics.total_latency_seconds, 0.5)
        self.assertEqual(gateway.metrics.latest_rpm_usage, 2)

    def test_rate_limiter_enforces_global_40_rpm_limit(self) -> None:
        provider = FakeEmbeddingProvider()
        clock = ManualClock()
        gateway = EmbeddingGateway(
            provider=provider,
            config=EmbeddingGatewayConfig(
                base_url="https://gateway.local",
                api_key="gateway-only",
                batch_size=1,
                rate_limit_rpm=40,
            ),
            rate_limiter=InMemoryRateLimiter(40, now=clock.now, sleep=clock.sleep),
        )

        gateway.embed(tuple(EmbeddingRequestItem(str(index), f"text {index}") for index in range(41)))

        self.assertEqual(gateway.metrics.request_count, 41)
        self.assertEqual(clock.sleeps, [60.0])

    def test_retryable_errors_use_exponential_backoff(self) -> None:
        provider = FakeEmbeddingProvider(fail_first_calls=2)
        sleeps: list[float] = []
        gateway = EmbeddingGateway(
            provider=provider,
            config=EmbeddingGatewayConfig(
                base_url="https://gateway.local",
                api_key="gateway-only",
                max_retries=3,
                initial_backoff_seconds=0.5,
            ),
            sleep=sleeps.append,
        )

        result = gateway.embed((EmbeddingRequestItem("a", "alpha"),))

        self.assertEqual(set(result.embeddings), {"a"})
        self.assertEqual(sleeps, [0.5, 1.0])
        self.assertEqual(gateway.metrics.retry_count, 2)

    def test_repeatedly_failing_batches_split_before_final_item_failure(self) -> None:
        provider = FakeEmbeddingProvider(
            fail_batches={
                ("good", "bad"),
                ("bad",),
            }
        )
        gateway = EmbeddingGateway(
            provider=provider,
            config=EmbeddingGatewayConfig(
                base_url="https://gateway.local",
                api_key="gateway-only",
                batch_size=2,
                max_retries=0,
            ),
            sleep=lambda _seconds: None,
        )

        result = gateway.embed(
            (
                EmbeddingRequestItem("good", "good"),
                EmbeddingRequestItem("bad", "bad"),
            )
        )

        self.assertEqual(set(result.embeddings), {"good"})
        self.assertEqual([failure.item_id for failure in result.failures], ["bad"])
        self.assertEqual(
            [call[0] for call in provider.calls],
            [("good", "bad"), ("good",), ("bad",)],
        )
        self.assertEqual(gateway.metrics.failure_count, 1)

    def test_nvidia_provider_holds_api_key_and_maps_retryable_http_statuses(self) -> None:
        seen_headers: dict[str, str] = {}

        class Response:
            def read(self) -> bytes:
                return b'{"data":[{"index":0,"embedding":[0.1,0.2]}]}'

        def opener(req, *, timeout):
            seen_headers.update(dict(req.header_items()))
            self.assertEqual(timeout, 30.0)
            return Response()

        provider = NvidiaEmbeddingProvider(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key="secret",
            opener=opener,
            now=lambda: 10.0,
        )

        response = provider.embed(("hello",), model=DEFAULT_EMBEDDING_MODEL, truncate="END")

        self.assertEqual(response.embeddings, ((0.1, 0.2),))
        self.assertEqual(seen_headers["Authorization"], "Bearer secret")

        retrying_provider = NvidiaEmbeddingProvider(
            base_url="https://integrate.api.nvidia.com/v1",
            api_key="secret",
            opener=lambda _req, *, timeout: (_ for _ in ()).throw(
                error.HTTPError(
                    "https://integrate.api.nvidia.com/v1/embeddings",
                    429,
                    "rate limited",
                    {},
                    None,
                )
            ),
        )

        with self.assertRaises(RetryableEmbeddingError):
            retrying_provider.embed(("hello",), model=DEFAULT_EMBEDDING_MODEL, truncate="END")


if __name__ == "__main__":
    unittest.main()
