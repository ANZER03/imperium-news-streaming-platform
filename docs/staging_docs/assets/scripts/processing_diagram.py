from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.queue import Kafka
from diagrams.onprem.analytics import Spark
from diagrams.programming.language import Python

with Diagram("Processing Stage Architecture", show=False, filename="../processing_arch", direction="TB", outformat="png"):
    kafka_raw = Kafka("Raw CDC Topics")
    
    with Cluster("Spark Streaming Jobs"):
        dim_proc = Spark("Dimension\nMaterializer")
        can_proc = Spark("Canonical\nEngine")
        classifier = Spark("Topic\nClassifier")
        
    with Cluster("Durable Storage"):
        pg_storage = PostgreSQL("PostgreSQL\n(Dimensions, Articles,\nTaxonomy)")
        
    with Cluster("AI Gateway"):
        gateway = Python("Embedding\nGateway")
        ai_api = Python("NVIDIA / Llama.cpp\nAPI")

    kafka_raw >> dim_proc >> pg_storage
    kafka_raw >> can_proc
    pg_storage >> Edge(style="dotted") >> can_proc
    can_proc >> pg_storage
    can_proc >> Edge(label="Pending Event") >> Kafka("Canonical Topic") >> classifier
    
    classifier >> gateway >> ai_api
    ai_api >> gateway >> classifier
    classifier >> Edge(label="Classified Event") >> Kafka("Classified Topic")
    pg_storage >> Edge(style="dotted", label="Load Taxonomy") >> classifier
