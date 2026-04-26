from __future__ import annotations

from dataclasses import dataclass, field
from hashlib import sha256
import json
from pathlib import Path
import re
import unicodedata
from typing import Protocol, Sequence


DEFAULT_TAXONOMY_VERSION = "phase3-v1"
DEFAULT_EMBEDDING_MODEL = "baai/bge-m3"


@dataclass(frozen=True)
class TopicTranslation:
    language_code: str
    display_name: str
    description: str = ""
    tags: tuple[str, ...] = ()

    def to_mapping(self) -> dict[str, object]:
        return {
            "language_code": self.language_code,
            "display_name": self.display_name,
            "description": self.description,
            "tags": list(self.tags),
        }


@dataclass(frozen=True)
class Topic:
    topic_id: int
    topic_key: str
    display_name: str
    description: str
    tags: tuple[str, ...] = ()
    sub_topics: tuple[str, ...] = ()
    translations: tuple[TopicTranslation, ...] = ()
    model_hint: str = ""
    taxonomy_version: str = DEFAULT_TAXONOMY_VERSION
    parent_topic_id: int | None = None
    is_active: bool = True

    @property
    def is_root(self) -> bool:
        return self.parent_topic_id is None

    @property
    def is_leaf(self) -> bool:
        return self.parent_topic_id is not None


@dataclass(frozen=True)
class TopicEmbeddingInput:
    topic_id: int
    taxonomy_version: str
    embedding_model: str
    input_text: str
    input_hash: str


@dataclass(frozen=True)
class TopicEmbedding:
    topic_id: int
    taxonomy_version: str
    embedding_model: str
    embedding_dimension: int
    embedding_input_text: str
    embedding_input_hash: str
    embedding_vector: tuple[float, ...]
    is_active: bool = True


class TopicTaxonomyRepository(Protocol):
    def list_active_topics(self, taxonomy_version: str | None = None) -> Sequence[Topic]:
        ...


class TopicEmbeddingRepository(Protocol):
    def list_active_embeddings(
        self,
        *,
        taxonomy_version: str | None = None,
        embedding_model: str | None = None,
    ) -> Sequence[TopicEmbedding]:
        ...


@dataclass
class TopicTaxonomyService:
    repository: TopicTaxonomyRepository

    def active_leaf_topics(self, taxonomy_version: str | None = None) -> tuple[Topic, ...]:
        topics = tuple(self.repository.list_active_topics(taxonomy_version))
        parent_ids = {topic.parent_topic_id for topic in topics if topic.parent_topic_id is not None}
        return tuple(topic for topic in topics if topic.is_active and topic.topic_id not in parent_ids)

    def root_for_leaf(self, leaf_topic_id: int, taxonomy_version: str | None = None) -> Topic:
        topics_by_id = {
            topic.topic_id: topic
            for topic in self.repository.list_active_topics(taxonomy_version)
            if topic.is_active
        }
        try:
            topic = topics_by_id[leaf_topic_id]
        except KeyError as exc:
            raise ValueError(f"unknown active topic: {leaf_topic_id}") from exc

        visited = set()
        while topic.parent_topic_id is not None:
            if topic.topic_id in visited:
                raise ValueError(f"cycle detected in topic taxonomy at topic {topic.topic_id}")
            visited.add(topic.topic_id)
            try:
                topic = topics_by_id[topic.parent_topic_id]
            except KeyError as exc:
                raise ValueError(f"missing parent topic: {topic.parent_topic_id}") from exc
        return topic


@dataclass
class TopicEmbeddingInputBuilder:
    embedding_model: str = DEFAULT_EMBEDDING_MODEL

    def build(self, topic: Topic, root_topic: Topic | None = None) -> TopicEmbeddingInput:
        context = []
        if root_topic is not None and root_topic.topic_id != topic.topic_id:
            context.append(f"Root topic: {root_topic.display_name}")
            if root_topic.description:
                context.append(f"Root description: {root_topic.description}")

        parts = [
            f"Topic: {topic.display_name}",
            f"Description: {topic.description}",
            _join_items("Tags", topic.tags),
            _join_items("Sub-topics", topic.sub_topics),
            _join_items("Model hint", (topic.model_hint,)),
            *context,
            _translations_text(topic.translations),
        ]
        input_text = "\n".join(part for part in parts if part)
        input_hash = sha256(input_text.encode("utf-8")).hexdigest()
        return TopicEmbeddingInput(
            topic_id=topic.topic_id,
            taxonomy_version=topic.taxonomy_version,
            embedding_model=self.embedding_model,
            input_text=input_text,
            input_hash=input_hash,
        )

    def needs_regeneration(self, existing: TopicEmbedding | None, next_input: TopicEmbeddingInput) -> bool:
        if existing is None:
            return True
        return (
            existing.taxonomy_version != next_input.taxonomy_version
            or existing.embedding_model != next_input.embedding_model
            or existing.embedding_input_hash != next_input.input_hash
        )


