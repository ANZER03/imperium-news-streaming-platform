import os
import sys
from pyspark import StorageLevel
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql.functions import (
    col, coalesce, to_json, struct, when, lit, expr, 
    current_timestamp, regexp_replace, trim, lower
)

# Ensure local helpers are importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from imperium_news_pipeline.phase3.runtime_config import Phase3RuntimeConfig
from imperium_news_pipeline.phase3.spark_cdc import read_debezium_avro_stream
from imperium_news_pipeline.phase3.streaming import apply_trigger_processing_time
from helpers import load_small_dimensions, fetch_large_dimensions

NEWS_TOPIC = "imperium.news.public.table_news"
NEWS_FIELDS = {
    NEWS_TOPIC: (
        "id", "link_id", "authority_id", "rubrique_id", "langue_id", "more_title", "more_url", 
        "more_inner_text", "more_reporter", "more_date_text", "more_image_url", "more_video_url", 
        "more_meta_keywords", "more_meta_description", "pubdate", "crawl_date", "added_in", 
        "updated_in", "valide", "to_delete", "isvideo",
    )
}

def process_batch(batch_df: DataFrame, batch_id: int, config: Phase3RuntimeConfig, spark: SparkSession):
    # 1. Prepare raw payload (No action here)
    raw_df = batch_df.withColumn("payload", coalesce(col("value.after"), col("value.before"))) \
                     .withColumn("is_cdc_delete", col("value.op") == "d") \
                     .select("payload.*", "is_cdc_delete")

    # 2. Extract dimensions (This is the ONLY action before persistence)
    # We use a distinct/collect on IDs as it is bounded by helpers.py safeguards
    small_dims = load_small_dimensions(spark, config)
    large_dims = fetch_large_dimensions(spark, config, raw_df)
    
    # 3. Join logic (Lazy)
    enriched_df = raw_df \
        .join(small_dims["rubrics"], raw_df.rubrique_id == small_dims["rubrics"].dim_rubric_id, "left") \
        .join(small_dims["languages"], raw_df.langue_id == small_dims["languages"].dim_language_id, "left") \
        .join(large_dims["links"], raw_df.link_id == large_dims["links"].dim_link_id, "left") \
        .join(large_dims["authorities"], raw_df.authority_id == large_dims["authorities"].dim_authority_id, "left") \
        .join(large_dims["seditions"], col("auth_sedition_id") == large_dims["seditions"].dim_sedition_id, "left") \
        .withColumn("resolved_country_id", coalesce(col("sedition_country_id"), col("link_country_id"))) \
        .join(small_dims["countries"], col("resolved_country_id") == small_dims["countries"].dim_country_id, "left")

    # 4. Native Spark SQL Cleaning (Replaces Python UDFs)
    # regexp_replace is much faster than Python regex UDFs
    cleaned_df = enriched_df \
        .withColumn("title", trim(regexp_replace(col("more_title"), "\\s+", " "))) \
        .withColumn("url", trim(regexp_replace(col("more_url"), "\\s+", " "))) \
        .withColumn("body_text", trim(regexp_replace(col("more_inner_text"), "\\s+", " "))) \
        .withColumn("body_text_clean", trim(regexp_replace(regexp_replace(col("more_inner_text"), "<[^>]*>", " "), "\\s+", " "))) \
        .withColumn("excerpt", expr("substring_index(body_text_clean, ' ', 30)")) \
        .withColumn("has_usable_content", (expr("length(title) > 0") | expr("length(body_text) > 0"))) \
        .withColumn("is_delete", col("is_cdc_delete") | col("to_delete"))

    # 5. Routing Logic (Lazy)
    cleaned_df = cleaned_df.withColumn("missing_dimensions", expr("""
        array_remove(array(
            CASE WHEN link_id IS NOT NULL AND dim_link_id IS NULL THEN 'link' ELSE NULL END,
            CASE WHEN authority_id IS NOT NULL AND dim_authority_id IS NULL THEN 'authority' ELSE NULL END,
            CASE WHEN resolved_country_id IS NOT NULL AND dim_country_id IS NULL THEN 'country' ELSE NULL END
        ), NULL)
    """))
    
    cleaned_df = cleaned_df.withColumn("dimension_status", when(expr("size(missing_dimensions) > 0"), "partial").otherwise("complete"))
    
    # Define route
    cleaned_df = cleaned_df.withColumn("route", 
        when(col("is_delete"), lit("success"))
        .when(~col("has_usable_content"), lit("dlq"))
        .when(col("dimension_status") == "partial", lit("dlq")) # Treat retry as DLQ for now as requested
        .otherwise(lit("success"))
    )

    # 6. Build Final Payload (Lazy)
    canonical_event = struct(
        col("id").cast("string").alias("article_id"),
        col("id").alias("source_news_id"),
        col("link_id"),
        col("authority_id"),
        col("resolved_country_id").alias("country_id"),
        col("dim_country_name").alias("country_name"),
        coalesce(col("auth_source_name"), col("link_source_name")).alias("source_name"),
        coalesce(col("auth_source_domain"), col("link_source_domain")).alias("source_domain"),
        col("rubrique_id").alias("rubric_id"),
        col("dim_rubric_title").alias("rubric_title"),
        coalesce(col("dim_language_id"), col("langue_id")).alias("language_id"),
        col("dim_language_code").alias("language_code"),
        lit("enriched").alias("classification_status"),
        col("title"),
        col("url"),
        col("body_text"),
        col("body_text_clean"),
        col("excerpt"),
        trim(regexp_replace(col("more_image_url"), "\\s+", " ")).alias("image_url"),
        trim(regexp_replace(col("more_video_url"), "\\s+", " ")).alias("video_url"),
        trim(regexp_replace(col("more_reporter"), "\\s+", " ")).alias("reporter"),
        trim(regexp_replace(col("more_date_text"), "\\s+", " ")).alias("source_date_text"),
        coalesce(col("pubdate"), col("crawl_date")).alias("published_at"),
        coalesce(col("crawl_date"), col("added_in")).alias("crawled_at"),
        col("isvideo").cast("boolean").alias("is_video"),
        col("dimension_status"),
        col("missing_dimensions"),
        lit(1).alias("schema_version"),
        current_timestamp().alias("processed_at"),
        col("is_delete")
    )
    
    final_df = cleaned_df.select(
        col("id").cast("string").alias("key"),
        to_json(canonical_event).alias("value"),
        col("route")
    )

    # 7. PERSIST THE RESULT
    # This prevents re-computing joins and SQL logic for each write
    final_df.persist(StorageLevel.MEMORY_AND_DISK)

    # 8. Optimized Writes (Directly calling write without isEmpty)
    success_df = final_df.filter("route = 'success'").select("key", "value")
    dlq_df = final_df.filter("route = 'dlq'").select("key", "value")

    # Kafka write handles empty DataFrames automatically
    success_df.write \
        .format("kafka") \
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers) \
        .option("topic", config.kafka.canonical_topic) \
        .save()

    dlq_df.write \
        .format("kafka") \
        .option("kafka.bootstrap.servers", config.kafka.bootstrap_servers) \
        .option("topic", config.kafka.canonical_dlq_topic) \
        .save()

    # 9. Cleanup
    final_df.unpersist()


