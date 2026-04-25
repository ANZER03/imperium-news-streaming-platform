from __future__ import annotations

from dataclasses import dataclass, replace
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

    def classify(self, article: CanonicalArticle) -> CanonicalArticle:
        input_text = classification_input_text(article)
        result = self.gateway.embed((EmbeddingRequestItem(article.article_id, input_text),))
        article_embedding = result.embeddings.get(article.article_id)
        if article_embedding is None:
            return self._failed_article(article, input_text)

        matches = self._rank_topic_matches(article_embedding)
        if not matches:
            return self._failed_article(article, input_text)

        primary = matches[0]
        candidates = tuple(match.to_candidate() for match in matches[:3])
        return replace(
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
            classification_input_hash=_input_hash(input_text),
        )

    def _rank_topic_matches(self, article_embedding: Sequence[float]) -> tuple[TopicMatch, ...]:
        leaf_topics = {
            topic.topic_id: topic
            for topic in self.taxonomy_service.active_leaf_topics(self.taxonomy_version)
        }
        embeddings = self.topic_embedding_repository.list_active_embeddings(
            taxonomy_version=self.taxonomy_version,
            embedding_model=self.embedding_model,
        )
        matches = []
        for embedding in embeddings:
            topic = leaf_topics.get(embedding.topic_id)
            if topic is None:
                continue
            root_topic = self.taxonomy_service.root_for_leaf(topic.topic_id, self.taxonomy_version)
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
        processed_at = self.clock.now()
        classified = replace(
            self.classifier.classify(article),
            processed_at=processed_at,
            classified_at=processed_at,
        )
        should_emit = self.repository.upsert(
            CleanedArticleRecord(
                article_id=classified.article_id,
                source_news_id=classified.source_news_id,
                payload=classified.to_event(),
            )
        )
        if should_emit:
            self.producer.emit(classified)
        return should_emit


def classification_input_text(article: CanonicalArticle) -> str:
    body_words = " ".join(article.body_text_clean.split()[:CLASSIFICATION_BODY_WORD_LIMIT])
    parts = [article.title.strip(), body_words.strip()]
    return "\n".join(part for part in parts if part)


def cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right):
        raise ValueError("embedding vectors must have the same dimension")
    dot = sum(a * b for a, b in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)


def _input_hash(input_text: str) -> str:
    return sha256(input_text.encode("utf-8")).hexdigest()
