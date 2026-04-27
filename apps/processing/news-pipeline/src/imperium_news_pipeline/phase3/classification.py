from __future__ import annotations

from dataclasses import dataclass, field, replace
from hashlib import sha256
import math
from typing import Protocol, Sequence

from imperium_news_pipeline.phase3.canonical import (
    CLASSIFICATION_METHOD_EMBEDDING_SIMILARITY,
    CLASSIFICATION_STATUS_CLASSIFIED,
    CLASSIFICATION_STATUS_FAILED,
    CanonicalArticle,
    CanonicalArticleProducer,
    CleanedArticleRecord,
    CleanedArticleRepository,
    Clock,
)
from imperium_news_pipeline.phase3.embedding_gateway import (
    EmbeddingGatewayResult,
    EmbeddingRequestItem,
)
from imperium_news_pipeline.phase3.topics import (
    DEFAULT_EMBEDDING_MODEL,
    Topic,
    TopicEmbedding,
    TopicEmbeddingRepository,
    TopicTaxonomyService,
)


CLASSIFICATION_BODY_WORD_LIMIT = 30


class ArticleEmbeddingGateway(Protocol):
    def embed(self, items: Sequence[EmbeddingRequestItem]) -> EmbeddingGatewayResult:
        ...


@dataclass(frozen=True)
class TopicMatch:
    topic: Topic
    root_topic: Topic
    similarity: float

    def to_candidate(self) -> dict[str, object]:
        return {
            "topic_id": self.topic.topic_id,
            "topic_label": self.topic.display_name,
            "root_topic_id": self.root_topic.topic_id,
            "root_topic_label": self.root_topic.display_name,
            "similarity": self.similarity,
        }


