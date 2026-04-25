from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Protocol

from imperium_news_pipeline.phase3.canonical import CanonicalArticle


class RedisClient(Protocol):
    def hset(self, key: str, mapping: dict[str, str]) -> None:
        ...

    def zadd(self, key: str, mapping: dict[str, float]) -> None:
        ...

    def delete(self, key: str) -> None:
        ...

    def zrem(self, key: str, member: str) -> None:
        ...


@dataclass(frozen=True)
class RedisProjectionResult:
    projected: bool
    removed: bool
    errors: tuple[str, ...] = ()


@dataclass
class RedisFeedProjector:
    redis: RedisClient

    def project(self, article: CanonicalArticle) -> RedisProjectionResult:
        try:
            if article.is_deleted or not article.is_visible:
                self._remove(article)
                return RedisProjectionResult(projected=False, removed=True)
            if not self._eligible_for_global_feed(article):
                return RedisProjectionResult(projected=False, removed=False)

            score = _score(article.published_at or article.crawled_at)
            self.redis.hset(_article_key(article.article_id), _feed_card(article))
            self.redis.zadd("feed:global", {article.article_id: score})
            if article.country_id is not None:
                self.redis.zadd(f"feed:country:{article.country_id}", {article.article_id: score})
            return RedisProjectionResult(projected=True, removed=False)
        except Exception as exc:  # pragma: no cover - branch asserted via behavior, exact client error varies.
            return RedisProjectionResult(projected=False, removed=False, errors=(str(exc),))

    def _remove(self, article: CanonicalArticle) -> None:
        self.redis.delete(_article_key(article.article_id))
        self.redis.zrem("feed:global", article.article_id)
        if article.country_id is not None:
            self.redis.zrem(f"feed:country:{article.country_id}", article.article_id)
        if article.root_topic_id is not None:
            self.redis.zrem(f"feed:topic:{article.root_topic_id}", article.article_id)
            if article.country_id is not None:
                self.redis.zrem(f"feed:country:{article.country_id}:topic:{article.root_topic_id}", article.article_id)

    def _eligible_for_global_feed(self, article: CanonicalArticle) -> bool:
        return bool(article.title and article.url and (article.published_at or article.crawled_at))


@dataclass
class InMemoryRedisClient:
    hashes: dict[str, dict[str, str]] = field(default_factory=dict)
    sorted_sets: dict[str, dict[str, float]] = field(default_factory=dict)
    fail_writes: bool = False

    def hset(self, key: str, mapping: dict[str, str]) -> None:
        self._maybe_fail()
        self.hashes[key] = dict(mapping)

    def zadd(self, key: str, mapping: dict[str, float]) -> None:
        self._maybe_fail()
        values = dict(self.sorted_sets.get(key, {}))
        values.update(mapping)
        self.sorted_sets[key] = values

    def delete(self, key: str) -> None:
        self._maybe_fail()
        self.hashes.pop(key, None)

    def zrem(self, key: str, member: str) -> None:
        self._maybe_fail()
        if key in self.sorted_sets:
            self.sorted_sets[key].pop(member, None)

    def _maybe_fail(self) -> None:
        if self.fail_writes:
            raise RuntimeError("redis unavailable")


def _feed_card(article: CanonicalArticle) -> dict[str, str]:
    fields: dict[str, Any] = {
        "article_id": article.article_id,
        "title": article.title,
        "url": article.url,
        "excerpt": article.excerpt,
        "image_url": article.image_url,
        "source_name": article.source_name,
        "source_domain": article.source_domain,
        "rubric_title": article.rubric_title,
        "country_id": article.country_id,
        "country_name": article.country_name,
        "root_topic_id": article.root_topic_id,
        "root_topic_label": article.root_topic_label,
        "topic_confidence": article.topic_confidence,
        "published_at": _iso_or_none(article.published_at),
        "ingested_at": _iso_or_none(article.processed_at),
        "is_video": article.is_video,
        "has_image": bool(article.image_url),
    }
    return {key: str(value) for key, value in fields.items() if value is not None}


def _article_key(article_id: str) -> str:
    return f"article:{article_id}"


def _score(value: datetime | None) -> float:
    if value is None:
        return 0.0
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.timestamp()


def _iso_or_none(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()
