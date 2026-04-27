from __future__ import annotations

from dataclasses import dataclass
import unittest
from unittest.mock import patch

from imperium_news_pipeline.phase3.dimensions import authority_dimension, country_dimension, link_dimension
from imperium_news_pipeline.phase3.dimension_runtime_jobs import (
    _materialize_partition,
    build_dimension_job,
    dimension_db_batch_size,
    job_env_prefix,
    selected_dimension_topics,
)


@dataclass
class _FakeRow:
    key: dict
    value: dict


class _Accumulator:
    def __init__(self) -> None:
        self.value = 0

    def __iadd__(self, other: int):
        self.value += other
        return self


class _PassthroughDecoder:
    def decode(self, *, key, value):
        _ = key
        return value


class _BatchOnlyMaterializer:
    instances: list["_BatchOnlyMaterializer"] = []

    def __init__(self, repository) -> None:
        self.repository = repository
        self.batches: list[tuple] = []
        self.__class__.instances.append(self)

    def materialize(self, record) -> bool:
        raise AssertionError(f"record-by-record materialize should not be used: {record}")

    def materialize_many(self, records: tuple) -> int:
        self.batches.append(records)
        return len(records)


class DimensionRuntimeJobsTests(unittest.TestCase):
    def test_build_dimension_job_has_distinct_driver_names(self) -> None:
        self.assertEqual(build_dimension_job("reference").app_name, "imperium-dimension-reference-driver")
        self.assertEqual(build_dimension_job("authority").checkpoint_job_name, "imperium-dimension-authority-driver")
        self.assertEqual(build_dimension_job("links").topics, ("imperium.metadata.public.table_links",))

    def test_selected_dimension_topics_default_and_custom_subset(self) -> None:
        self.assertEqual(
            selected_dimension_topics("reference", {}),
            (
                "imperium.reference.public.table_pays",
                "imperium.reference.public.table_langue",
                "imperium.reference.public.table_rubrique",
                "imperium.reference.public.table_sedition",
            ),
        )
        env = {f"{job_env_prefix('reference')}_TOPICS": "imperium.reference.public.table_pays, imperium.reference.public.table_langue"}
        self.assertEqual(
            selected_dimension_topics("reference", env),
            (
                "imperium.reference.public.table_pays",
                "imperium.reference.public.table_langue",
            ),
        )

    def test_selected_dimension_topics_rejects_cross_driver_topic(self) -> None:
        env = {f"{job_env_prefix('reference')}_TOPICS": "imperium.metadata.public.table_links"}
        with self.assertRaisesRegex(ValueError, "unsupported PHASE3_REFERENCE_TOPICS entries for reference"):
            selected_dimension_topics("reference", env)

    def test_dimension_db_batch_size_prefers_job_specific_env(self) -> None:
        env = {
            "PHASE3_DIMENSION_DB_BATCH_SIZE": "5000",
            "PHASE3_AUTHORITY_DB_BATCH_SIZE": "1234",
        }
        self.assertEqual(dimension_db_batch_size(env, "authority"), 1234)
        self.assertEqual(dimension_db_batch_size(env, "links"), 5000)

    def test_materialize_partition_flushes_with_materialize_many_only(self) -> None:
        rows = (
            _FakeRow(key={"id": 1}, value={"table": "table_links"}),
            _FakeRow(key={"id": 2}, value={"table": "table_authority"}),
            _FakeRow(key={"id": 3}, value={"table": "table_pays"}),
        )
        decoded = {
            "table_links": link_dimension({"id": 1, "link": "https://example.test/1", "domain": "example.test"}),
            "table_authority": authority_dimension({"id": 2, "authority": "Example", "domain": "example.test"}),
            "table_pays": country_dimension({"id": 3, "pays": "Morocco"}),
        }
        accumulator = _Accumulator()
        _BatchOnlyMaterializer.instances.clear()

        with (
            patch("imperium_news_pipeline.phase3.dimension_runtime_jobs.DebeziumAvroCdcDecoder", return_value=_PassthroughDecoder()),
            patch(
                "imperium_news_pipeline.phase3.dimension_runtime_jobs.dimension_record_from_change",
                side_effect=lambda change: decoded[change["table"]],
            ),
            patch("imperium_news_pipeline.phase3.dimension_runtime_jobs.DimensionMaterializer", _BatchOnlyMaterializer),
            patch("imperium_news_pipeline.phase3.dimension_runtime_jobs.PostgresDimensionRepository", lambda connection_factory: object()),
            patch("imperium_news_pipeline.phase3.dimension_runtime_jobs._postgres_connection_factory", lambda dsn: dsn),
        ):
            _materialize_partition(rows, "postgresql://example", batch_size=2, accumulator=accumulator)

        self.assertEqual(accumulator.value, 3)
        self.assertEqual(len(_BatchOnlyMaterializer.instances), 1)
        self.assertEqual([len(batch) for batch in _BatchOnlyMaterializer.instances[0].batches], [1, 1, 1])


if __name__ == "__main__":
    unittest.main()
