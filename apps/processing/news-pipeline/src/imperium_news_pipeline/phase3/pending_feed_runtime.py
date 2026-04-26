from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable

from imperium_news_pipeline.phase3.canonical import (
    CanonicalArticle,
    CanonicalArticleBuilder,
    CanonicalArticleFirstEmitProcessor,
    CanonicalArticleProducer,
    CleanedArticleRepository,
    NewsArticleIdProvider,
    RawNewsRecord,
    SystemClock,
)
from imperium_news_pipeline.phase3.cdc import TableChangeRecord
from imperium_news_pipeline.phase3.dimensions import (
    DimensionEnrichmentService,
    DimensionMaterializer,
    DimensionRecord,
    DimensionRepository,
    authority_dimension,
    country_dimension,
    language_dimension,
    link_dimension,
    rubric_dimension,
    sedition_dimension,
)
from imperium_news_pipeline.phase3.redis_projection import RedisFeedProjector, RedisProjectionResult


DIMENSION_BUILDERS_BY_SOURCE_TABLE: dict[str, Callable[[dict], DimensionRecord]] = {
    "public.table_links": link_dimension,
    "public.table_authority": authority_dimension,
    "public.table_sedition": sedition_dimension,
    "public.table_pays": country_dimension,
    "public.table_rubrique": rubric_dimension,
    "public.table_langue": language_dimension,
}


@dataclass(frozen=True)
class PendingFeedResult:
    article: CanonicalArticle | None
    emitted: bool
    redis: RedisProjectionResult | None
    skipped_reason: str | None = None


@dataclass
class PendingCanonicalFeedRuntime:
    dimensions: DimensionMaterializer
    cleaned_articles: CleanedArticleRepository
    canonical_producer: CanonicalArticleProducer
    redis_projector: RedisFeedProjector
    dimension_repository: DimensionRepository
    clock: SystemClock
    window_days: int = 5

    @classmethod
    def from_repositories(
        cls,
        *,
        dimension_repository: DimensionRepository,
        cleaned_articles: CleanedArticleRepository,
        canonical_producer: CanonicalArticleProducer,
        redis_projector: RedisFeedProjector,
        clock: SystemClock | None = None,
        window_days: int = 5,
    ) -> PendingCanonicalFeedRuntime:
        return cls(
            dimensions=DimensionMaterializer(repository=dimension_repository),
            cleaned_articles=cleaned_articles,
            canonical_producer=canonical_producer,
            redis_projector=redis_projector,
            dimension_repository=dimension_repository,
            clock=clock or SystemClock(),
            window_days=window_days,
        )

    def apply_dimension_change(self, change: TableChangeRecord) -> bool:
        record = dimension_record_from_change(change)
        return self.dimensions.materialize(record)

    def apply_news_change(self, change: TableChangeRecord, *, project_redis: bool = True) -> PendingFeedResult:
        return self.apply_news_changes((change,), project_redis=project_redis)[0]

    def apply_news_changes(
        self,
        changes: tuple[TableChangeRecord, ...],
        *,
        project_redis: bool = True,
    ) -> tuple[PendingFeedResult, ...]:
        if not changes:
            return ()

        indexed_raws: list[tuple[int, RawNewsRecord]] = []
        results: list[PendingFeedResult | None] = [None] * len(changes)
        now = self.clock.now()
        for index, change in enumerate(changes):
            raw = raw_news_from_change(change)
            if raw is None:
                results[index] = PendingFeedResult(article=None, emitted=False, redis=None, skipped_reason="not-news")
                continue
            if not news_in_window(raw, now=now, window_days=self.window_days):
                results[index] = PendingFeedResult(article=None, emitted=False, redis=None, skipped_reason="outside-window")
                continue
            indexed_raws.append((index, raw))

        if not indexed_raws:
            return tuple(results)  # type: ignore[arg-type]

        processor = CanonicalArticleFirstEmitProcessor(
            builder=CanonicalArticleBuilder(id_provider=NewsArticleIdProvider(), clock=self.clock),
            repository=self.cleaned_articles,
            producer=self.canonical_producer,
            dimension_enrichment=DimensionEnrichmentService(self.dimension_repository),
        )
        batch_results = processor.process_many(tuple(raw for _, raw in indexed_raws))
        for (index, _raw), result in zip(indexed_raws, batch_results):
            redis_result = self.redis_projector.project(result.article) if result.emitted and project_redis else None
            results[index] = PendingFeedResult(article=result.article, emitted=result.emitted, redis=redis_result)
        return tuple(results)  # type: ignore[arg-type]


def dimension_record_from_change(change: TableChangeRecord) -> DimensionRecord:
    try:
        builder = DIMENSION_BUILDERS_BY_SOURCE_TABLE[change.source_table]
    except KeyError as exc:
        raise ValueError(f"unsupported dimension source table: {change.source_table}") from exc
    payload = dict(change.current_payload or {})
    payload["__deleted"] = change.is_delete
    payload["__event_timestamp"] = change.event_timestamp
    return builder(payload)


def raw_news_from_change(change: TableChangeRecord) -> RawNewsRecord | None:
    if change.source_table != "public.table_news":
        return None
    payload = dict(change.current_payload or {})
    if change.is_delete:
        payload["to_delete"] = True
    return RawNewsRecord.from_mapping(payload)


def news_in_window(raw: RawNewsRecord, *, now: datetime, window_days: int) -> bool:
    newest_timestamp = raw.updated_in or raw.pubdate or raw.crawl_date or raw.added_in
    if newest_timestamp is None:
        return False
    if newest_timestamp.tzinfo is None:
        newest_timestamp = newest_timestamp.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return newest_timestamp >= now - timedelta(days=window_days)
