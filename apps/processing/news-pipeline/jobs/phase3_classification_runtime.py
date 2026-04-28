"""Phase 3 Classification Streaming Driver.

Reads enriched articles from the canonical Kafka topic, computes embedding
vectors via the configured embedding gateway, performs cosine-similarity
topic classification, and emits a single Avro-encoded message per article to
``imperium.news.classified``.

Each output message includes:
  - Full classification metadata (primary topic, candidates, confidence)
  - The embedding vector (float32) so downstream consumers (Qdrant projector)
    can reuse it without re-calling the embedding service.

Output encoding: Confluent Avro wire format (5-byte magic prefix + Avro bytes)
registered under subject ``imperium.news.classified-value`` in the Schema
Registry.
"""
import os
import sys
import json
import logging
import time
from pathlib import Path

from pyspark.sql import DataFrame, SparkSession, Window
from pyspark.sql.functions import (
    broadcast, col, collect_list, concat, current_timestamp,
    date_format, expr, from_json, lit, row_number, struct,
)
from pyspark.sql.types import (
    ArrayType, BooleanType, DoubleType, FloatType,
    IntegerType, LongType, StringType, StructField, StructType,
)
from pyspark.sql.avro.functions import to_avro

from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.embedding_gateway import EmbeddingRequestItem
from imperium_news_pipeline.phase3.runtime_adapters import (
    build_embedding_gateway,
    _postgres_connection_factory,
    PostgresTopicEmbeddingRepository,
    PostgresTopicTaxonomyRepository,
)
from imperium_news_pipeline.phase3.topics import TopicTaxonomyService
from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time
from imperium_news_pipeline.phase3.schema_registry import register_schema, confluent_magic

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("ClassificationRuntime")

# Path to Avro schema file — relative to jobs/ directory inside the container:
# /opt/imperium/news-pipeline/jobs/phase3_classification_runtime.py
# /opt/imperium/news-pipeline/resources/schema/classified_article_v1.avsc
_SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent
    / "resources" / "schema" / "classified_article_v1.avsc"
)

# Spark schema for the incoming JSON messages from the canonical topic
_CANONICAL_SCHEMA = StructType([
    StructField("article_id",          StringType(),          True),
    StructField("source_news_id",      LongType(),            True),
    StructField("link_id",             LongType(),            True),
    StructField("authority_id",        LongType(),            True),
    StructField("country_id",          IntegerType(),         True),
    StructField("country_name",        StringType(),          True),
    StructField("source_name",         StringType(),          True),
    StructField("source_domain",       StringType(),          True),
    StructField("rubric_id",           IntegerType(),         True),
    StructField("rubric_title",        StringType(),          True),
    StructField("language_id",         IntegerType(),         True),
    StructField("language_code",       StringType(),          True),
    StructField("classification_status", StringType(),        True),
    StructField("title",               StringType(),          True),
    StructField("url",                 StringType(),          True),
    StructField("body_text",           StringType(),          True),
    StructField("body_text_clean",     StringType(),          True),
    StructField("excerpt",             StringType(),          True),
    StructField("image_url",           StringType(),          True),
    StructField("video_url",           StringType(),          True),
    StructField("reporter",            StringType(),          True),
    StructField("source_date_text",    StringType(),          True),
    StructField("published_at",        LongType(),            True),
    StructField("crawled_at",          LongType(),            True),
    StructField("is_video",            BooleanType(),         True),
    StructField("dimension_status",    StringType(),          True),
    StructField("missing_dimensions",  ArrayType(StringType()), True),
    StructField("schema_version",      IntegerType(),         True),
    StructField("processed_at",        StringType(),          True),
    StructField("is_delete",           BooleanType(),         True),
])

# Cosine similarity using Spark SQL aggregate functions
_COSINE_SIMILARITY_EXPR = """
    aggregate(zip_with(embedding_vector, topic_vector, (x, y) -> x * y), 0D, (acc, v) -> acc + v)
    /
    (
        sqrt(aggregate(embedding_vector, 0D, (acc, v) -> acc + v * v))
        * sqrt(aggregate(topic_vector, 0D, (acc, v) -> acc + v * v))
    )
"""


# ---------------------------------------------------------------------------
# Taxonomy loader
# ---------------------------------------------------------------------------