def main():
    env = os.environ
    config = Phase3RuntimeConfig.from_env(env)
    
    # Configure Spark Session for high throughput
    spark = SparkSession.builder \
        .appName("imperium-canonical-enrichment-v2") \
        .config("spark.sql.shuffle.partitions", "8") \
        .config("spark.streaming.stopGracefullyOnShutdown", "true") \
        .getOrCreate()
    
    stream = read_debezium_avro_stream(
        spark,
        bootstrap_servers=config.kafka.bootstrap_servers,
        schema_registry_url=config.kafka.schema_registry_url,
        topics=(NEWS_TOPIC,),
        starting_offsets=config.stream_starting_offsets(env, "canonical", "earliest"),
        max_offsets_per_trigger=config.stream_max_offsets_per_trigger(env, "canonical"),
        payload_fields_by_topic=NEWS_FIELDS,
    )
    
    # Use a fresh checkpoint for the optimized run
    checkpoint_path = f"{config.checkpoints.root}/enrichment-v2"
    
    writer = stream.writeStream \
        .foreachBatch(lambda df, batch_id: process_batch(df, batch_id, config, spark)) \
        .option("checkpointLocation", checkpoint_path)
        
    writer = apply_trigger_processing_time(writer, config.stream_trigger_processing_time(env, "canonical"))
    
    query = writer.start()
    query.awaitTermination()

if __name__ == "__main__":
    main()
