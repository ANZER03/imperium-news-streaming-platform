import csv
import psycopg
import os
import sys

# Database connection details (localhost mapping from docker-compose)
DB_DSN = "postgresql://postgres:postgres@localhost:35432/imperium-news-source"
CSV_PATH = "infra/source-db-clone/exports/table_news.tail.csv"

# List of columns that are NOT NULL but might be empty in CSV
NOT_NULL_STRINGS = {
    "more_url", "more_title", "more_inner_text", "more_reporter", 
    "more_date_text", "more_image_url", "more_hash", 
    "more_meta_keywords", "more_meta_description", "more_trad_fr"
}

def main():
    if not os.path.exists(CSV_PATH):
        print(f"Error: CSV file not found at {CSV_PATH}")
        sys.exit(1)

    print(f"Connecting to database at {DB_DSN}...")
    try:
        with psycopg.connect(DB_DSN) as conn:
            with conn.cursor() as cur:
                with open(CSV_PATH, mode='r', encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    
                    columns = reader.fieldnames
                    placeholders = ", ".join(["%s"] * len(columns))
                    query = f"INSERT INTO table_news ({', '.join(columns)}) VALUES ({placeholders}) ON CONFLICT (id) DO NOTHING"
                    
                    print("Streaming data...")
                    count = 0
                    for row in reader:
                        values = []
                        for col in columns:
                            val = row[col]
                            if val.lower() == 't':
                                values.append(True)
                            elif val.lower() == 'f':
                                values.append(False)
                            elif val == '':
                                if col in NOT_NULL_STRINGS:
                                    values.append('')
                                else:
                                    values.append(None)
                            else:
                                values.append(val)
                        
                        cur.execute(query, values)
                        count += 1
                        if count % 100 == 0:
                            print(f"Inserted {count} rows...")
                    
                    conn.commit()
                    print(f"Successfully finished. Total rows processed: {count}")

    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
