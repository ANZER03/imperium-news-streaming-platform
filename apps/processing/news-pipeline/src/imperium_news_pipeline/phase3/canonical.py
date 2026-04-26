from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from html import unescape
import re
from typing import Any, Mapping, Protocol, Sequence


SCHEMA_VERSION = 1
CLASSIFICATION_STATUS_PENDING = "pending"
CLASSIFICATION_STATUS_CLASSIFIED = "classified"
CLASSIFICATION_STATUS_FAILED = "failed"
CLASSIFICATION_METHOD_EMBEDDING_SIMILARITY = "embedding_similarity"
DIMENSION_STATUS_PARTIAL = "partial"
DIMENSION_STATUS_COMPLETE = "complete"
DIMENSION_STATUS_PENDING_REQUIRED = "pending_required"


@dataclass(frozen=True)
class RawNewsRecord:
    """CDC-like projection of public.table_news used by the first tracer bullet."""

    id: int
    link_id: int | None = None
    authority_id: int | None = None
    rubrique_id: int | None = None
    langue_id: int | None = None
    more_title: str | None = None
    more_url: str | None = None
    more_inner_text: str | None = None
    more_reporter: str | None = None
    more_date_text: str | None = None
    more_image_url: str | None = None
    more_video_url: str | None = None
    more_meta_keywords: str | None = None
    more_meta_description: str | None = None
    pubdate: datetime | None = None
    crawl_date: datetime | None = None
    added_in: datetime | None = None
    updated_in: datetime | None = None
    valide: bool = False
    to_delete: bool = False
    isvideo: bool = False

    @classmethod
    def from_mapping(cls, row: Mapping[str, Any]) -> RawNewsRecord:
        return cls(
            id=_required_int(row, "id"),
            link_id=_optional_int(row.get("link_id")),
            authority_id=_optional_int(row.get("authority_id")),
            rubrique_id=_optional_int(row.get("rubrique_id")),
            langue_id=_optional_int(row.get("langue_id")),
            more_title=_optional_text(row.get("more_title")),
            more_url=_optional_text(row.get("more_url")),
            more_inner_text=_optional_text(row.get("more_inner_text")),
            more_reporter=_optional_text(row.get("more_reporter")),
            more_date_text=_optional_text(row.get("more_date_text")),
            more_image_url=_optional_text(row.get("more_image_url")),
            more_video_url=_optional_text(row.get("more_video_url")),
            more_meta_keywords=_optional_text(row.get("more_meta_keywords")),
            more_meta_description=_optional_text(row.get("more_meta_description")),
            pubdate=_optional_datetime(row.get("pubdate")),
            crawl_date=_optional_datetime(row.get("crawl_date")),
            added_in=_optional_datetime(row.get("added_in")),
            updated_in=_optional_datetime(row.get("updated_in")),
            valide=bool(row.get("valide", False)),
            to_delete=bool(row.get("to_delete", False)),
            isvideo=bool(row.get("isvideo", False)),
        )


