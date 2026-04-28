import os
import time
from typing import List, Dict, Any
from confluent_kafka import Message
import psycopg
from psycopg.types.json import Jsonb

from utils import build_consumer, build_avro_deserializer, consume_microbatches, decode_json, get_logger

logger = get_logger("PostgresProjector")

CANONICAL_TOPIC = "imperium.canonical-articles"
CLASSIFIED_TOPIC = "imperium.news.classified"

def get_db_connection():
    dsn = os.environ.get("PHASE3_POSTGRES_DSN", "postgresql://postgres:postgres@postgres-source:5432/imperium-news-source")
    return psycopg.connect(dsn)

def upsert_canonical(cursor: psycopg.Cursor, records: List[Dict[str, Any]]):
    """
    Upsert canonical fields into the database. Sets classification_status to 'pending'
    UNLESS it is already 'classified' (handled by COALESCE in ON CONFLICT).
    """
    sql = """
    INSERT INTO imperium_news_articles (
        article_id, source_news_id, link_id, authority_id, country_id, country_name,
        source_name, source_domain, rubric_id, rubric_title, language_id, language_code,
        title, url, body_text, body_text_clean, excerpt, image_url, video_url, reporter,
        source_date_text, published_at, crawled_at, is_video, dimension_status, 
        missing_dimensions, schema_version, is_delete, classification_status
    ) VALUES (
        %(article_id)s, %(source_news_id)s, %(link_id)s, %(authority_id)s, %(country_id)s, %(country_name)s,
        %(source_name)s, %(source_domain)s, %(rubric_id)s, %(rubric_title)s, %(language_id)s, %(language_code)s,
        %(title)s, %(url)s, %(body_text)s, %(body_text_clean)s, %(excerpt)s, %(image_url)s, %(video_url)s, %(reporter)s,
        %(source_date_text)s, %(published_at)s, %(crawled_at)s, %(is_video)s, %(dimension_status)s,
        %(missing_dimensions)s, %(schema_version)s, %(is_delete)s, 'pending'
    ) ON CONFLICT (article_id) DO UPDATE SET
        source_news_id = EXCLUDED.source_news_id,
        link_id = EXCLUDED.link_id,
        authority_id = EXCLUDED.authority_id,
        country_id = EXCLUDED.country_id,
        country_name = EXCLUDED.country_name,
        source_name = EXCLUDED.source_name,
        source_domain = EXCLUDED.source_domain,
        rubric_id = EXCLUDED.rubric_id,
        rubric_title = EXCLUDED.rubric_title,
        language_id = EXCLUDED.language_id,
        language_code = EXCLUDED.language_code,
        title = EXCLUDED.title,
        url = EXCLUDED.url,
        body_text = EXCLUDED.body_text,
        body_text_clean = EXCLUDED.body_text_clean,
        excerpt = EXCLUDED.excerpt,
        image_url = EXCLUDED.image_url,
        video_url = EXCLUDED.video_url,
        reporter = EXCLUDED.reporter,
        source_date_text = EXCLUDED.source_date_text,
        published_at = EXCLUDED.published_at,
        crawled_at = EXCLUDED.crawled_at,
        is_video = EXCLUDED.is_video,
        dimension_status = EXCLUDED.dimension_status,
        missing_dimensions = EXCLUDED.missing_dimensions,
        schema_version = EXCLUDED.schema_version,
        is_delete = EXCLUDED.is_delete,
        updated_at = CURRENT_TIMESTAMP
    """
    # Note: we do NOT update classification_status here. It stays whatever it currently is.
    cursor.executemany(sql, records)

