# Ideas

## Phase 3 Search Stack

Use split search stack:

- Qdrant for semantic retrieval.
- Lexical index, like Elasticsearch or OpenSearch, for keyword/BM25 search.
- Search service to merge, rerank, and dedupe results.

Reason:

- Qdrant good for meaning and filterable vectors.
- Lexical engine good for exact terms, phrase search, operators, and analyzers.
- One engine for both usually weaker than two focused engines.

Phase 3 shape:

- Qdrant stores embeddings plus filter payload.
- Lexical index stores full article text and searchable fields.
- App layer combines both result sets.
