from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Mapping, Protocol


DIMENSION_TOPIC_LINKS = "links"
DIMENSION_TOPIC_AUTHORITIES = "authorities"
DIMENSION_TOPIC_SEDITIONS = "seditions"
DIMENSION_TOPIC_COUNTRIES = "countries"
DIMENSION_TOPIC_RUBRICS = "rubrics"
DIMENSION_TOPIC_LANGUAGES = "languages"


@dataclass(frozen=True)
class DimensionRecord:
    dimension_type: str
    dimension_id: int
    payload: Mapping[str, Any]
    is_active: bool = True
    updated_at: datetime | None = None

    @property
    def compacted_topic_key(self) -> str:
        return f"{self.dimension_type}:{self.dimension_id}"


class DimensionRepository(Protocol):
    def upsert(self, record: DimensionRecord) -> bool:
        """Return True when the curated dimension state changed."""

    def get(self, dimension_type: str, dimension_id: int | None) -> DimensionRecord | None:
        ...


class DimensionEventProducer(Protocol):
    def publish(self, record: DimensionRecord) -> None:
        ...


@dataclass(frozen=True)
class DimensionSnapshot:
    link: Mapping[str, Any] | None = None
    authority: Mapping[str, Any] | None = None
    sedition: Mapping[str, Any] | None = None
    country: Mapping[str, Any] | None = None
    rubric: Mapping[str, Any] | None = None
    language: Mapping[str, Any] | None = None
    missing_optional: tuple[str, ...] = ()

    @property
    def country_id(self) -> int | None:
        return _optional_int(self.country, "country_id")

    @property
    def country_name(self) -> str | None:
        return _optional_text(self.country, "country_name")

    @property
    def source_name(self) -> str | None:
        return _optional_text(self.authority, "source_name") or _optional_text(self.link, "source_name")

    @property
    def source_domain(self) -> str | None:
        return _optional_text(self.authority, "source_domain") or _optional_text(self.link, "source_domain")

    @property
    def rubric_title(self) -> str | None:
        return _optional_text(self.rubric, "rubric_title")

    @property
    def language_id(self) -> int | None:
        return _optional_int(self.language, "language_id")

    @property
    def language_code(self) -> str | None:
        return _optional_text(self.language, "language_code")


@dataclass
class InMemoryDimensionRepository:
    rows: dict[str, Mapping[int, DimensionRecord]] = field(default_factory=dict)

    def upsert(self, record: DimensionRecord) -> bool:
        typed_rows = dict(self.rows.get(record.dimension_type, {}))
        existing = typed_rows.get(record.dimension_id)
        if existing == record:
            return False
        typed_rows[record.dimension_id] = record
        self.rows[record.dimension_type] = typed_rows
        return True

    def get(self, dimension_type: str, dimension_id: int | None) -> DimensionRecord | None:
        if dimension_id is None:
            return None
        record = self.rows.get(dimension_type, {}).get(dimension_id)
        if record is None or not record.is_active:
            return None
        return record


@dataclass
class InMemoryDimensionEventProducer:
    published: list[DimensionRecord] = field(default_factory=list)

    def publish(self, record: DimensionRecord) -> None:
        self.published.append(record)


@dataclass
class DimensionMaterializer:
    repository: DimensionRepository
    event_producer: DimensionEventProducer | None = None

    def materialize(self, record: DimensionRecord) -> bool:
        changed = self.repository.upsert(record)
        if changed and self.event_producer is not None:
            self.event_producer.publish(record)
        return changed


