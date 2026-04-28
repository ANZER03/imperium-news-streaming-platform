#!/usr/bin/env python3

from pathlib import Path
import sys
import os

# Add the clone lib directory to path
root_dir = Path(__file__).resolve().parent.parent
sys.path.append(str(root_dir / "infra" / "source-db-clone"))
sys.path.append(str(root_dir / "infra" / "source-db-clone" / "lib"))

from clone_table import news_source_query
from postgres_clone_common import CloneContext

def run_custom_news_clone():
    context = CloneContext.from_project_root(root_dir)
    
    # Target ID and Limit
    start_id = 565170965
    limit = 100000
    
    table_name = "table_news"
    export_file = context.config.export_dir / f"{table_name}.tail.csv"
    import_file = context.config.tmp_dir / f"{table_name}.100k.csv"
    
    # Custom query based on news_source_query logic but with ASC and START ID
    # We strip the default ORDER BY and LIMIT from news_source_query
    base_query = news_source_query(limit)
    # Extract the SELECT part (everything before ORDER BY)
    select_part = base_query.split("ORDER BY")[0].strip()
    
    custom_query = f"""
    {select_part}
    WHERE id > {start_id}
    ORDER BY id ASC
    LIMIT {limit}
    """
    
    print(f"Cloning {limit} rows from prod where id > {start_id}...")
    
    # Export to CSV (this is what the user specifically asked for)
    context.source_copy_query_to_csv(custom_query, export_file, with_header=True)
    print(f"Exported to {export_file}")
    
    # Also import to local DB to stay in sync
    print(f"Importing to local DB (APPEND)...")
    # Reuse the export file for import to avoid double download
    context.import_csv_chunk(table_name, export_file)
    
    print(f"Done. Imported 100k rows and updated {export_file}")

if __name__ == "__main__":
    run_custom_news_clone()
