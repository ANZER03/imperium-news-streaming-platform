from diagrams import Diagram, Cluster, Edge
from diagrams.onprem.database import PostgreSQL
from diagrams.onprem.inmemory import Redis
from diagrams.onprem.network import Internet
from diagrams.onprem.client import Client
from diagrams.programming.framework import Spring
from diagrams.onprem.database import Qdrant

with Diagram("Backend Serving Stage Architecture", show=False, filename="../backend_arch", direction="TB", outformat="png"):
    user = Client("Mobile / Web App")
    
    with Cluster("API Layer"):
        api = Spring("Spring Boot\n(Reactive WebFlux)")
        
    with Cluster("Data Sources"):
        redis = Redis("Redis\n(Feeds, Cards, Prefs)")
        qdrant_node = Qdrant("Qdrant\n(Semantic Search)")
        pg = PostgreSQL("PostgreSQL\n(Article Details)")

    user >> Edge(label="REST API") >> api
    api >> Edge(label="Fan-out / Interleave") >> redis
    api >> Edge(label="Vector Search") >> qdrant_node
    api >> Edge(label="Cache-aside") >> pg
