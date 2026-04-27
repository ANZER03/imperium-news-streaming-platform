from __future__ import annotations

import os
import sys

from imperium_news_pipeline.phase3.embedding_gateway import (
    EmbeddingGateway,
    EmbeddingGatewayConfig,
    EmbeddingRequestItem,
    NvidiaEmbeddingProvider,
)


def main() -> int:
    try:
        config = _config_from_env()
    except ValueError as exc:
        print(f"nvidia smoke: {exc}", file=sys.stderr)
        return 2

    provider = NvidiaEmbeddingProvider(base_url=config.base_url, api_key=config.api_key)
    gateway = EmbeddingGateway(provider=provider, config=config)
    items = (
        EmbeddingRequestItem("smoke-1", "Central bank rate decision pushes markets."),
        EmbeddingRequestItem("smoke-2", "New AI model release changes developer workflows."),
    )

    try:
        result = gateway.embed(items)
    except Exception as exc:  # noqa: BLE001 - smoke entrypoint needs to report raw failure
        print(f"nvidia smoke: failed: {exc}", file=sys.stderr)
        return 1

    if result.failures:
        print(f"nvidia smoke: partial failure: {len(result.failures)} item(s)", file=sys.stderr)
        for failure in result.failures:
            print(f"nvidia smoke: {failure.item_id}: {failure.reason}", file=sys.stderr)
        return 1

    lengths = {item_id: len(vector) for item_id, vector in result.embeddings.items()}
    print(f"nvidia smoke: ok items={len(lengths)} vector_dims={sorted(set(lengths.values()))}")
    print(
        "nvidia smoke: metrics "
        f"requests={gateway.metrics.request_count} "
        f"retries={gateway.metrics.retry_count} "
        f"failures={gateway.metrics.failure_count} "
        f"latency_seconds={gateway.metrics.total_latency_seconds:.3f}"
    )
    return 0


def _config_from_env() -> EmbeddingGatewayConfig:
    api_key = os.environ.get("NVIDIA_API_KEY", "").strip()
    base_url = os.environ.get("NVIDIA_EMBEDDING_BASE_URL", "https://integrate.api.nvidia.com/v1").strip()
    model = os.environ.get("NVIDIA_EMBEDDING_MODEL", "baai/bge-m3").strip()
    batch_size = int(os.environ.get("NVIDIA_EMBEDDING_BATCH_SIZE", "8191"))
    rate_limit_rpm = int(os.environ.get("NVIDIA_EMBEDDING_RATE_LIMIT_RPM", "40"))
    truncate = os.environ.get("NVIDIA_EMBEDDING_TRUNCATE", "END").strip()
    if not api_key:
        raise ValueError("NVIDIA_API_KEY is required")
    return EmbeddingGatewayConfig(
        base_url=base_url,
        api_key=api_key,
        model=model,
        batch_size=batch_size,
        rate_limit_rpm=rate_limit_rpm,
        truncate=truncate,
    )


if __name__ == "__main__":
    raise SystemExit(main())
