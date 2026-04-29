from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.queue import Kafka
from diagrams.onprem.network import Kong
from diagrams.onprem.compute import Server

with Diagram("Ingestion Stage Architecture", show=False, filename="../ingestion_arch", direction="LR", outformat="png"):
    with Cluster("Source Infrastructure"):
        db_source = PostgreSQL("PostgreSQL\nProduction")
        signal_table = PostgreSQL("Debezium\nSignals")

    with Cluster("Kafka Connect"):
        news_connector = Kong("Debezium\nNews Connector")
        ref_connector = Kong("Debezium\nRef Connector")
        meta_connector = Kong("Debezium\nMetadata Connector")

    with Cluster("Streaming Backbone"):
        kafka = Kafka("Kafka Cluster")
        schema_registry = Server("Schema Registry")
        
    db_source >> Edge(label="WAL/pgoutput") >> news_connector
    db_source >> Edge(label="WAL/pgoutput") >> ref_connector
    db_source >> Edge(label="WAL/pgoutput") >> meta_connector
    signal_table >> Edge(label="Signals") >> news_connector
    
    news_connector >> kafka
    ref_connector >> kafka
    meta_connector >> kafka
    kafka - schema_registry
