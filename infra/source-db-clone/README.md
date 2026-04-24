# Source DB Clone

This folder contains the one-by-one clone workflow for refreshing
`imperium-news-source-db` from the production PostgreSQL source.

What each script does:

- reads production connection values from `.env.prod`
- reads local source DB values from `.env`
- clones all rows for the non-news tables in chunks ordered by `id ASC`
- clones only the last `50_000` rows for `table_news` using `ORDER BY id DESC`
- imports the first `46_000` news rows into the local source DB
- writes the remaining `4_000` news rows to a CSV file under `exports/`

Scripts:

- `clone_table_pays.py`
- `clone_table_langue.py`
- `clone_table_sedition.py`
- `clone_table_authority.py`
- `clone_table_rubrique.py`
- `clone_table_links.py`
- `clone_table_news.py`

The scripts assume:

- the compose stack is up
- `postgres-source` exists as the local source DB hostname
- the local source DB container is `imperium-news-source-db`
- the destination tables already exist from the init scripts

Generated files are ignored by Git:

- `.tmp/`
- `.state/`
- `exports/`
- `*.csv`