def load_taxonomy_df(spark: SparkSession, config: Phase3RuntimeConfig, env: dict) -> DataFrame:
    logger.info("Loading topic taxonomy and embeddings from Postgres...")
    connection_factory = _postgres_connection_factory(config.postgres.dsn)
    taxonomy_repo = PostgresTopicTaxonomyRepository(connection_factory, table_name=config.postgres.topic_taxonomy_table)
    embedding_repo = PostgresTopicEmbeddingRepository(connection_factory, table_name=config.postgres.topic_embeddings_table)
    taxonomy_service = TopicTaxonomyService(taxonomy_repo)

    nvidia_config = config.job_nvidia_config(env, "classification")
    embeddings = embedding_repo.list_active_embeddings(embedding_model=nvidia_config.embedding_model)
    leaf_topics = {topic.topic_id: topic for topic in taxonomy_service.active_leaf_topics()}

    rows = []
    for emb in embeddings:
        topic = leaf_topics.get(emb.topic_id)
        if topic:
            root = taxonomy_service.root_for_leaf(topic.topic_id)
            rows.append({
                "topic_id":         str(topic.topic_id),
                "topic_label":      topic.display_name,
                "root_topic_id":    str(root.topic_id),
                "root_topic_label": root.display_name,
                "topic_vector":     [float(v) for v in emb.embedding_vector],
            })

    logger.info(f"Loaded {len(rows)} topic vectors for classification")

    taxonomy_schema = StructType([
        StructField("topic_id",         StringType(),            False),
        StructField("topic_label",      StringType(),            False),
        StructField("root_topic_id",    StringType(),            False),
        StructField("root_topic_label", StringType(),            False),
        StructField("topic_vector",     ArrayType(DoubleType()), False),
    ])
    return spark.createDataFrame(rows, schema=taxonomy_schema)


# ---------------------------------------------------------------------------
# Batch processor
# ---------------------------------------------------------------------------