@dataclass(frozen=True)
class CanonicalArticle:
    article_id: str
    source_news_id: int
    link_id: int | None
    authority_id: int | None
    country_id: int | None
    country_name: str | None
    source_name: str | None
    source_domain: str | None
    rubric_id: int | None
    rubric_title: str | None
    language_id: int | None
    language_code: str | None
    root_topic_id: int | None
    root_topic_label: str | None
    primary_topic_id: int | None
    primary_topic_label: str | None
    topic_confidence: float | None
    topic_candidates: tuple[Mapping[str, Any], ...]
    classification_status: str
    classification_method: str | None
    title: str
    url: str
    body_text: str
    body_text_clean: str
    excerpt: str
    image_url: str | None
    video_url: str | None
    reporter: str | None
    source_date_text: str | None
    published_at: datetime | None
    crawled_at: datetime | None
    meta_keywords: str | None
    meta_description: str | None
    is_video: bool
    is_valid: bool
    is_visible: bool
    is_deleted: bool
    dimension_status: str
    missing_dimensions: tuple[str, ...]
    classification_model: str | None
    classified_at: datetime | None
    classification_input_hash: str | None
    schema_version: int
    processed_at: datetime

    def to_event(self) -> dict[str, Any]:
        return {
            "article_id": self.article_id,
            "source_news_id": self.source_news_id,
            "link_id": self.link_id,
            "authority_id": self.authority_id,
            "country_id": self.country_id,
            "country_name": self.country_name,
            "source_name": self.source_name,
            "source_domain": self.source_domain,
            "rubric_id": self.rubric_id,
            "rubric_title": self.rubric_title,
            "language_id": self.language_id,
            "language_code": self.language_code,
            "root_topic_id": self.root_topic_id,
            "root_topic_label": self.root_topic_label,
            "primary_topic_id": self.primary_topic_id,
            "primary_topic_label": self.primary_topic_label,
            "topic_confidence": self.topic_confidence,
            "topic_candidates": list(self.topic_candidates),
            "classification_status": self.classification_status,
            "classification_method": self.classification_method,
            "title": self.title,
            "url": self.url,
            "body_text": self.body_text,
            "body_text_clean": self.body_text_clean,
            "excerpt": self.excerpt,
            "image_url": self.image_url,
            "video_url": self.video_url,
            "reporter": self.reporter,
            "source_date_text": self.source_date_text,
            "published_at": _iso_or_none(self.published_at),
            "crawled_at": _iso_or_none(self.crawled_at),
            "meta_keywords": self.meta_keywords,
            "meta_description": self.meta_description,
            "is_video": self.is_video,
            "is_valid": self.is_valid,
            "is_visible": self.is_visible,
            "is_deleted": self.is_deleted,
            "dimension_status": self.dimension_status,
            "missing_dimensions": list(self.missing_dimensions),
            "classification_model": self.classification_model,
            "classified_at": _iso_or_none(self.classified_at),
            "classification_input_hash": self.classification_input_hash,
            "schema_version": self.schema_version,
            "processed_at": _iso_or_none(self.processed_at),
        }


def canonical_article_from_event(event: Mapping[str, Any]) -> CanonicalArticle:
    return CanonicalArticle(
        article_id=str(event["article_id"]),
        source_news_id=_required_int(event, "source_news_id"),
        link_id=_optional_int(event.get("link_id")),
        authority_id=_optional_int(event.get("authority_id")),
        country_id=_optional_int(event.get("country_id")),
        country_name=normalize_optional_text(event.get("country_name")),
        source_name=normalize_optional_text(event.get("source_name")),
        source_domain=normalize_optional_text(event.get("source_domain")),
        rubric_id=_optional_int(event.get("rubric_id")),
        rubric_title=normalize_optional_text(event.get("rubric_title")),
        language_id=_optional_int(event.get("language_id")),
        language_code=normalize_optional_text(event.get("language_code")),
        root_topic_id=_optional_int(event.get("root_topic_id")),
        root_topic_label=normalize_optional_text(event.get("root_topic_label")),
        primary_topic_id=_optional_int(event.get("primary_topic_id")),
        primary_topic_label=normalize_optional_text(event.get("primary_topic_label")),
        topic_confidence=_optional_float(event.get("topic_confidence")),
        topic_candidates=tuple(event.get("topic_candidates") or ()),
        classification_status=str(event["classification_status"]),
        classification_method=normalize_optional_text(event.get("classification_method")),
        title=str(event.get("title") or ""),
        url=str(event.get("url") or ""),
        body_text=str(event.get("body_text") or ""),
        body_text_clean=str(event.get("body_text_clean") or ""),
        excerpt=str(event.get("excerpt") or ""),
        image_url=normalize_optional_text(event.get("image_url")),
        video_url=normalize_optional_text(event.get("video_url")),
        reporter=normalize_optional_text(event.get("reporter")),
        source_date_text=normalize_optional_text(event.get("source_date_text")),
        published_at=_optional_datetime(event.get("published_at")),
        crawled_at=_optional_datetime(event.get("crawled_at")),
        meta_keywords=normalize_optional_text(event.get("meta_keywords")),
        meta_description=normalize_optional_text(event.get("meta_description")),
        is_video=bool(event.get("is_video", False)),
        is_valid=bool(event.get("is_valid", False)),
        is_visible=bool(event.get("is_visible", False)),
        is_deleted=bool(event.get("is_deleted", False)),
        dimension_status=str(event.get("dimension_status") or ""),
        missing_dimensions=tuple(event.get("missing_dimensions") or ()),
        classification_model=normalize_optional_text(event.get("classification_model")),
        classified_at=_optional_datetime(event.get("classified_at")),
        classification_input_hash=normalize_optional_text(event.get("classification_input_hash")),
        schema_version=int(event.get("schema_version", SCHEMA_VERSION)),
        processed_at=_optional_datetime(event.get("processed_at")) or datetime.now(timezone.utc),
    )


