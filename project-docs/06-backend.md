# 06 - Backend API & Reactive Serving Layer

## 1. Spring Boot WebFlux & Reactive Tech Stack

The serving backend (`news-app`) is built using **Spring Boot 3** and the **Spring WebFlux** reactive web framework. In traditional thread-per-request servlet models (like Spring MVC), each incoming HTTP request blocks an execution thread while waiting for database queries or cache hits, limiting concurrency.

Spring WebFlux uses an event-loop execution model (powered by Netty) and the **Project Reactor** library. Requests are handled asynchronously using reactive publishers:
*   **`Mono<T>`:** Represents a stream that emits zero or one element.
*   **`Flux<T>`:** Represents an asynchronous sequence of zero or more elements.

### Reactive Integrations
*   **R2DBC (Reactive Relational Database Connectivity):** Used for non-blocking SQL database operations against PostgreSQL.
*   **Reactive Redis Template:** Interacts asynchronously with the Redis cache.
*   **WebClient:** A non-blocking client used to query the Elasticsearch REST endpoints for keyword searches.

---

## 2. API Endpoint Mapping

The backend exposes three main categories of REST endpoints to the Kong Gateway:

### Feeds (V3)
*   `GET /api/v3/feed?userId={id}&limit={n}&sessionId={sid}`: Returns the personalized feed.
*   `GET /api/v3/feed/topic?userId={id}&topicId={tid}&limit={n}&sessionId={sid}`: Returns articles filtered by topic.
*   `GET /api/v3/feed/latest?userId={id}&limit={n}&sessionId={sid}`: Returns the chronological global feed.

### Articles & Interactions
*   `GET /api/v1/articles/{articleId}`: Returns full article details (falls back to PostgreSQL and re-warms the Redis cache if missed).
*   `POST /api/v1/users/{userId}/bookmarks/{articleId}`: Bookmarks an article.
*   `DELETE /api/v1/users/{userId}/bookmarks/{articleId}`: Removes a bookmark.
*   `GET /api/v1/users/{userId}/bookmarks`: Returns bookmarked articles.

### Search
*   `GET /api/v1/search/articles?q={query}&countryId={id}&limit={n}&page={p}`: Performs full-text keyword search via Elasticsearch.

---

## 3. Comparative Analysis: Feed V3 vs. Feed V2

The feed serving algorithm underwent a major redesign from V2 to V3 to solve performance bottlenecks.

| Dimension | Feed V2 (Lua Aggregation) | Feed V3 (Timestamp-Window Scanner) |
|---|---|---|
| **Aggregation Method** | Lua script (`aggregate.lua`) running inside Redis. | Merges and filters sorted sets in Java using simple `ZREVRANGEBYSCORE` calls. |
| **History Filtration** | Compares every candidate against a large `seen:{userId}` ZSET. | Uses O(1) **Read Intervals** (`[[startTs, endTs], ...]`) to skip read periods. |
| **Redis Load** | High. Large seen ZSET scans block the single-threaded Redis engine. | Low. Small range queries and interval-skips occur outside Redis. |
| **Pagination Scalability** | Degrades. Large read history forces script iterations to scan deeper, hitting limits. | Constant. Read intervals skip pre-read zones without scanning candidates. |
| **History Footprint** | Grows unboundedly. Keeps a ZSET of every read article ID. | Compact. Merges continuous time ranges into a single JSON interval tuple. |

---

## 4. Feed V3 Execution Phases

The Feed V3 Timestamp-Window Scanner executes five distinct phases sequentially for every request:

```
┌──────────────────────────────────────────────────────────────────┐
│                      Feed V3 Pipeline                            │
│                                                                  │
│  Phase A (New Items): Scan (session.newestCursor, now]           │
│  Inject new articles published since the user's last request.     │
│                                                                  │
│  Phase B (Buffer Drain): Return session.bufferIds                 │
│  Drains leftover items buffered from the previous request.       │
│                                                                  │
│  Phase C (Older Window Scan): Loop backward by windowMillis      │
│  - If window covered by Read Interval -> Skip time range.        │
│  - If partially covered -> Query uncovered sub-ranges.            │
│                                                                  │
│  Hydration: Batch load cards via Redis HASH or PostgreSQL        │
│                                                                  │
│  Commit: Merge newly exhausted windows -> Save session state     │
└──────────────────────────────────────────────────────────────────┘
```

### Phase A — New Item Injection
*   The scanner checks for any article published between the session's `newestCursor` and the current timestamp (`now`).
*   Any matching articles are returned at the top of the feed to ensure real-time delivery of fresh content.
*   The `newestCursor` is then bumped to `now`.

### Phase B — Buffer Drain
*   If the previous request collected more articles than the requested limit, the leftovers are cached in a temporary session buffer (`session.bufferIds`).
*   Phase B drains this buffer and returns these items immediately before executing new database scans.

### Phase C — Older Window Scan (Interval-Skip)
*   The algorithm scans backward in time starting from the session's `olderCursor` in chunks of `windowMillis` (defaults to 4 hours).
*   For each 4-hour window, it checks the user's **Read Intervals** JSON tuple:
    1.  **Fully Covered:** If the window falls entirely within an exhausted interval (e.g. `[1719921600, 1719936000]`), the scanner **skips** the entire 4-hour window in O(1) without calling Redis.
    2.  **Partially Covered:** The scanner subtracts the read intervals from the window and queries the remaining sub-ranges using `ZREVRANGEBYSCORE`.
    3.  **Exhausted Window:** If a window is fully scanned and returns no new items, it is flagged as exhausted.
*   This loop runs until the page limit is reached or the `maxWindowsPerRequest` threshold is hit.

### Hydration & Caching
*   The collected article IDs are batch-hydrated by fetching their `news:{article_id}` hashes from Redis.
*   If a cache miss occurs (e.g. an article evicted from Redis), the backend queries PostgreSQL via R2DBC, serializes the result, writes it back to Redis with a 10-day TTL, and returns the article card.

### Commit
*   The backend updates the session under a Redis-based locking mechanism (`feed:lock:{userId}:{sessionId}`) to guarantee atomicity.
*   It appends the newly returned article IDs to the user's read ID set (`feed:read:ids:{userId}:{scopeHash}`) and merges any newly exhausted windows into the read intervals collection, merging overlapping ranges (e.g. `[[3000, 5000], [4500, 7000]] -> [[3000, 7000]]`).