def process_batch(
    batch_df: DataFrame,
    batch_id: int,
    config: Phase3RuntimeConfig,
    gateway,
    taxonomy_df_broadcast: DataFrame,
    embedding_model: str,
    classified_schema_json: str,
    classified_magic: bytes,
) -> None:
    t0 = time.time()
    spark = batch_df.sparkSession

    enriched_df = batch_df.filter(col("value_json.classification_status") == "enriched")
    count = enriched_df.count()
    if count == 0:
        logger.info(f"batch={batch_id} enriched=0 — skipping")
        return

    logger.info(f"batch={batch_id} enriched={count} — starting")

    enriched_df = (
        enriched_df
        .withColumn("body_words", expr("substring_index(value_json.body_text_clean, ' ', 40)"))
        .withColumn("input_text", expr("concat_ws('\\n', trim(value_json.title), trim(body_words))"))
        .withColumn("article_id", col("value_json.article_id"))
    )

    articles_to_embed = enriched_df.select("article_id", "input_text").collect()
    requests = [
        EmbeddingRequestItem(row.article_id, row.input_text)
        for row in articles_to_embed
        if row.input_text and row.input_text.strip()
    ]

    if not requests:
        logger.info(f"batch={batch_id} no_valid_text — skipping")
        return

    logger.info(f"batch={batch_id} embedding_requests={len(requests)}")
    try:
        result = gateway.embed(tuple(requests))
    except Exception as exc:
        logger.error(f"batch={batch_id} embedding_error={exc}", exc_info=True)
        return

    embed_count = len(result.embeddings)
    skipped = count - embed_count
    if not result.embeddings:
        logger.error(f"batch={batch_id} embedding_empty — aborting batch")
        return

    if result.failures:
        logger.warning(
            f"batch={batch_id} embedding_failures={len(result.failures)}"
        )
        for fail in result.failures[:10]:
            logger.warning(f"  item_id={fail.item_id} reason={fail.reason}")

    logger.info(f"batch={batch_id} embeddings_received={embed_count} skipped={skipped}")

    # Build embedding DataFrame (double for similarity arithmetic, cast to float32 for output)
    embedding_rows = [
        (article_id, [float(v) for v in vector])
        for article_id, vector in result.embeddings.items()
    ]
    embedding_schema = StructType([
        StructField("article_id",      StringType(),            False),
        StructField("embedding_vector", ArrayType(DoubleType()), False),
    ])
    embedding_df = spark.createDataFrame(embedding_rows, schema=embedding_schema)

    # Join embeddings → cross-join taxonomy → score
    joined_df = enriched_df.join(embedding_df, on="article_id", how="inner")
    cross_df = joined_df.crossJoin(taxonomy_df_broadcast)
    scored_df = cross_df.withColumn("similarity", expr(_COSINE_SIMILARITY_EXPR))

    window_spec = Window.partitionBy("article_id").orderBy(col("similarity").desc())
    ranked_df = scored_df.withColumn("rank", row_number().over(window_spec))

    # Top-3 candidates as array<struct> — matches Avro TopicCandidate record
    candidates_df = (
        ranked_df.filter(col("rank") <= 3)
        .withColumn(
            "candidate",
            struct(
                col("topic_id").alias("topic_id"),
                col("topic_label").alias("topic_label"),
                col("root_topic_id").alias("root_topic_id"),
                col("root_topic_label").alias("root_topic_label"),
                col("similarity").cast("string").alias("similarity"),
            ),
        )
        .groupBy("article_id")
        .agg(collect_list("candidate").alias("topic_candidates"))
    )

    # Primary topic (rank 1)
    primary_df = (
        ranked_df.filter(col("rank") == 1)
        .select(
            "article_id",
            col("topic_id").alias("primary_topic_id"),
            col("topic_label").alias("primary_topic_label"),
            col("root_topic_id").alias("primary_root_topic_id"),
            col("root_topic_label").alias("primary_root_topic_label"),
            col("similarity").alias("topic_confidence"),
        )
    )

    final_df = joined_df.join(primary_df, on="article_id").join(candidates_df, on="article_id")

    # Build the output struct — field order MUST match classified_article_v1.avsc
    classified_at = date_format(current_timestamp(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'")

    final_event = struct(
        col("value_json.article_id").alias("article_id"),
        col("value_json.source_news_id").alias("source_news_id"),
        col("value_json.link_id").alias("link_id"),
        col("value_json.authority_id").alias("authority_id"),
        col("value_json.country_id").alias("country_id"),
        col("value_json.country_name").alias("country_name"),
        col("value_json.source_name").alias("source_name"),
        col("value_json.source_domain").alias("source_domain"),
        col("value_json.rubric_id").alias("rubric_id"),
        col("value_json.rubric_title").alias("rubric_title"),
        col("value_json.language_id").alias("language_id"),
        col("value_json.language_code").alias("language_code"),
        lit("classified").alias("classification_status"),
        lit("embedding_similarity").alias("classification_method"),
        lit(embedding_model).alias("classification_model"),
        col("primary_root_topic_id").alias("root_topic_id"),
        col("primary_root_topic_label").alias("root_topic_label"),
        col("primary_topic_id"),
        col("primary_topic_label"),
        col("topic_confidence"),
        # topic_candidates: coalesce null → [] (non-nullable Avro array)
        expr("coalesce(topic_candidates, array())").alias("topic_candidates"),
        # non-nullable string fields in the Avro schema — coalesce null → ""
        expr("coalesce(value_json.title, '')").alias("title"),
        expr("coalesce(value_json.url, '')").alias("url"),
        expr("coalesce(value_json.body_text, '')").alias("body_text"),
        expr("coalesce(value_json.body_text_clean, '')").alias("body_text_clean"),
        expr("coalesce(value_json.excerpt, '')").alias("excerpt"),
        col("value_json.image_url").alias("image_url"),
        col("value_json.video_url").alias("video_url"),
        col("value_json.reporter").alias("reporter"),
        col("value_json.source_date_text").alias("source_date_text"),
        col("value_json.published_at").alias("published_at"),
        col("value_json.crawled_at").alias("crawled_at"),
        col("value_json.is_video").alias("is_video"),
        col("value_json.dimension_status").alias("dimension_status"),
        # missing_dimensions: coalesce null → [] (source JSON may omit it)
        expr("coalesce(value_json.missing_dimensions, array())").alias("missing_dimensions"),
        col("value_json.schema_version").alias("schema_version"),
        col("value_json.processed_at").alias("processed_at"),
        col("value_json.is_delete").alias("is_delete"),
        classified_at.alias("classified_at"),
        # float32 + coalesce null → [] (non-nullable Avro array)
        expr("coalesce(transform(embedding_vector, v -> cast(v as float)), array())").alias("embedding_vector"),
    )

    # Confluent wire format: 5-byte magic prefix + Avro bytes
    magic_lit = lit(classified_magic)
    output_df = final_df.select(
        col("key").cast("string").alias("key"),
        concat(magic_lit, to_avro(final_event, classified_schema_json)).alias("value"),
    )

    write_count = output_df.count()
    logger.info(
        f"batch={batch_id} writing={write_count} "
        f"topic={config.kafka.classified_topic} format=avro"
    )

    output_df.write \
        .format("kafka") \
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers) \
        .option("topic", config.kafka.classified_topic) \
        .save()

    elapsed_ms = int((time.time() - t0) * 1000)
    logger.info(
        f"batch={batch_id} done "
        f"enriched={count} embedded={embed_count} skipped={skipped} "
        f"written={write_count} elapsed_ms={elapsed_ms}"
    )
    sys.stdout.flush()


# ---------------------------------------------------------------------------
# Driver entry point
# ---------------------------------------------------------------------------

def main() -> None:
    logger.info("Initializing Classification Pipeline Driver...")
    env = os.environ
    config = Phase3RuntimeConfig.from_env()

    # Load and validate the Avro schema
    schema_path = Path(os.getenv("PHASE3_CLASSIFIED_SCHEMA_PATH", str(_SCHEMA_PATH)))
    if not schema_path.exists():
        raise FileNotFoundError(f"Avro schema not found: {schema_path}")
    classified_schema_json = schema_path.read_text()
    logger.info(f"Loaded Avro schema from {schema_path}")

    # Register schema with Schema Registry — idempotent, fails fast on error
    classified_subject = f"{config.kafka.classified_topic}-value"
    logger.info(f"Registering schema subject '{classified_subject}' ...")
    classified_schema_id = register_schema(
        config.kafka.schema_registry_url,
        classified_subject,
        classified_schema_json,
    )
    classified_magic = confluent_magic(classified_schema_id)
    logger.info(f"Schema registered: subject='{classified_subject}' id={classified_schema_id}")

    spark = (
        SparkSession.builder
        .appName("imperium-classification-driver-v3")
        .config("spark.sql.shuffle.partitions", "8")
        .config("spark.streaming.stopGracefullyOnShutdown", "true")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    nvidia_config = config.job_nvidia_config(env, "classification")
    gateway = build_embedding_gateway(config, nvidia_config)

    taxonomy_df = load_taxonomy_df(spark, config, env)
    taxonomy_df_broadcast = broadcast(taxonomy_df)

    # Stream reader
    raw_reader = (
        spark.readStream.format("kafka")
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers)
        .option("subscribe", config.kafka.canonical_topic)
        .option("startingOffsets", config.stream_starting_offsets(env, "classification", "earliest"))
    )
    max_offsets = config.stream_max_offsets_per_trigger(env, "classification")
    if max_offsets:
        raw_reader = raw_reader.option("maxOffsetsPerTrigger", max_offsets)

    raw = raw_reader.load()
    stream = raw.select(
        col("key").cast("string").alias("key"),
        from_json(col("value").cast("string"), _CANONICAL_SCHEMA).alias("value_json"),
    )

    checkpoint_path = f"{config.checkpoints.root}/classification-v3"

    writer = stream.writeStream.foreachBatch(
        lambda rows, batch_id: process_batch(
            rows, batch_id,
            config, gateway, taxonomy_df_broadcast,
            nvidia_config.embedding_model,
            classified_schema_json, classified_magic,
        )
    ).option("checkpointLocation", checkpoint_path)

    writer = apply_trigger_processing_time(writer, config.stream_trigger_processing_time(env, "classification"))

    try:
        logger.info("Starting Classification Streaming Query...")
        query = writer.start()
        query.awaitTermination()
    except Exception as exc:
        logger.error(f"Classification Streaming FATAL: {exc}", exc_info=True)
        sys.exit(1)
    finally:
        logger.info("Classification Pipeline Driver shutting down.")
        spark.stop()


if __name__ == "__main__":
    main()
