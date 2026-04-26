from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol, Sequence

from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig


@dataclass(frozen=True)
class TopicSpec:
    name: str
    partitions: int
    replication_factor: int
    configs: dict[str, str]


class KafkaAdminClient(Protocol):
    def ensure_topic(self, spec: TopicSpec) -> None:
        ...


def runtime_topic_specs(config: Phase3RuntimeConfig) -> tuple[TopicSpec, ...]:
    return (
        TopicSpec(
            name=config.kafka.canonical_topic,
            partitions=3,
            replication_factor=1,
            configs={
                "cleanup.policy": "compact",
                "retention.ms": "604800000",
                "min.compaction.lag.ms": "60000",
            },
        ),
        TopicSpec(
            name=config.kafka.canonical_dlq_topic,
            partitions=1,
            replication_factor=1,
            configs={
                "cleanup.policy": "delete",
                "retention.ms": "604800000",
            },
        ),
    )


def ensure_runtime_topics(admin: KafkaAdminClient, specs: Sequence[TopicSpec]) -> None:
    for spec in specs:
        admin.ensure_topic(spec)


@dataclass
class InMemoryKafkaAdminClient:
    ensured: list[TopicSpec]

    def ensure_topic(self, spec: TopicSpec) -> None:
        self.ensured.append(spec)