@dataclass
class EmbeddingSimilarityClassifier:
    gateway: ArticleEmbeddingGateway
    taxonomy_service: TopicTaxonomyService
    topic_embedding_repository: TopicEmbeddingRepository
    embedding_model: str = DEFAULT_EMBEDDING_MODEL
    taxonomy_version: str | None = None
    _leaf_topics_cache: dict[tuple[str | None], dict[int, Topic]] = field(default_factory=dict)
    _root_topics_cache: dict[tuple[str | None], dict[int, Topic]] = field(default_factory=dict)
    _topic_embeddings_cache: dict[tuple[str | None, str], tuple[TopicEmbedding, ...]] = field(default_factory=dict)

    def classify(self, article: CanonicalArticle) -> CanonicalArticle:
        return self.classify_many((article,))[0]

    def classify_many(self, articles: Sequence[CanonicalArticle]) -> tuple[CanonicalArticle, ...]:
        if not articles:
            return ()
        leaf_topics = self._leaf_topics()
        topic_embeddings = self._topic_embeddings(leaf_topics)
        root_topics = self._root_topics(leaf_topics)
        inputs = {
            article.article_id: classification_input_text(article)
            for article in articles
        }
        result = self.gateway.embed(
            tuple(EmbeddingRequestItem(article.article_id, inputs[article.article_id]) for article in articles)
        )
        classified = []
        for article in articles:
            article_embedding = result.embeddings.get(article.article_id)
            if article_embedding is None:
                classified.append(self._failed_article(article, inputs[article.article_id]))
                continue

            matches = self._rank_topic_matches(article_embedding, leaf_topics, topic_embeddings, root_topics)
            if not matches:
                classified.append(self._failed_article(article, inputs[article.article_id]))
                continue

            primary = matches[0]
            candidates = tuple(match.to_candidate() for match in matches[:3])
            classified.append(
                replace(
                    article,
                    root_topic_id=primary.root_topic.topic_id,
                    root_topic_label=primary.root_topic.display_name,
                    primary_topic_id=primary.topic.topic_id,
                    primary_topic_label=primary.topic.display_name,
                    topic_confidence=primary.similarity,
                    topic_candidates=candidates,
                    classification_status=CLASSIFICATION_STATUS_CLASSIFIED,
                    classification_method=CLASSIFICATION_METHOD_EMBEDDING_SIMILARITY,
                    classification_model=self.embedding_model,
                    classified_at=article.processed_at,
                    classification_input_hash=_input_hash(inputs[article.article_id]),
                )
            )
        return tuple(classified)

    def _leaf_topics(self) -> dict[int, Topic]:
        cache_key = (self.taxonomy_version,)
        cached = self._leaf_topics_cache.get(cache_key)
        if cached is None:
            cached = {
                topic.topic_id: topic
                for topic in self.taxonomy_service.active_leaf_topics(self.taxonomy_version)
            }
            self._leaf_topics_cache[cache_key] = cached
        return cached

    def _root_topics(self, leaf_topics: dict[int, Topic]) -> dict[int, Topic]:
        cache_key = (self.taxonomy_version,)
        cached = self._root_topics_cache.get(cache_key)
        if cached is None:
            cached = {
                topic_id: self.taxonomy_service.root_for_leaf(topic_id, self.taxonomy_version)
                for topic_id in leaf_topics
            }
            self._root_topics_cache[cache_key] = cached
        return cached

    def _topic_embeddings(self, leaf_topics: dict[int, Topic]) -> tuple[TopicEmbedding, ...]:
        cache_key = (self.taxonomy_version, self.embedding_model)
        cached = self._topic_embeddings_cache.get(cache_key)
        if cached is None:
            cached = tuple(
                embedding
                for embedding in self.topic_embedding_repository.list_active_embeddings(
                    taxonomy_version=self.taxonomy_version,
                    embedding_model=self.embedding_model,
                )
                if embedding.topic_id in leaf_topics
            )
            self._topic_embeddings_cache[cache_key] = cached
        return cached

    def _rank_topic_matches(
        self,
        article_embedding: Sequence[float],
        leaf_topics: dict[int, Topic],
        embeddings: Sequence[TopicEmbedding],
        root_topics: dict[int, Topic],
    ) -> tuple[TopicMatch, ...]:
        matches = []
        for embedding in embeddings:
            topic = leaf_topics.get(embedding.topic_id)
            if topic is None:
                continue
            root_topic = root_topics[topic.topic_id]
            matches.append(
                TopicMatch(
                    topic=topic,
                    root_topic=root_topic,
                    similarity=cosine_similarity(article_embedding, embedding.embedding_vector),
                )
            )
        return tuple(sorted(matches, key=lambda match: match.similarity, reverse=True))

    def _failed_article(self, article: CanonicalArticle, input_text: str) -> CanonicalArticle:
        return replace(
            article,
            root_topic_id=None,
            root_topic_label=None,
            primary_topic_id=None,
            primary_topic_label=None,
            topic_confidence=None,
            topic_candidates=(),
            classification_status=CLASSIFICATION_STATUS_FAILED,
            classification_method=CLASSIFICATION_METHOD_EMBEDDING_SIMILARITY,
            classification_model=self.embedding_model,
            classified_at=article.processed_at,
            classification_input_hash=_input_hash(input_text),
        )


@dataclass
class ArticleClassificationProcessor:
    classifier: EmbeddingSimilarityClassifier
    repository: CleanedArticleRepository
    producer: CanonicalArticleProducer
    clock: Clock

    def process(self, article: CanonicalArticle) -> bool:
        return self.process_many((article,))[0]

    def process_many(self, articles: Sequence[CanonicalArticle]) -> tuple[bool, ...]:
        if not articles:
            return ()
        processed_at = self.clock.now()
        classified_articles = tuple(
            replace(
                classified,
                processed_at=processed_at,
                classified_at=processed_at,
            )
            for classified in self.classifier.classify_many(articles)
        )
        decisions = self.repository.upsert_many(
            tuple(
                CleanedArticleRecord(
                    article_id=classified.article_id,
                    source_news_id=classified.source_news_id,
                    payload=classified.to_event(),
                )
                for classified in classified_articles
            )
        )
        emitted_articles = [article for article, should_emit in zip(classified_articles, decisions) if should_emit]
        if emitted_articles:
            self.producer.emit_many(emitted_articles)
        return tuple(decisions)


def classification_input_text(article: CanonicalArticle) -> str:
    body_words = " ".join(article.body_text_clean.split()[:CLASSIFICATION_BODY_WORD_LIMIT])
    parts = [article.title.strip(), body_words.strip()]
    return "\n".join(part for part in parts if part)


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right):
        raise ValueError("embedding vectors must have the same dimension")
    dot = sum(a * b for a, b in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def _input_hash(input_text: str) -> str:
    return sha256(input_text.encode("utf-8")).hexdigest()