@dataclass(frozen=True)
class CleanedArticleRecord:
    article_id: str
    source_news_id: int
    payload: Mapping[str, Any]


@dataclass(frozen=True)
class ProcessResult:
    article: CanonicalArticle
    emitted: bool


class ArticleIdProvider(Protocol):
    def article_id_for(self, source_news_id: int) -> str:
        ...


class Clock(Protocol):
    def now(self) -> datetime:
        ...


class CleanedArticleRepository(Protocol):
    def upsert(self, record: CleanedArticleRecord) -> bool:
        """Return True when this event should be emitted for the upserted state."""

    def upsert_many(self, records: Sequence[CleanedArticleRecord]) -> tuple[bool, ...]:
        """Return one emit decision per submitted record in the same order."""


class CanonicalArticleProducer(Protocol):
    def emit(self, article: CanonicalArticle) -> None:
        ...

    def emit_many(self, articles: Sequence[CanonicalArticle]) -> None:
        ...


class NewsArticleIdProvider:
    def article_id_for(self, source_news_id: int) -> str:
        return f"news:{source_news_id}"


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(timezone.utc)


@dataclass
class CanonicalArticleBuilder:
    id_provider: ArticleIdProvider
    clock: Clock
    schema_version: int = SCHEMA_VERSION
    excerpt_word_limit: int = 30

    def build(self, raw: RawNewsRecord, dimensions: Any | None = None) -> CanonicalArticle:
        title = normalize_text(raw.more_title)
        url = normalize_text(raw.more_url)
        published_at = raw.pubdate or raw.crawl_date
        crawled_at = raw.crawl_date or raw.added_in

        missing_required = []
        if not title:
            missing_required.append("title")
        if not url:
            missing_required.append("url")
        if published_at is None and crawled_at is None:
            missing_required.append("published_at_or_crawled_at")

        body_text = normalize_text(raw.more_inner_text)
        body_text_clean = clean_body_text(body_text)
        missing_dimensions = (*_missing_dimension_names(raw), *_snapshot_missing_dimensions(dimensions))

        if missing_required:
            dimension_status = DIMENSION_STATUS_PENDING_REQUIRED
        elif missing_dimensions:
            dimension_status = DIMENSION_STATUS_PARTIAL
        else:
            dimension_status = DIMENSION_STATUS_COMPLETE

        is_deleted = bool(raw.to_delete)
        is_valid = bool(raw.valide) and not missing_required

        return CanonicalArticle(
            article_id=self.id_provider.article_id_for(raw.id),
            source_news_id=raw.id,
            link_id=raw.link_id,
            authority_id=raw.authority_id,
            country_id=getattr(dimensions, "country_id", None),
            country_name=getattr(dimensions, "country_name", None),
            source_name=getattr(dimensions, "source_name", None),
            source_domain=getattr(dimensions, "source_domain", None),
            rubric_id=raw.rubrique_id,
            rubric_title=getattr(dimensions, "rubric_title", None),
            language_id=getattr(dimensions, "language_id", raw.langue_id),
            language_code=getattr(dimensions, "language_code", None),
            root_topic_id=None,
            root_topic_label=None,
            primary_topic_id=None,
            primary_topic_label=None,
            topic_confidence=None,
            topic_candidates=(),
            classification_status=CLASSIFICATION_STATUS_PENDING,
            classification_method=None,
            title=title,
            url=url,
            body_text=body_text,
            body_text_clean=body_text_clean,
            excerpt=first_words(body_text_clean, self.excerpt_word_limit),
            image_url=normalize_optional_text(raw.more_image_url),
            video_url=normalize_optional_text(raw.more_video_url),
            reporter=normalize_optional_text(raw.more_reporter),
            source_date_text=normalize_optional_text(raw.more_date_text),
            published_at=published_at,
            crawled_at=crawled_at,
            meta_keywords=normalize_optional_text(raw.more_meta_keywords),
            meta_description=normalize_optional_text(raw.more_meta_description),
            is_video=bool(raw.isvideo),
            is_valid=is_valid,
            is_visible=is_valid and not is_deleted,
            is_deleted=is_deleted,
            dimension_status=dimension_status,
            missing_dimensions=tuple((*missing_required, *missing_dimensions)),
            classification_model=None,
            classified_at=None,
            classification_input_hash=None,
            schema_version=self.schema_version,
            processed_at=self.clock.now(),
        )


