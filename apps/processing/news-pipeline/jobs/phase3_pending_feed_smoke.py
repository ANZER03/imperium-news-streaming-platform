from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import sys

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.canonical import InMemoryCanonicalArticleProducer, InMemoryCleanedArticleRepository
from imperium_news_pipeline.phase3.dimensions import InMemoryDimensionRepository
from imperium_news_pipeline.phase3.pending_feed_runtime import PendingCanonicalFeedRuntime
from imperium_news_pipeline.phase3.redis_projection import InMemoryRedisClient, RedisFeedProjector


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


def main() -> int:
    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append((name, ok, detail))

    decoder = DebeziumAvroCdcDecoder()
    dim_repo = InMemoryDimensionRepository()
    cleaned_repo = InMemoryCleanedArticleRepository()
    canonical_topic = InMemoryCanonicalArticleProducer()
    redis = InMemoryRedisClient()
    runtime = PendingCanonicalFeedRuntime.from_repositories(
        dimension_repository=dim_repo,
        cleaned_articles=cleaned_repo,
        canonical_producer=canonical_topic,
        redis_projector=RedisFeedProjector(redis),
        clock=FixedClock(datetime(2026, 4, 26, 12, 0, tzinfo=timezone.utc)),
    )

    for change in _dimension_changes(decoder):
        runtime.apply_dimension_change(change)
    check(
        "curated-dimensions",
        dim_repo.get("links", 10) is not None and dim_repo.get("countries", 504) is not None,
        "dimension CDC fixtures materialized to curated rows",
    )

    news_change = decoder.decode(
        key={"id": 9001},
        value={
            "op": "c",
            "source": {"schema": "public", "table": "table_news"},
            "after": {
                "id": 9001,
                "link_id": 10,
                "authority_id": 2,
                "rubrique_id": 3,
                "langue_id": 6,
                "more_title": "Runtime pending article",
                "more_url": "https://news.example/runtime",
                "more_inner_text": "This full body must not appear in Redis cards.",
                "pubdate": datetime(2026, 4, 25, 8, 30, tzinfo=timezone.utc),
                "valide": True,
            },
            "ts_ms": 1777200000000,
        },
    )
    result = runtime.apply_news_change(news_change)
    article_id = "news:9001"

    check(
        "cleaned-pending-row",
        article_id in cleaned_repo.rows and cleaned_repo.rows[article_id]["classification_status"] == "pending",
        "news CDC fixture upserted as pending cleaned article",
    )
    check(
        "canonical-pending-event",
        canonical_topic.emitted and canonical_topic.emitted[-1]["article_id"] == article_id,
        "pending canonical event published with article_id key contract",
    )
    check(
        "redis-global-country",
        result.redis is not None
        and result.redis.projected
        and article_id in redis.sorted_sets.get("feed:global", {})
        and article_id in redis.sorted_sets.get("feed:country:504", {}),
        "Redis global and country feeds contain the pending article",
    )
    check(
        "redis-card-compact",
        "body_text" not in redis.hashes.get(f"article:{article_id}", {}),
        "Redis card excludes full body text",
    )

    replay = runtime.apply_news_change(news_change)
    check(
        "replay-idempotent",
        not replay.emitted
        and len(canonical_topic.emitted) == 1
        and list(redis.sorted_sets.get("feed:global", {}).keys()).count(article_id) == 1,
        "same CDC event does not duplicate cleaned, Kafka, or Redis state",
    )

    failed = False
    print("phase3 pending feed smoke report")
    for name, ok, detail in checks:
        print(f"[{'PASS' if ok else 'FAIL'}] {name}: {detail}")
        failed = failed or not ok
    if failed:
        print("phase3 pending feed smoke: failed", file=sys.stderr)
        return 1
    print("phase3 pending feed smoke: all checks passed")
    return 0


def _dimension_changes(decoder: DebeziumAvroCdcDecoder):
    fixtures = (
        ("table_links", {"id": 10, "link": "https://news.example/runtime", "domain": "news.example", "title": "Example News", "pays_id": 250}),
        ("table_authority", {"id": 2, "authority": "Example News", "domain": "news.example", "sedition_id": 30}),
        ("table_sedition", {"id": 30, "pays_id": 504}),
        ("table_pays", {"id": 504, "pays": "Morocco", "abr": "MA"}),
        ("table_rubrique", {"id": 3, "rubrique": "Politics"}),
        ("table_langue", {"id": 6, "langue": "French", "abr": "fr"}),
    )
    for table, after in fixtures:
        yield decoder.decode(
            key={"id": after["id"]},
            value={
                "op": "c",
                "source": {"schema": "public", "table": table},
                "after": after,
                "ts_ms": 1777200000000,
            },
        )


if __name__ == "__main__":
    raise SystemExit(main())
