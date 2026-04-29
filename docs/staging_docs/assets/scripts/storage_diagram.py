from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.queue import Kafka
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.analytics import Spark
from diagrams.onprem.database import Qdrant

with Diagram("Storage Stage Architecture", show=False, filename="../storage_arch", direction="LR", outformat="png"):
    kafka_topics = Kafka("Canonical & Classified\nTopics")
    
    with Cluster("Projectors (Spark)"):
        redis_proj = Spark("Redis Projectors\n(Pending & Topics)")
        qdrant_proj = Spark("Qdrant Projector")
        pg_proj = Spark("Postgres Projector")
        
    with Cluster("Serving Layer"):
        redis = Redis("Redis\n(Feeds & Cards)")
        qdrant_node = Qdrant("Qdrant\n(Vectors)")
        pg_state = PostgreSQL("PG: Projection\nState")
        pg_main = PostgreSQL("PG: Main Storage\n(Classified Updates)")

    kafka_topics >> redis_proj
    kafka_topics >> qdrant_proj
    kafka_topics >> pg_proj
    
    redis_proj >> redis
    redis_proj >> pg_state
    qdrant_proj >> qdrant_node
    pg_proj >> pg_main