def upsert_classified(cursor: psycopg.Cursor, records: List[Dict[str, Any]]):
    """
    Upsert classified fields (topics and embeddings) into the database.
    Since we don't know if canonical came first, we also insert basic canonical fields if row is entirely new,
    but primarily we update classification fields.
    """
    sql = """
    INSERT INTO imperium_news_articles (
        article_id, classification_status, classification_method, classification_model,
        root_topic_id, root_topic_label, primary_topic_id, primary_topic_label,
        topic_confidence, topic_candidates, embedding_vector, classified_at,
        -- fallback for basic canonical fields if canonical event was somehow lost/delayed
        title, url, body_text, body_text_clean, excerpt, country_id
    ) VALUES (
        %(article_id)s, 'classified', %(classification_method)s, %(classification_model)s,
        %(root_topic_id)s, %(root_topic_label)s, %(primary_topic_id)s, %(primary_topic_label)s,
        %(topic_confidence)s, %(topic_candidates)s, %(embedding_vector)s, CURRENT_TIMESTAMP,
        %(title)s, %(url)s, %(body_text)s, %(body_text_clean)s, %(excerpt)s, %(country_id)s
    ) ON CONFLICT (article_id) DO UPDATE SET
        classification_status = 'classified',
        classification_method = EXCLUDED.classification_method,
        classification_model = EXCLUDED.classification_model,
        root_topic_id = EXCLUDED.root_topic_id,
        root_topic_label = EXCLUDED.root_topic_label,
        primary_topic_id = EXCLUDED.primary_topic_id,
        primary_topic_label = EXCLUDED.primary_topic_label,
        topic_confidence = EXCLUDED.topic_confidence,
        topic_candidates = EXCLUDED.topic_candidates,
        embedding_vector = EXCLUDED.embedding_vector,
        classified_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    """
    cursor.executemany(sql, records)

def process_batch(messages: List[Message], conn: psycopg.Connection, avro_deserializer):
    canonical_records = []
    classified_records = []

    for msg in messages:
        topic = msg.topic()
        
        if topic == CANONICAL_TOPIC:
            data = decode_json(msg)
            if not data: continue
            
            # Format missing_dimensions as JSONB
            data['missing_dimensions'] = Jsonb(data.get('missing_dimensions', []))
            
            # Ensure all keys exist
            for k in ["article_id", "source_news_id", "link_id", "authority_id", "country_id", "country_name",
                      "source_name", "source_domain", "rubric_id", "rubric_title", "language_id", "language_code",
                      "title", "url", "body_text", "body_text_clean", "excerpt", "image_url", "video_url", "reporter",
                      "source_date_text", "published_at", "crawled_at", "is_video", "dimension_status", "schema_version", "is_delete"]:
                data.setdefault(k, None)
                
            canonical_records.append(data)
            
        elif topic == CLASSIFIED_TOPIC:
            try:
                # Deserialize avro payload
                data = avro_deserializer(msg.value(), None)
                if not data: continue
                
                # Format JSONB arrays
                data['topic_candidates'] = Jsonb(data.get('topic_candidates', []))
                data['missing_dimensions'] = Jsonb(data.get('missing_dimensions', []))
                
                # Vector is array of floats in Postgres (REAL[])
                vec = data.get('embedding_vector', [])
                if not vec:
                    data['embedding_vector'] = None
                    
                # Ensure all keys exist
                for k in ["article_id", "classification_method", "classification_model", "root_topic_id", "root_topic_label", 
                          "primary_topic_id", "primary_topic_label", "topic_confidence", "title", "url", "body_text", 
                          "body_text_clean", "excerpt", "country_id"]:
                    data.setdefault(k, None)
                
                classified_records.append(data)
            except Exception as e:
                logger.error(f"Failed to decode avro message on {topic}: {e}")
                
    try:
        with conn.cursor() as cursor:
            if canonical_records:
                upsert_canonical(cursor, canonical_records)
                logger.info(f"Upserted {len(canonical_records)} canonical records to Postgres")
            if classified_records:
                upsert_classified(cursor, classified_records)
                logger.info(f"Upserted {len(classified_records)} classified records to Postgres")
        conn.commit()
    except Exception:
        conn.rollback()
        raise

def main():
    bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
    schema_registry_url = os.environ.get("SCHEMA_REGISTRY_URL", "http://schema-registry:8081")
    group_id = "imperium-postgres-projector-group"
    
    logger.info("Initializing Postgres Projector...")
    consumer = build_consumer(bootstrap_servers, group_id)
    avro_deserializer = build_avro_deserializer(schema_registry_url)
    
    # Retry loop for DB connection at startup
    while True:
        try:
            conn = get_db_connection()
            logger.info("Connected to PostgreSQL successfully.")
            break
        except Exception as e:
            logger.warning(f"Waiting for Postgres... ({e})")
            time.sleep(5)
    
    def batch_processor(messages: List[Message]):
        process_batch(messages, conn, avro_deserializer)
        
    try:
        consume_microbatches(
            consumer=consumer,
            topics=[CANONICAL_TOPIC, CLASSIFIED_TOPIC],
            process_batch=batch_processor,
            batch_size=500,
            timeout_ms=1.0,
            logger=logger
        )
    finally:
        conn.close()

if __name__ == "__main__":
    main()
