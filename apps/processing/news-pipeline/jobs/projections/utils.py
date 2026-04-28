import json
import logging
from typing import Callable, Any, Dict, List
from confluent_kafka import Consumer, Message
from confluent_kafka.schema_registry import SchemaRegistryClient
from confluent_kafka.schema_registry.avro import AvroDeserializer

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.hasHandlers():
        handler = logging.StreamHandler()
        formatter = logging.Formatter('%(asctime)s %(levelname)s %(name)s: %(message)s')
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger

def build_consumer(bootstrap_servers: str, group_id: str, auto_offset_reset: str = 'earliest') -> Consumer:
    return Consumer({
        'bootstrap.servers': bootstrap_servers,
        'group.id': group_id,
        'auto.offset.reset': auto_offset_reset,
        'enable.auto.commit': False,
        'fetch.min.bytes': 1024 * 1024, # 1MB minimum fetch to encourage batching
        'fetch.wait.max.ms': 500,       # Wait up to 500ms to fill the batch
    })

def build_avro_deserializer(schema_registry_url: str) -> AvroDeserializer:
    sr_client = SchemaRegistryClient({'url': schema_registry_url})
    return AvroDeserializer(sr_client)

def consume_microbatches(
    consumer: Consumer,
    topics: List[str],
    process_batch: Callable[[List[Message]], None],
    batch_size: int = 500,
    timeout_ms: float = 1.0,
    logger: logging.Logger = None
):
    if logger is None:
        logger = get_logger("MicroBatchConsumer")
        
    consumer.subscribe(topics)
    logger.info(f"Subscribed to {topics}, entering micro-batch loop (batch_size={batch_size})")

    try:
        while True:
            # Poll for a batch of messages
            messages = consumer.consume(num_messages=batch_size, timeout=timeout_ms)
            if not messages:
                continue

            valid_messages = []
            for msg in messages:
                if msg.error():
                    logger.error(f"Kafka error: {msg.error()}")
                    continue
                valid_messages.append(msg)

            if not valid_messages:
                continue

            # Process the batch
            try:
                process_batch(valid_messages)
                # Commit synchronously only after successful batch processing
                consumer.commit(asynchronous=False)
                logger.info(f"Processed and committed batch of {len(valid_messages)} messages.")
            except Exception as e:
                logger.error(f"Failed to process batch: {e}", exc_info=True)
                # If we fail, we crash the consumer to prevent data loss. 
                # Docker will restart it, and it will re-fetch from the last committed offset.
                raise
                
    except KeyboardInterrupt:
        logger.info("Shutdown requested via KeyboardInterrupt.")
    finally:
        consumer.close()
        logger.info("Consumer closed.")

def decode_json(msg: Message) -> Dict[str, Any]:
    if msg.value() is None:
        return None
    return json.loads(msg.value().decode('utf-8'))
