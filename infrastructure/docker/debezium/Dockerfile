FROM confluentinc/cp-kafka-connect:7.7.7 AS confluent-source

FROM debezium/connect:2.3

COPY --from=confluent-source /usr/share/java/kafka-serde-tools /kafka/connect/confluent-avro