@dataclass
class InMemoryTopicTaxonomyRepository:
    topics: tuple[Topic, ...] = field(default_factory=tuple)

    def list_active_topics(self, taxonomy_version: str | None = None) -> Sequence[Topic]:
        return tuple(
            topic
            for topic in self.topics
            if topic.is_active and (taxonomy_version is None or topic.taxonomy_version == taxonomy_version)
        )


@dataclass
class InMemoryTopicEmbeddingRepository:
    embeddings: tuple[TopicEmbedding, ...] = field(default_factory=tuple)

    def list_active_embeddings(
        self,
        *,
        taxonomy_version: str | None = None,
        embedding_model: str | None = None,
    ) -> Sequence[TopicEmbedding]:
        return tuple(
            embedding
            for embedding in self.embeddings
            if embedding.is_active
            and (taxonomy_version is None or embedding.taxonomy_version == taxonomy_version)
            and (embedding_model is None or embedding.embedding_model == embedding_model)
        )


def seed_phase3_topics(taxonomy_version: str = DEFAULT_TAXONOMY_VERSION) -> tuple[Topic, ...]:
    return load_medtop_topics(taxonomy_version)


def load_medtop_topics(taxonomy_version: str = DEFAULT_TAXONOMY_VERSION) -> tuple[Topic, ...]:
    path = Path(__file__).resolve().parents[3] / "resources" / "news_topic_taxonomy_medtop_en_us.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    topics = []
    for item in data:
        topic = Topic(
            topic_id=_medtop_topic_id(item["id"]),
            topic_key=_slugify_topic_key(item["name"]),
            display_name=item["name"],
            description=item.get("description", ""),
            tags=tuple(item.get("tags", ())),
            sub_topics=tuple(item.get("sub_topics", ())),
            translations=(),
            model_hint="",
            taxonomy_version=taxonomy_version,
        )
        topics.append(topic)
    return tuple(topics)


def topic_to_record(topic: Topic) -> dict[str, object]:
    return {
        "topic_id": topic.topic_id,
        "parent_topic_id": topic.parent_topic_id,
        "topic_key": topic.topic_key,
        "display_name": topic.display_name,
        "description": topic.description,
        "tags": list(topic.tags),
        "sub_topics": list(topic.sub_topics),
        "translations": [translation.to_mapping() for translation in topic.translations],
        "model_hint": topic.model_hint,
        "taxonomy_version": topic.taxonomy_version,
        "is_active": topic.is_active,
    }


def topic_record_json(topic: Topic) -> str:
    return json.dumps(topic_to_record(topic), sort_keys=True, ensure_ascii=False)


def _join_items(label: str, values: tuple[str, ...]) -> str:
    clean_values = [value.strip() for value in values if value.strip()]
    if not clean_values:
        return ""
    return f"{label}: {', '.join(clean_values)}"


def _translations_text(translations: tuple[TopicTranslation, ...]) -> str:
    lines = []
    for translation in translations:
        values = [
            translation.display_name,
            translation.description,
            ", ".join(translation.tags),
        ]
        clean_values = [value for value in values if value]
        if clean_values:
            lines.append(f"{translation.language_code}: {' | '.join(clean_values)}")
    if not lines:
        return ""
    return "Translations:\n" + "\n".join(lines)


def _medtop_topic_id(topic_code: str) -> int:
    numeric = topic_code.split(":", 1)[-1]
    return int(numeric)


def _slugify_topic_key(name: str) -> str:
    normalized = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", ".", normalized.lower()).strip(".")
    return slug or "topic"
