from __future__ import annotations

from dataclasses import dataclass, field, replace
from datetime import datetime, timezone
import sys

from imperium_news_pipeline.phase3.canonical import (
    CanonicalArticleBuilder,
    CanonicalArticleFirstEmitProcessor,
    InMemoryCanonicalArticleProducer,
    InMemoryCleanedArticleRepository,
    NewsArticleIdProvider,
    RawNewsRecord,
)
from imperium_news_pipeline.phase3.classification import (
    ArticleClassificationProcessor,
    EmbeddingSimilarityClassifier,
)
from imperium_news_pipeline.phase3.dimensions import (
    DimensionEnrichmentService,
    DimensionMaterializer,
    InMemoryDimensionRepository,
    authority_dimension,
    country_dimension,
    language_dimension,
    link_dimension,
    rubric_dimension,
    sedition_dimension,
)
from imperium_news_pipeline.phase3.embedding_gateway import EmbeddingGatewayResult, EmbeddingRequestItem
from imperium_news_pipeline.phase3.projection_fanout import ProjectionFanout
from imperium_news_pipeline.phase3.projection_state import InMemoryProjectionStateRepository
from imperium_news_pipeline.phase3.qdrant_projection import (
    InMemoryArticleVectorGateway,
    InMemoryQdrantClient,
    QdrantArticleProjector,
    qdrant_point_id,
)
from imperium_news_pipeline.phase3.redis_projection import InMemoryRedisClient, RedisFeedProjector
from imperium_news_pipeline.phase3.topics import (
    DEFAULT_EMBEDDING_MODEL,
    InMemoryTopicEmbeddingRepository,
    InMemoryTopicTaxonomyRepository,
    TopicEmbedding,
    TopicTaxonomyService,
    seed_phase3_topics,
)


@dataclass
class FixedClock:
    value: datetime

    def now(self) -> datetime:
        return self.value


@dataclass
class StaticGateway:
    vectors: dict[str, tuple[float, ...]]
    calls: list[tuple[EmbeddingRequestItem, ...]] = field(default_factory=list)

    def embed(self, items) -> EmbeddingGatewayResult:
        item_tuple = tuple(items)
        self.calls.append(item_tuple)
        return EmbeddingGatewayResult(
            embeddings={
                item.item_id: self.vectors[item.item_id]
                for item in item_tuple
                if item.item_id in self.vectors
            }
        )