@dataclass
class DimensionEnrichmentService:
    repository: DimensionRepository

    def snapshot_for(self, link_id: int | None, authority_id: int | None, rubric_id: int | None, language_id: int | None) -> DimensionSnapshot:
        link = self.repository.get(DIMENSION_TOPIC_LINKS, link_id)
        authority = self.repository.get(DIMENSION_TOPIC_AUTHORITIES, authority_id)
        sedition_id = _optional_int(authority.payload if authority else None, "sedition_id")
        sedition = self.repository.get(DIMENSION_TOPIC_SEDITIONS, sedition_id)
        country_id = _optional_int(sedition.payload if sedition else None, "country_id")
        if country_id is None:
            country_id = _optional_int(link.payload if link else None, "country_id")
        country = self.repository.get(DIMENSION_TOPIC_COUNTRIES, country_id)
        rubric = self.repository.get(DIMENSION_TOPIC_RUBRICS, rubric_id)
        language = self.repository.get(DIMENSION_TOPIC_LANGUAGES, language_id)

        missing = []
        if link_id is not None and link is None:
            missing.append("link")
        if authority_id is not None and authority is None:
            missing.append("authority")
        if country_id is not None and country is None:
            missing.append("country")
        if rubric_id is not None and rubric is None:
            missing.append("rubric")
        if language_id is not None and language is None:
            missing.append("language")

        return DimensionSnapshot(
            link=link.payload if link else None,
            authority=authority.payload if authority else None,
            sedition=sedition.payload if sedition else None,
            country=country.payload if country else None,
            rubric=rubric.payload if rubric else None,
            language=language.payload if language else None,
            missing_optional=tuple(missing),
        )


def link_dimension(row: Mapping[str, Any]) -> DimensionRecord:
    return DimensionRecord(
        dimension_type=DIMENSION_TOPIC_LINKS,
        dimension_id=_required_int(row, "id"),
        payload={
            "link_id": _required_int(row, "id"),
            "url": _optional_text(row, "url"),
            "source_domain": _optional_text(row, "domain"),
            "source_name": _optional_text(row, "source_name"),
            "country_id": _optional_int(row, "pays_id"),
        },
        is_active=not bool(row.get("__deleted", False)),
    )


def authority_dimension(row: Mapping[str, Any]) -> DimensionRecord:
    return DimensionRecord(
        dimension_type=DIMENSION_TOPIC_AUTHORITIES,
        dimension_id=_required_int(row, "id"),
        payload={
            "authority_id": _required_int(row, "id"),
            "source_name": _optional_text(row, "name") or _optional_text(row, "title"),
            "source_domain": _optional_text(row, "domain"),
            "sedition_id": _optional_int(row, "sedition_id"),
        },
        is_active=not bool(row.get("__deleted", False)),
    )


def country_dimension(row: Mapping[str, Any]) -> DimensionRecord:
    return DimensionRecord(
        dimension_type=DIMENSION_TOPIC_COUNTRIES,
        dimension_id=_required_int(row, "id"),
        payload={"country_id": _required_int(row, "id"), "country_name": _optional_text(row, "name")},
        is_active=not bool(row.get("__deleted", False)),
    )


def sedition_dimension(row: Mapping[str, Any]) -> DimensionRecord:
    return DimensionRecord(
        dimension_type=DIMENSION_TOPIC_SEDITIONS,
        dimension_id=_required_int(row, "id"),
        payload={"sedition_id": _required_int(row, "id"), "country_id": _optional_int(row, "pays_id")},
        is_active=not bool(row.get("__deleted", False)),
    )


def rubric_dimension(row: Mapping[str, Any]) -> DimensionRecord:
    return DimensionRecord(
        dimension_type=DIMENSION_TOPIC_RUBRICS,
        dimension_id=_required_int(row, "id"),
        payload={"rubric_id": _required_int(row, "id"), "rubric_title": _optional_text(row, "title")},
        is_active=not bool(row.get("__deleted", False)),
    )


def language_dimension(row: Mapping[str, Any]) -> DimensionRecord:
    return DimensionRecord(
        dimension_type=DIMENSION_TOPIC_LANGUAGES,
        dimension_id=_required_int(row, "id"),
        payload={"language_id": _required_int(row, "id"), "language_code": _optional_text(row, "code")},
        is_active=not bool(row.get("__deleted", False)),
    )


def _required_int(row: Mapping[str, Any], key: str) -> int:
    value = row.get(key)
    if value is None:
        raise ValueError(f"missing required dimension field: {key}")
    return int(value)


def _optional_int(row: Mapping[str, Any] | None, key: str) -> int | None:
    if row is None:
        return None
    value = row.get(key)
    if value in (None, "", 0, "0"):
        return None
    return int(value)


def _optional_text(row: Mapping[str, Any] | None, key: str) -> str | None:
    if row is None:
        return None
    value = row.get(key)
    if value is None:
        return None
    text = str(value).strip()
    return text or None
