import os
import time
from typing import List, Dict, Any
from confluent_kafka import Message
from qdrant_client import QdrantClient
from qdrant_client.http import models

from utils import build_consumer, build_avro_deserializer, consume_microbatches, get_logger

logger = get_logger("QdrantProjector")

CLASSIFIED_TOPIC = "imperium.news.classified"
COLLECTION_NAME = os.environ.get("PHASE3_QDRANT_COLLECTION", "imperium_articles")
VECTOR_SIZE = 768 # Matched to the embedding model dimension

def get_qdrant_client():
    url = os.environ.get("PHASE3_QDRANT_URL", "http://qdrant:6333")
    return QdrantClient(url=url)

def setup_collection(client: QdrantClient):
    """Ensures collection and necessary payload indexes exist."""
    collections = client.get_collections().collections
    if not any(c.name == COLLECTION_NAME for c in collections):
        logger.info(f"Creating Qdrant collection: {COLLECTION_NAME}")
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=models.VectorParams(
                size=VECTOR_SIZE, 
                distance=models.Distance.COSINE
            )
        )
    
    # Create payload indexes for fast filtering
    indexes_to_create = ["root_topic_id", "country_id", "language_id", "source_news_id", "published_at"]
    for field in indexes_to_create:
        try:
            client.create_payload_index(
                collection_name=COLLECTION_NAME,
                field_name=field,
                field_schema=models.PayloadSchemaType.KEYWORD if field != "published_at" else models.PayloadSchemaType.INTEGER
            )
            logger.info(f"Ensured index on {field}")
        except Exception as e:
            # Index might already exist, which is fine
            logger.debug(f"Payload index creation note: {e}")

def process_batch(messages: List[Message], client: QdrantClient, avro_deserializer):
    points = []

    for msg in messages:
        if msg.topic() == CLASSIFIED_TOPIC:
            try:
                data = avro_deserializer(msg.value(), None)
                if not data: continue
                
                article_id = data.get("article_id")
                vector = data.get("embedding_vector")
                
                if not article_id or not vector:
                    continue
                
                # Convert string article_id to UUID or use a hash for the integer ID required by some Qdrant setups
                # Qdrant supports UUIDs and integers.
                import uuid
                try:
                    # If article_id is a valid UUID string
                    point_id = str(uuid.UUID(article_id))
                except ValueError:
                    # Generate a deterministic UUID from the string ID
                    point_id = str(uuid.uuid5(uuid.NAMESPACE_OID, article_id))
                
                # Strip out the huge text fields to save RAM in Qdrant, keeping only metadata for filtering
                payload = {
                    "article_id": article_id,
                    "source_news_id": data.get("source_news_id"),
                    "title": data.get("title"),
                    "excerpt": data.get("excerpt"),
                    "country_id": data.get("country_id"),
                    "language_id": data.get("language_id"),
                    "root_topic_id": data.get("root_topic_id"),
                    "root_topic_label": data.get("root_topic_label"),
                    "primary_topic_id": data.get("primary_topic_id"),
                    "published_at": data.get("published_at"),
                    "classification_method": data.get("classification_method"),
                    "image_url": data.get("image_url")
                }
                
                # Remove None values
                payload = {k: v for k, v in payload.items() if v is not None}
                
                points.append(
                    models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload
                    )
                )
            except Exception as e:
                logger.error(f"Failed to process message: {e}")

    if points:
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=points
        )
        logger.info(f"Upserted {len(points)} vectors to Qdrant")

def main():
    bootstrap_servers = os.environ.get("KAFKA_BOOTSTRAP_SERVERS", "kafka:29092")
    schema_registry_url = os.environ.get("SCHEMA_REGISTRY_URL", "http://schema-registry:8081")
    group_id = "imperium-qdrant-projector-group"
    
    logger.info("Initializing Qdrant Projector...")
    consumer = build_consumer(bootstrap_servers, group_id)
    avro_deserializer = build_avro_deserializer(schema_registry_url)
    
    while True:
        try:
            client = get_qdrant_client()
            setup_collection(client)
            logger.info("Connected to Qdrant successfully.")
            break
        except Exception as e:
            logger.warning(f"Waiting for Qdrant... ({e})")
            time.sleep(5)
            
    def batch_processor(messages: List[Message]):
        process_batch(messages, client, avro_deserializer)
        
    try:
        consume_microbatches(
            consumer=consumer,
            topics=[CLASSIFIED_TOPIC],
            process_batch=batch_processor,
            batch_size=500,
            timeout_ms=1.0,
            logger=logger
        )
    finally:
        client.close()

if __name__ == "__main__":
    main()