def main() -> int:
    checks: list[tuple[str, bool, str]] = []

    def check(name: str, ok: bool, detail: str) -> None:
        checks.append((name, ok, detail))

    dim_repo = InMemoryDimensionRepository()
    materializer = DimensionMaterializer(repository=dim_repo)
    for record in (
        link_dimension({"id": 10, "url": "https://news.example/election", "domain": "news.example", "source_name": "Example News", "pays_id": 504}),
        authority_dimension({"id": 2, "name": "Example News", "domain": "news.example", "sedition_id": 30}),
        sedition_dimension({"id": 30, "pays_id": 504}),
        country_dimension({"id": 504, "name": "Morocco"}),
        rubric_dimension({"id": 3, "title": "Politics"}),
        language_dimension({"id": 6, "code": "fr"}),
    ):
        materializer.materialize(record)
    check(
        "dimension-materialization",
        dim_repo.get("links", 10) is not None and dim_repo.get("countries", 504) is not None,
        "curated dimensions written from CDC-like input",
    )

    cleaned_repo = InMemoryCleanedArticleRepository()
    first_emit_producer = InMemoryCanonicalArticleProducer()
    first_emit_processor = CanonicalArticleFirstEmitProcessor(
        builder=CanonicalArticleBuilder(
            id_provider=NewsArticleIdProvider(),
            clock=FixedClock(datetime(2026, 4, 25, 12, 0, tzinfo=timezone.utc)),
        ),
        repository=cleaned_repo,
        producer=first_emit_producer,
        dimension_enrichment=DimensionEnrichmentService(dim_repo),
    )
    pending = first_emit_processor.process(
        RawNewsRecord(
            id=7001,
            link_id=10,
            authority_id=2,
            rubrique_id=3,
            langue_id=6,
            more_title="Election debate drives turnout",
            more_url="https://news.example/election",
            more_inner_text="Election candidates debate turnout and campaign strategy for next vote.",
            pubdate=datetime(2026, 4, 24, 8, 30, tzinfo=timezone.utc),
            valide=True,
        )
    ).article
    check(
        "canonical-first-emit",
        pending.classification_status == "pending" and pending.country_id == 504 and pending.dimension_status == "complete",
        "canonical article created using curated dimensions",
    )
    check(
        "cleaned-postgres-shape",
        cleaned_repo.rows[pending.article_id]["classification_status"] == "pending",
        "cleaned article row persisted with expected pending status",
    )

    redis = InMemoryRedisClient()
    redis_projector = RedisFeedProjector(redis)
    pending_redis = redis_projector.project(pending)
    check(
        "redis-pre-classification",
        pending_redis.projected
        and pending.article_id in redis.sorted_sets.get("feed:global", {})
        and pending.article_id in redis.sorted_sets.get("feed:country:504", {}),
        "global and country feeds projected before classification",
    )

    classifier = EmbeddingSimilarityClassifier(
        gateway=StaticGateway({pending.article_id: (1.0, 0.0)}),
        taxonomy_service=TopicTaxonomyService(InMemoryTopicTaxonomyRepository(seed_phase3_topics())),
        topic_embedding_repository=InMemoryTopicEmbeddingRepository(
            (
                TopicEmbedding(101, "phase3-v1", DEFAULT_EMBEDDING_MODEL, 2, "elections", "a", (1.0, 0.0)),
                TopicEmbedding(201, "phase3-v1", DEFAULT_EMBEDDING_MODEL, 2, "markets", "b", (0.8, 0.2)),
                TopicEmbedding(301, "phase3-v1", DEFAULT_EMBEDDING_MODEL, 2, "ai", "c", (0.0, 1.0)),
            )
        ),
    )
    classification_producer = InMemoryCanonicalArticleProducer()
    classification_processor = ArticleClassificationProcessor(
        classifier=classifier,
        repository=cleaned_repo,
        producer=classification_producer,
        clock=FixedClock(datetime(2026, 4, 25, 12, 1, tzinfo=timezone.utc)),
    )
    classification_processor.process(pending)
    classified_event = classification_producer.emitted[-1]
    check(
        "classification-update",
        classified_event["classification_status"] == "classified"
        and classified_event["root_topic_id"] == 100
        and len(classified_event["topic_candidates"]) == 3,
        "classification adds root topic and candidates",
    )

    classified = replace(
        pending,
        root_topic_id=classified_event["root_topic_id"],
        root_topic_label=classified_event["root_topic_label"],
        primary_topic_id=classified_event["primary_topic_id"],
        primary_topic_label=classified_event["primary_topic_label"],
        topic_confidence=classified_event["topic_confidence"],
        topic_candidates=tuple(classified_event["topic_candidates"]),
        classification_status=classified_event["classification_status"],
        classification_method=classified_event["classification_method"],
        classification_model=classified_event["classification_model"],
        classified_at=datetime.fromisoformat(classified_event["classified_at"]),
        classification_input_hash=classified_event["classification_input_hash"],
        processed_at=datetime.fromisoformat(classified_event["processed_at"]),
    )

    qdrant = InMemoryQdrantClient()
    projection_state = InMemoryProjectionStateRepository()
    fanout = ProjectionFanout(
        redis=redis_projector,
        qdrant=QdrantArticleProjector(
            qdrant=qdrant,
            vectors=InMemoryArticleVectorGateway({classified.article_id: (0.11, 0.22, 0.33)}),
        ),
        projection_state=projection_state,
    )
    first_projection = fanout.project(classified)
    check(
        "redis-root-topic-update",
        first_projection.redis.updated_topic_feeds
        and classified.article_id in redis.sorted_sets.get("feed:topic:100", {})
        and classified.article_id in redis.sorted_sets.get("feed:country:504:topic:100", {}),
        "root topic feeds updated after classification",
    )
    point = qdrant.points.get(qdrant_point_id(classified), {})
    payload = point.get("payload", {})
    check(
        "qdrant-payload",
        bool(point)
        and payload.get("country_id") == 504
        and payload.get("root_topic_id") == 100
        and payload.get("is_visible") is True,
        "qdrant payload has required filters and visibility",
    )

    replay = fanout.project(classified)
    check(
        "replay-idempotency",
        replay.replay_skipped and qdrant.upsert_count == 1,
        "same classified replay does not create duplicates",
    )

    hidden = replace(classified, is_visible=False, is_deleted=True)
    hidden_projection = fanout.project(hidden)
    hidden_payload = qdrant.points.get(qdrant_point_id(classified), {}).get("payload", {})
    check(
        "delete-visibility-cleanup",
        hidden_projection.redis.removed
        and classified.article_id not in redis.sorted_sets.get("feed:global", {})
        and classified.article_id not in redis.sorted_sets.get("feed:country:504", {})
        and classified.article_id not in redis.sorted_sets.get("feed:topic:100", {})
        and hidden_payload.get("is_visible") is False,
        "redis cleanup + qdrant invisible on delete/visibility update",
    )

    print("phase3 e2e smoke report")
    has_failure = False
    for name, ok, detail in checks:
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] {name}: {detail}")
        if not ok:
            has_failure = True

    if has_failure:
        print("phase3 e2e smoke: failed", file=sys.stderr)
        return 1
    print("phase3 e2e smoke: all checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
