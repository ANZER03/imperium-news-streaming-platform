from __future__ import annotations

from datetime import datetime, timezone
import unittest

from imperium_news_pipeline.phase3.cdc import DebeziumAvroCdcDecoder
from imperium_news_pipeline.phase3.dimensions import link_dimension
from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.runtime_adapters import InMemoryRuntimeKafkaAdmin, PostgresDimensionRepository
from imperium_news_pipeline.phase3.topic_bootstrap import ensure_runtime_topics, runtime_topic_specs


class DebeziumAvroCdcDecoderTests(unittest.TestCase):
    def test_decodes_insert_update_and_delete_envelopes(self) -> None:
        decoder = DebeziumAvroCdcDecoder()

        insert = decoder.decode(
            key={"id": 10},
            value={
                "op": "c",
                "source": {"schema": "public", "table": "table_news"},
                "after": {"id": 10, "title": "created"},
                "ts_ms": 1777200000000,
            },
        )
        update = decoder.decode(
            key={"id": 10},
            value={
                "op": "u",
                "source": {"schema": "public", "table": "table_news"},
                "before": {"id": 10, "title": "old"},
                "after": {"id": 10, "title": "new"},
                "ts_us": 1777200000000000,
            },
        )
        delete = decoder.decode(
            key={"id": 10},
            value={
                "op": "d",
                "source": {"schema": "public", "table": "table_news"},
                "before": {"id": 10, "title": "gone"},
                "ts_ns": 1777200000000000000,
            },
        )

        self.assertEqual(insert.operation, "c")
        self.assertEqual(insert.key, {"id": 10})
        self.assertEqual(insert.after, {"id": 10, "title": "created"})
        self.assertEqual(update.before, {"id": 10, "title": "old"})
        self.assertEqual(update.after, {"id": 10, "title": "new"})
        self.assertTrue(delete.is_delete)
        self.assertEqual(delete.current_payload, {"id": 10, "title": "gone"})
        self.assertEqual(delete.event_timestamp, datetime(2026, 4, 26, 10, 40, tzinfo=timezone.utc))

    def test_missing_payloads_and_invalid_envelopes_fail_fast(self) -> None:
        decoder = DebeziumAvroCdcDecoder()

        with self.assertRaisesRegex(ValueError, "missing CDC value envelope"):
            decoder.decode(key={"id": 1}, value=None)
        with self.assertRaisesRegex(ValueError, "invalid Debezium operation"):
            decoder.decode(key={"id": 1}, value={"op": "x", "source": {"table": "table_news"}, "ts_ms": 1})
        with self.assertRaisesRegex(ValueError, "update CDC envelope requires after payload"):
            decoder.decode(key={"id": 1}, value={"op": "u", "source": {"table": "table_news"}, "before": {"id": 1}, "ts_ms": 1})
        with self.assertRaisesRegex(ValueError, "delete CDC envelope requires before payload"):
            decoder.decode(key={"id": 1}, value={"op": "d", "source": {"table": "table_news"}, "ts_ms": 1})


class Phase3RuntimeConfigTests(unittest.TestCase):
    def test_loads_compose_defaults_and_checkpoint_paths_without_secret_leakage(self) -> None:
        config = Phase3RuntimeConfig.from_env(
            {
                "NVIDIA_API_KEY": "secret-key",
                "PHASE3_CHECKPOINT_ROOT": "/checkpoints/phase3",
            }
        )

        self.assertEqual(config.kafka.bootstrap_servers, "localhost:49092")
        self.assertEqual(config.kafka.source_topic("table_news"), "imperium.news.public.table_news")
        self.assertEqual(config.kafka.canonical_topic, "imperium.canonical-articles")
        self.assertEqual(config.window_days, 5)
        self.assertEqual(config.checkpoints.for_job("canonical-article"), "/checkpoints/phase3/canonical-article")
        self.assertTrue(config.nvidia.api_key_present)
        self.assertFalse(hasattr(config.nvidia, "api_key"))

    def test_rejects_invalid_runtime_values(self) -> None:
        with self.assertRaisesRegex(ValueError, "PHASE3_WINDOW_DAYS must be positive"):
            Phase3RuntimeConfig.from_env({"PHASE3_WINDOW_DAYS": "0"})


class RuntimeTopicBootstrapTests(unittest.TestCase):
    def test_defines_and_ensures_runtime_topics(self) -> None:
        config = Phase3RuntimeConfig.from_env({})
        specs = runtime_topic_specs(config)
        admin = InMemoryRuntimeKafkaAdmin()

        ensure_runtime_topics(admin, specs)

        self.assertEqual({spec.name for spec in specs}, {"imperium.canonical-articles", "imperium.canonical-articles.dlq"})
        self.assertEqual(admin.topics["imperium.canonical-articles"].configs["cleanup.policy"], "compact")
        self.assertEqual(admin.topics["imperium.canonical-articles.dlq"].configs["cleanup.policy"], "delete")


class PostgresRuntimeAdapterTests(unittest.TestCase):
    def test_dimension_repository_writes_filtered_columns_and_payload(self) -> None:
        connection = FakeConnection()
        repository = PostgresDimensionRepository(lambda: connection)

        repository.upsert(link_dimension({"id": 10, "link": "https://source.test", "domain": "source.test", "title": "Source", "pays_id": 504}))

        query, params = connection.cursor_obj.executed[-1]
        self.assertIn("source_domain", query)
        self.assertEqual(params["link_id"], 10)
        self.assertEqual(params["url"], "https://source.test")
        self.assertEqual(params["source_domain"], "source.test")
        self.assertEqual(params["source_name"], "Source")
        self.assertEqual(params["country_id"], 504)
        self.assertIn('"link_id": 10', params["payload"])
        self.assertTrue(connection.committed)


class FakeCursor:
    def __init__(self) -> None:
        self.executed = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> None:
        return None

    def execute(self, query, params) -> None:
        self.executed.append((query, params))


class FakeConnection:
    def __init__(self) -> None:
        self.cursor_obj = FakeCursor()
        self.committed = False

    def cursor(self) -> FakeCursor:
        return self.cursor_obj

    def commit(self) -> None:
        self.committed = True


if __name__ == "__main__":
    unittest.main()