@dataclass
class CanonicalArticleFirstEmitProcessor:
    builder: CanonicalArticleBuilder
    repository: CleanedArticleRepository
    producer: CanonicalArticleProducer
    dimension_enrichment: Any | None = None

    def process(self, raw: RawNewsRecord) -> ProcessResult:
        return self.process_many((raw,))[0]

    def process_many(self, raws: Sequence[RawNewsRecord]) -> tuple[ProcessResult, ...]:
        if not raws:
            return ()
        dimensions = None
        records: list[CleanedArticleRecord] = []
        articles: list[CanonicalArticle] = []
        for raw in raws:
            if self.dimension_enrichment is not None:
                dimensions = self.dimension_enrichment.snapshot_for(
                    link_id=raw.link_id,
                    authority_id=raw.authority_id,
                    rubric_id=raw.rubrique_id,
                    language_id=raw.langue_id,
                )
            else:
                dimensions = None
            article = self.builder.build(raw, dimensions=dimensions)
            articles.append(article)
            records.append(
                CleanedArticleRecord(
                    article_id=article.article_id,
                    source_news_id=article.source_news_id,
                    payload=article.to_event(),
                )
            )
        decisions = self.repository.upsert_many(records)
        emitted_articles = [article for article, should_emit in zip(articles, decisions) if should_emit]
        if emitted_articles:
            self.producer.emit_many(emitted_articles)
        return tuple(
            ProcessResult(article=article, emitted=should_emit)
            for article, should_emit in zip(articles, decisions)
        )


@dataclass
class InMemoryCleanedArticleRepository:
    rows: dict[str, Mapping[str, Any]] = field(default_factory=dict)

    def upsert(self, record: CleanedArticleRecord) -> bool:
        return self.upsert_many((record,))[0]

    def upsert_many(self, records: Sequence[CleanedArticleRecord]) -> tuple[bool, ...]:
        decisions = []
        for record in records:
            existing = self.rows.get(record.article_id)
            if existing == record.payload:
                decisions.append(False)
                continue
            self.rows[record.article_id] = dict(record.payload)
            decisions.append(True)
        return tuple(decisions)


@dataclass
class InMemoryCanonicalArticleProducer:
    emitted: list[dict[str, Any]] = field(default_factory=list)

    def emit(self, article: CanonicalArticle) -> None:
        self.emit_many((article,))

    def emit_many(self, articles: Sequence[CanonicalArticle]) -> None:
        self.emitted.extend(article.to_event() for article in articles)


def normalize_text(value: str | None) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", unescape(str(value))).strip()


def normalize_optional_text(value: str | None) -> str | None:
    normalized = normalize_text(value)
    return normalized or None


def clean_body_text(value: str | None) -> str:
    text = normalize_text(value)
    text = re.sub(r"<[^>]+>", " ", text)
    return normalize_text(text)


def first_words(value: str, limit: int) -> str:
    return " ".join(value.split()[:limit])


def _missing_dimension_names(raw: RawNewsRecord) -> tuple[str, ...]:
    missing = []
    if not raw.link_id:
        missing.append("link_id")
    if not raw.authority_id:
        missing.append("authority_id")
    if not raw.rubrique_id:
        missing.append("rubric_id")
    return tuple(missing)


def _snapshot_missing_dimensions(dimensions: Any | None) -> tuple[str, ...]:
    if dimensions is None:
        return ()
    return tuple(getattr(dimensions, "missing_optional", ()))


def _required_int(row: Mapping[str, Any], key: str) -> int:
    value = row.get(key)
    if value is None:
        raise ValueError(f"missing required field: {key}")
    return int(value)


def _optional_int(value: Any) -> int | None:
    if value in (None, "", 0, "0"):
        return None
    return int(value)


def _optional_float(value: Any) -> float | None:
    if value is None or value == "":
        return None
    return float(value)


def _optional_text(value: Any) -> str | None:
    if value is None:
        return None
    return str(value)


def _optional_datetime(value: Any) -> datetime | None:
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    if isinstance(value, (int, float)):
        return _epoch_datetime(value)
    text = str(value).strip()
    if text.isdigit():
        return _epoch_datetime(int(text))
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def _epoch_datetime(value: int | float) -> datetime:
    numeric = float(value)
    if numeric >= 1_000_000_000_000_000:
        return datetime.fromtimestamp(numeric / 1_000_000, tz=timezone.utc)
    if numeric >= 1_000_000_000_000:
        return datetime.fromtimestamp(numeric / 1_000, tz=timezone.utc)
    return datetime.fromtimestamp(numeric, tz=timezone.utc)


def _iso_or_none(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()
