from __future__ import annotations
from typing import Dict, List, Any
from pyspark.sql import SparkSession, DataFrame

# Safeguards for Postgres lookups
ID_CHUNK_SIZE = 1000
MAX_IDS_PER_BATCH = 10000

def fetch_by_ids_chunked(conn_factory: Any, table_name: str, id_col: str, cols: List[str], ids: List[int]) -> List[Any]:
    if not ids:
        return []
    
    # Cap the total IDs processed to prevent driver OOM
    ids = ids[:MAX_IDS_PER_BATCH]
    
    results = []
    with conn_factory().cursor() as cur:
        # Chunk IDs to avoid oversized SQL queries
        for i in range(0, len(ids), ID_CHUNK_SIZE):
            chunk = ids[i:i + ID_CHUNK_SIZE]
            query = f"SELECT {id_col}, {', '.join(cols)} FROM {table_name} WHERE {id_col} = ANY(%(ids)s) AND is_active = true"
            cur.execute(query, {"ids": chunk})
            results.extend(cur.fetchall())
    return results

def load_small_dimensions(spark: SparkSession, config: Any) -> Dict[str, DataFrame]:
    from imperium_news_pipeline.phase3.runtime_adapters import _postgres_connection_factory
    conn_factory = _postgres_connection_factory(config.postgres.dsn)

    def fetch_all(table_name: str, id_col: str, name_col: str) -> List[Any]:
        with conn_factory().cursor() as cur:
            cur.execute(f"SELECT {id_col}, {name_col} FROM {table_name} WHERE is_active = true")
            return cur.fetchall()

    countries_data = fetch_all(f"{config.postgres.dimension_table_prefix}countries", "country_id", "country_name")
    rubrics_data = fetch_all(f"{config.postgres.dimension_table_prefix}rubrics", "rubric_id", "rubric_title")
    languages_data = fetch_all(f"{config.postgres.dimension_table_prefix}languages", "language_id", "language_code")

    countries_df = spark.createDataFrame(countries_data, schema="dim_country_id INT, dim_country_name STRING") if countries_data else spark.createDataFrame([], "dim_country_id INT, dim_country_name STRING")
    rubrics_df = spark.createDataFrame(rubrics_data, schema="dim_rubric_id INT, dim_rubric_title STRING") if rubrics_data else spark.createDataFrame([], "dim_rubric_id INT, dim_rubric_title STRING")
    languages_df = spark.createDataFrame(languages_data, schema="dim_language_id INT, dim_language_code STRING") if languages_data else spark.createDataFrame([], "dim_language_id INT, dim_language_code STRING")

    return {
        "countries": countries_df,
        "rubrics": rubrics_df,
        "languages": languages_df,
    }

def fetch_large_dimensions(spark: SparkSession, config: Any, batch_df: DataFrame) -> Dict[str, DataFrame]:
    from imperium_news_pipeline.phase3.runtime_adapters import _postgres_connection_factory
    conn_factory = _postgres_connection_factory(config.postgres.dsn)

    # Extract unique IDs from the micro-batch efficiently
    # Note: We only select the columns we need to minimize data transfer to driver
    link_rows = batch_df.select("link_id").filter("link_id IS NOT NULL").distinct().collect()
    auth_rows = batch_df.select("authority_id").filter("authority_id IS NOT NULL").distinct().collect()
    
    link_ids = [r["link_id"] for r in link_rows]
    auth_ids = [r["authority_id"] for r in auth_rows]

    links_data = fetch_by_ids_chunked(conn_factory, f"{config.postgres.dimension_table_prefix}links", "link_id", ["source_domain", "source_name", "country_id"], link_ids)
    auths_data = fetch_by_ids_chunked(conn_factory, f"{config.postgres.dimension_table_prefix}authorities", "authority_id", ["source_domain", "source_name", "sedition_id"], auth_ids)

    sedition_ids = list({r[3] for r in auths_data if r[3] is not None})
    seditions_data = fetch_by_ids_chunked(conn_factory, f"{config.postgres.dimension_table_prefix}seditions", "sedition_id", ["country_id"], sedition_ids)

    links_df = spark.createDataFrame(links_data, schema="dim_link_id INT, link_source_domain STRING, link_source_name STRING, link_country_id INT") if links_data else spark.createDataFrame([], "dim_link_id INT, link_source_domain STRING, link_source_name STRING, link_country_id INT")
    auths_df = spark.createDataFrame(auths_data, schema="dim_authority_id INT, auth_source_domain STRING, auth_source_name STRING, auth_sedition_id INT") if auths_data else spark.createDataFrame([], "dim_authority_id INT, auth_source_domain STRING, auth_source_name STRING, auth_sedition_id INT")
    seds_df = spark.createDataFrame(seditions_data, schema="dim_sedition_id INT, sedition_country_id INT") if seditions_data else spark.createDataFrame([], "dim_sedition_id INT, sedition_country_id INT")

    return {
        "links": links_df,
        "authorities": auths_df,
        "seditions": seds_df,
    }
