# Imperium News API — Backend

Reactive REST API for the Imperium News Streaming Platform. Built with **Spring Boot 4** + **WebFlux** (non-blocking throughout), backed by **Redis** (hot data), **PostgreSQL** (cold/full-text data), and **Qdrant** (vector search — wired but not yet exposed via HTTP).

---

## Table of Contents

1. [Stack & Infrastructure](#1-stack--infrastructure)
2. [Architecture Overview](#2-architecture-overview)
3. [Project Structure](#3-project-structure)
4. [Redis Data Model](#4-redis-data-model)
5. [API Reference](#5-api-reference)
   - [Country Domain](#51-country-domain)
   - [User Domain](#52-user-domain)
   - [Topic Domain](#53-topic-domain)
   - [Feed Domain](#54-feed-domain)
   - [Article Domain](#55-article-domain)
   - [Actuator](#56-actuator-health--metrics)
6. [Domain Logic & Flows](#6-domain-logic--flows)
   - [User Onboarding Flow](#61-user-onboarding-flow)
   - [Topic Listing Flow](#62-topic-listing-flow)
   - [Feed Generation Flow](#63-feed-generation-flow)
   - [Article Detail Flow](#64-article-detail-flow)
   - [Bookmark Flow](#65-bookmark-flow)
7. [Pagination — Cursor Model](#7-pagination--cursor-model)
8. [Timestamp Handling](#8-timestamp-handling)
9. [Error Handling](#9-error-handling)
10. [Configuration](#10-configuration)
11. [Running Locally](#11-running-locally)
12. [Tests](#12-tests)

---

## 1. Stack & Infrastructure

| Layer | Technology |
|---|---|
| Language | Java 21 |
| Framework | Spring Boot 4.0 + WebFlux (Project Reactor) |
| Hot cache | Redis (Reactive) — feeds, user prefs, bookmarks, viewed history, article cache, topic list |
| Cold store | PostgreSQL (Reactive R2DBC) — full article bodies, topic taxonomy |
| Vector store | Qdrant (gRPC) — article embeddings (wired, not yet exposed via HTTP) |
| Build tool | Maven (`./mvnw`) |
| Port | **8999** |

---

## 2. Architecture Overview

```
Client (Mobile / Web)
        │  HTTP
        ▼
┌─────────────────────────────────┐
│         Spring WebFlux          │
│  (non-blocking, event-driven)   │
│                                 │
│  UserController                 │
│  TopicController                │
│  FeedController                 │
│  ArticleController              │
└────────────┬────────────────────┘
             │
     ┌───────┴───────┐
     │               │
     ▼               ▼
  Redis           PostgreSQL
  (hot path)      (cold / full-text)
  · user prefs    · imperium_news_articles
  · feeds         · imperium_topic_taxonomy
  · viewed log
  · bookmarks
  · article cache
  · topic list
```

Every operation returns a `Mono<T>` or `Flux<T>` — there is no blocking code anywhere in the stack. Redis queries run through `ReactiveRedisTemplate`, PostgreSQL queries run through `R2DBC DatabaseClient`.

---

## 3. Project Structure

```
src/main/java/solutions/imperium/news_api/
├── NewsAppApplication.java          Entry point
├── config/
│   ├── RedisConfig.java             Two reactive Redis templates (typed + string)
│   ├── R2dbcConfig.java             DatabaseClient bean
│   ├── QdrantConfig.java            Qdrant config placeholder
│   └── WebFluxConfig.java           WebFlux config placeholder
├── core/
│   ├── Constants.java               All Redis key patterns (single source of truth)
│   ├── PageResult.java              Generic cursor-paginated response wrapper
│   └── FlexibleEpochDeserializer.java  Normalises any timestamp format to epoch-seconds
├── exception/
│   ├── CustomExceptions.java        ArticleNotFoundException
│   └── GlobalExceptionHandler.java  Maps exceptions → HTTP status codes
└── domain/
    ├── user/                        Onboarding — generates userId, saves prefs to Redis
    ├── topic/                       Topic taxonomy — Redis cache-aside over PostgreSQL
    ├── feed/                        Personalised feed — round-robin fan-out over Redis ZSETs
    ├── article/                     Article detail + bookmarks — Redis cache-aside over PostgreSQL
    └── search/                      (placeholder — Qdrant integration in progress)
```

---

## 4. Redis Data Model

All key patterns live in `Constants.java`.

| Key | Type | Description | TTL |
|---|---|---|---|
| `user:{userId}:prefs` | Hash | User preferences: `country_id` (int), `topics` (JSON list) | None |
| `user:{userId}:viewed` | Set | Article IDs the user has already seen in feed | 12 days |
| `user:{userId}:saved` | Set | Bookmarked article IDs | None |
| `feed:topic:{topic}` | Sorted Set | Article IDs scored by publish timestamp (epoch-seconds). Written by the Python pipeline | None (managed by pipeline) |
| `feed:country:{country_id}` | Sorted Set | All articles for a country, scored by publish timestamp (fallback when topics exhausted) | None (managed by pipeline) |
| `news:{articleId}` | Hash | Flat article card fields written by pipeline: `title`, `excerpt`, `image_url`, `source_name`, `published_at`, `crawled_at`, `processed_at`, `root_topic_label` | None (managed by pipeline) |
| `article:{articleId}` | String (JSON) | Full `ArticleDetailDto` cached after first Postgres hit | 24 hours |
| `topics:list` | String (JSON) | Cached list of all active top-level topics | 24 hours |
| `countries:list` | String (JSON) | Cached list of all countries from `table_pays` | 24 hours |

---

## 5. API Reference

Base URL: `http://localhost:8999`

All responses are `application/json`. All timestamps in responses are **epoch-seconds** (Long).

---

### 5.1 Country Domain

#### `GET /api/v1/countries`

Returns all countries from `table_pays` (reference table). Used for onboarding country picker. Cached 24h in Redis.

**Response `200 OK`:**
```json
[
  { "countryId": 1, "countryName": "Afghanistan", "abbreviation": "AF" },
  { "countryId": 2, "countryName": "Algérie", "abbreviation": "DZ" },
  { "countryId": 3, "countryName": "Åland", "abbreviation": "AX" }
]
```

| Field | Type | Description |
|---|---|---|
| `countryId` | Integer | Country ID (primary key in `table_pays`) |
| `countryName` | String | Full country name |
| `abbreviation` | String | ISO 2-letter code |

---

### 5.2 User Domain

#### `POST /api/v1/users/onboard`

Registers a new anonymous user. Generates a UUID, saves country + topic preferences to Redis, and returns the userId. **The client must persist this userId** — it is the only identity token used by every other endpoint.

**Request body:**
```json
{
  "countryId": 1,
  "topics": ["science_technology", "world", "sport"]
}
```

| Field | Type | Description |
|---|---|---|
| `countryId` | Integer | Country identifier (used for future localisation) |
| `topics` | String[] | Topic IDs from `GET /api/v1/topics`. Min 1 recommended |

**Response `200 OK`:**
```json
{
  "userId": "a3f2c1d0-89ab-4cde-b012-123456789abc"
}
```

**Flow:**
```
POST /api/v1/users/onboard
  → UserService.onboardUser()
  → UUID.randomUUID()  (new anonymous userId)
  → HMSET user:{userId}:prefs  country_id=1  topics=["science_technology","world"]
  → return { userId }
```

---

### 5.3 Topic Domain

#### `GET /api/v1/topics`

Returns all active top-level topics. Used to populate the onboarding topic-picker screen.

**Response `200 OK`:**
```json
[
  { "topicId": "business_economy", "displayName": "Business & Economy" },
  { "topicId": "entertainment",    "displayName": "Entertainment" },
  { "topicId": "science_technology","displayName": "Science & Technology" },
  { "topicId": "sport",            "displayName": "Sport" },
  { "topicId": "world",            "displayName": "World" }
]
```

| Field | Type | Description |
|---|---|---|
| `topicId` | String | Use this value in `POST /api/v1/users/onboard` and as feed topic keys |
| `displayName` | String | Human-readable label for UI display |

**Flow (cache-aside):**
```
GET /api/v1/topics
  → TopicRepository.findAllActive()
  → GET topics:list  (Redis)
      hit  → deserialize JSON → return list
      miss → SELECT topic_id, display_name FROM imperium_topic_taxonomy
                 WHERE is_active=true AND parent_topic_id IS NULL
                 ORDER BY display_name  (PostgreSQL)
           → SET topics:list <json> EX 86400
           → return list
```

---

### 5.4 Feed Domain

#### `GET /api/v1/feed`

Returns a paginated, personalised news feed for the user. Articles are sourced from all the user's topics and interleaved round-robin (social-media style) so every topic contributes equally before sorting by recency.

**Query parameters:**

| Parameter | Type | Required | Default | Description |
|---|---|---|---|---|
| `userId` | String | Yes | — | UUID from onboarding |
| `cursor` | Long | No | current time (epoch-sec) | Pagination cursor — pass `nextCursor` from previous response |
| `limit` | Integer | No | 20 | Articles per page (max practical: 50) |

**Response `200 OK`:**
```json
{
  "data": [
    {
      "id": "abc123",
      "title": "Quantum computing breaks encryption milestone",
      "excerpt": "Researchers at MIT demonstrated...",
      "imageUrl": "https://cdn.example.com/img/abc123.jpg",
      "sourceName": "MIT Technology Review",
      "publishedAt": 1745820000,
      "crawledAt": 1745820300,
      "processedAt": 1745820420,
      "rootTopicLabel": "science_technology"
    }
  ],
  "nextCursor": 1745700000
}
```

| Field | Type | Description |
|---|---|---|
| `data` | ArticleCard[] | Ordered newest-first within the page |
| `nextCursor` | Long \| null | Pass as `cursor` in the next request. `null` means no more articles |

**ArticleCard fields:**

| Field | Type | Description |
|---|---|---|
| `id` | String | Article ID — use for `GET /api/v1/articles/{id}`, bookmarks, and view tracking |
| `title` | String | Article headline |
| `excerpt` | String | Short summary / lead paragraph |
| `imageUrl` | String | Hero image URL |
| `sourceName` | String | News source name (e.g. "BBC", "Reuters") |
| `publishedAt` | Long | Publish timestamp (epoch-seconds) |
| `crawledAt` | Long | When the pipeline ingested it |
| `processedAt` | Long | When ML classification finished |
| `rootTopicLabel` | String | Top-level topic this article belongs to |

---

#### `POST /api/v1/feed/views`

Marks articles as viewed so they will not reappear in the user's feed. Call this as the user scrolls past cards — batch the IDs for efficiency. Viewed status expires after **12 days**.

**Request body:**
```json
{
  "userId": "a3f2c1d0-89ab-4cde-b012-123456789abc",
  "articleIds": ["abc123", "def456", "ghi789"]
}
```

**Response `200 OK`** — empty body.

---

### 5.5 Article Domain

#### `GET /api/v1/articles/{articleId}`

Fetches the full article detail — body text, author, URL, etc. Uses a Redis cache (24h TTL) in front of PostgreSQL.

**Path parameter:** `articleId` — from `ArticleCard.id`

**Response `200 OK`:**
```json
{
  "id": "abc123",
  "title": "Quantum computing breaks encryption milestone",
  "bodyText": "Full article body text...",
  "author": "Jane Smith",
  "url": "https://source.example.com/articles/abc123",
  "imageUrl": "https://cdn.example.com/img/abc123.jpg",
  "publishedAt": 1745820000,
  "crawledAt": 1745820300,
  "processedAt": 1745820420,
  "sourceName": "MIT Technology Review",
  "countryName": "United States",
  "topic": "science_technology"
}
```

**Response `404 Not Found`** — plain text `"Article not found: {articleId}"` when the article doesn't exist in Redis or PostgreSQL.

| Field | Type | Description |
|---|---|---|
| `bodyText` | String | Full article text (not in feed cards) |
| `author` | String | Reporter / author name |
| `url` | String | Original article URL at the source |
| `countryName` | String | Country the article originates from |
| `topic` | String | Primary topic label |

---

#### `POST /api/v1/users/{userId}/bookmarks/{articleId}`

Saves an article to the user's bookmarks (persisted in Redis with no TTL).

**Response `200 OK`** — empty body.

---

#### `DELETE /api/v1/users/{userId}/bookmarks/{articleId}`

Removes an article from the user's bookmarks.

**Response `204 No Content`** — empty body.

---

#### `GET /api/v1/users/{userId}/bookmarks`

Returns all bookmarked articles as a stream of `ArticleCard` objects. Order is not guaranteed (Redis Set).

**Response `200 OK`:**
```json
[
  {
    "id": "abc123",
    "title": "...",
    "excerpt": "...",
    "imageUrl": "...",
    "sourceName": "...",
    "publishedAt": 1745820000,
    "crawledAt": 1745820300,
    "processedAt": 1745820420,
    "rootTopicLabel": "science_technology"
  }
]
```

Uses the same `ArticleCard` shape as the feed. Articles whose Redis hash has been evicted will be silently omitted.

---

### 5.6 Actuator (Health & Metrics)

| Endpoint | Description |
|---|---|
| `GET /actuator/health` | Full health details (Redis, Postgres, Qdrant probes) |
| `GET /actuator/info` | App info |
| `GET /actuator/metrics` | JVM + Spring metrics |
| `GET /actuator/prometheus` | Prometheus-format metrics for scraping |

---

## 6. Domain Logic & Flows

### 6.1 User Onboarding Flow

```
Client                        UserController          UserService         UserRepository          Redis
  │                                │                       │                    │                   │
  │  POST /api/v1/users/onboard    │                       │                    │                   │
  │  { countryId, topics }         │                       │                    │                   │
  │──────────────────────────────► │                       │                    │                   │
  │                                │ onboardUser(req)       │                    │                   │
  │                                │──────────────────────► │                    │                   │
  │                                │                       │ UUID.randomUUID()  │                   │
  │                                │                       │ saveUserPreferences│                   │
  │                                │                       │──────────────────► │                   │
  │                                │                       │                    │ HMSET             │
  │                                │                       │                    │ user:{id}:prefs   │
  │                                │                       │                    │ country_id=X      │
  │                                │                       │                    │ topics=[...]      │
  │                                │                       │                    │──────────────────►│
  │                                │                       │                    │◄──────────────────│
  │                                │◄───────────────────── │                    │                   │
  │  { "userId": "uuid" }          │                       │                    │                   │
  │◄───────────────────────────────│                       │                    │                   │
```

---

### 6.2 Topic Listing Flow

```
GET /api/v1/topics
      │
      ▼
TopicRepository.findAllActive()
      │
      ├─── GET topics:list ──► Redis
      │         │
      │     hit ▼
      │    deserialize JSON array → return Flux<TopicDto>
      │
      └─── miss ▼
           SELECT topic_id, display_name
           FROM imperium_topic_taxonomy
           WHERE is_active = true AND parent_topic_id IS NULL
           ORDER BY display_name
                │  (PostgreSQL via R2DBC)
                ▼
           SET topics:list <json> EX 86400  ──► Redis
                │
                ▼
           return Flux<TopicDto>
```

---

### 6.3 Feed Generation Flow

Two-phase fan-out with country fallback. Phase 1 queries user's subscribed topics; Phase 2 activates only when Phase 1 yields no results.

```
GET /api/v1/feed?userId=X&cursor=T&limit=20
      │
      ▼
[0] Normalize cursor to epoch-seconds
    → handle client input in ms or seconds
      │
      ▼
[1] Load user prefs in parallel
    HGET user:{userId}:prefs topics      → List<String>
    HGET user:{userId}:prefs country_id  → Integer
    (fallback: topics=["world"], country_id=0)
      │
      ▼
[2] PHASE 1: TOPIC FAN-OUT
    For each topic, in parallel:
      ZREVRANGEBYSCORE feed:topic:{topic} (cursor 0 LIMIT 0 (limit*3) WITHSCORES
      → (id, score) tuples, exclusive upper bound on cursor
      → max limit*3 per topic to avoid fetching too much
      │
    If Phase 1 returns 0 IDs → PHASE 2 (country fallback)
      │
      ▼
[3] PHASE 2: COUNTRY FALLBACK (if Phase 1 empty)
    ZREVRANGEBYSCORE feed:country:{country_id} (cursor 0 LIMIT 0 (limit*4) WITHSCORES
    → activates only when topic ZSETs are exhausted
      │
      ▼
[4] DEDUP by id (keep highest score per id)
      │
      ▼
[5] FILTER VIEWED
    SMEMBERS user:{userId}:viewed
    → remove already-seen articles
      │
      ▼
[6] SORT by ZSET score DESC (epoch-seconds)
      │
      ▼
[7] HYDRATE (parallel HGETALL per article ID)
    HGETALL news:{articleId}
    → articulated with limit*2 fetch to tolerate missing hashes
    → silently drop empty hashes
      │
      ▼
[8] PAGE: Take first `limit` hydrated cards
      │
      ▼
[9] nextCursor = min(score) of returned page
    → passed to next request with exclusive boundary (Range.rightOpen)
    → ensures no duplicates across page boundaries
      │
      ▼
PageResult { data: [...], nextCursor: 1777314725 }
```

**Why two-phase?** If we always merged topic ZSETs with the country ZSET, country articles would pollute the feed while the user's topic subscriptions still have content. The fallback only activates when topic queries return nothing.

**Pagination:** Pass `nextCursor` as `cursor` in the next request. The cursor is a ZSET score (epoch-seconds, exclusive). Each request returns articles with score < cursor, scrolling backwards in time. No duplicates because the boundary is exclusive.

**View deduplication:** As the user scrolls, call `POST /api/v1/feed/views` with the batch of IDs they have seen. Those IDs are added to `user:{userId}:viewed` (a Redis Set with a 12-day TTL) and will not reappear in future feed requests.

---

### 6.4 Article Detail Flow

```
GET /api/v1/articles/{articleId}
      │
      ▼
ArticleService.getArticleDetails(articleId)
      │
      ├─── GET article:{articleId} ──► Redis (string key, JSON value)
      │         │
      │     hit ▼
      │    deserialize ArticleDetailDto → return 200
      │
      └─── miss ▼
           SELECT ... FROM imperium_news_articles
           WHERE article_id = :id   (PostgreSQL via R2DBC)
                │
            found ▼
           map row → Article → ArticleDetailDto
           SET article:{articleId} <json> EX 86400  ──► Redis
           return 200
                │
            not found ▼
           throw ArticleNotFoundException
           → GlobalExceptionHandler → 404 "Article not found: {id}"
```

---

### 6.5 Bookmark Flow

```
Add bookmark:
POST /api/v1/users/{userId}/bookmarks/{articleId}
  → SADD user:{userId}:saved {articleId}
  → 200 OK

Remove bookmark:
DELETE /api/v1/users/{userId}/bookmarks/{articleId}
  → SREM user:{userId}:saved {articleId}
  → 204 No Content

List bookmarks:
GET /api/v1/users/{userId}/bookmarks
  → SMEMBERS user:{userId}:saved
  → For each id: HGETALL news:{id} → ArticleCardDto
  → Flux<ArticleCardDto> (streamed, order not guaranteed)
  → 200 OK
```

---

## 7. Pagination — Cursor Model

The feed uses **time-based cursor pagination** (not offset/page-number).

```
First request:
  GET /api/v1/feed?userId=X
  → cursor defaults to now (System.currentTimeMillis() / 1000)
  → returns 20 articles with publishedAt ≤ now
  → response includes nextCursor = min(publishedAt in batch)

Subsequent requests:
  GET /api/v1/feed?userId=X&cursor={nextCursor}
  → returns articles with publishedAt < nextCursor
  → continues scrolling backwards in time

End of feed:
  nextCursor = null  (no articles returned)
```

**Why cursor instead of offset?** New articles are continuously added to the ZSETs by the pipeline. Offset-based pagination would skip or duplicate articles as new items are prepended. Cursor-based pagination is stable: each request anchors to a specific point in time.

---

## 8. Timestamp Handling

All timestamps in responses are **epoch-seconds** (`Long`). The pipeline may write timestamps in different formats (epoch-seconds, epoch-milliseconds, epoch-microseconds, or ISO-8601 strings). `FlexibleEpochDeserializer` normalises all of these to epoch-seconds transparently.

```
v > 2_000_000_000_000_000  →  microseconds  →  divide by 1_000_000
v > 20_000_000_000         →  milliseconds  →  divide by 1_000
otherwise                  →  seconds       →  use as-is
"2026-04-28T01:34:24Z"     →  ISO-8601      →  Instant.parse().getEpochSecond()
blank / unparseable        →  null
```

---

## 9. Error Handling

All errors are handled by `GlobalExceptionHandler` (`@ControllerAdvice`).

| Exception | HTTP Status | Body |
|---|---|---|
| `ArticleNotFoundException` | `404 Not Found` | `"Article not found: {articleId}"` |
| Unhandled exceptions | `500 Internal Server Error` | Spring default |

---

## 10. Configuration

`src/main/resources/application.yml`

```yaml
server:
  port: 8999

spring:
  r2dbc:
    url: r2dbc:postgresql://localhost:35432/imperium-news-source
    username: postgres
    password: postgres
    pool:
      initial-size: 5
      max-size: 20

  data:
    redis:
      host: localhost
      port: 46379
      timeout: 2000ms

  ai:
    vectorstore:
      qdrant:
        host: localhost
        port: 46334       # gRPC
        collection-name: imperium_articles
```

---

## 11. Running Locally

**Prerequisites:** Java 21, Maven (wrapper included), Redis on `localhost:46379`, PostgreSQL on `localhost:35432`.

```bash
# Build & run
./mvnw spring-boot:run

# Or build JAR first
./mvnw package -DskipTests
java -jar target/news-app-0.0.1-SNAPSHOT.jar
```

**Quick smoke test:**
```bash
# 1. Get countries
curl http://localhost:8999/api/v1/countries | head -5

# 2. Get topics
curl http://localhost:8999/api/v1/topics

# 3. Onboard a user
curl -X POST http://localhost:8999/api/v1/users/onboard \
  -H "Content-Type: application/json" \
  -d '{"countryId": 1, "topics": ["world", "science_technology"]}'
# → {"userId": "..."}

# 4. Get feed (Phase 1: topic fan-out)
curl "http://localhost:8999/api/v1/feed?userId=<userId>&limit=10"

# 5. Paginate (Phase 2: country fallback triggers when topics exhausted)
curl "http://localhost:8999/api/v1/feed?userId=<userId>&limit=10&cursor=<nextCursor>"

# 6. Track views
curl -X POST http://localhost:8999/api/v1/feed/views \
  -H "Content-Type: application/json" \
  -d '{"userId": "<userId>", "articleIds": ["id1", "id2"]}'

# 7. Get article detail
curl http://localhost:8999/api/v1/articles/<articleId>

# 8. Bookmark an article
curl -X POST http://localhost:8999/api/v1/users/<userId>/bookmarks/<articleId>
```

---

## 12. Tests

```bash
./mvnw test
```

18 tests across all domains — unit tests with Mockito mocks for the service and controller layers, plus a Spring context smoke test.

| Test class | Coverage |
|---|---|
| `FeedServiceTest` | Two-phase fan-out, dedup, filter-viewed, sort by score, country fallback, empty feed |
| `FeedControllerTest` | Feed HTTP layer, query parameter binding |
| `ArticleServiceTest` | Cache-aside logic, bookmark operations, not-found handling |
| `ArticleControllerTest` | Article + bookmark HTTP layer |
| `UserServiceTest` | User ID generation, preference storage |
| `UserControllerTest` | Onboarding HTTP layer |
| `SimpleTest` | Sanity check |
| `NewsAppApplicationTests` | Full Spring context startup |

**Recent changes:**
- Feed algorithm rewritten from round-robin interleave to two-phase (topic fan-out + country fallback)
- ZSET scores now authoritative for cursor pagination (eliminates ms/s unit mismatch)
- Exclusive cursor boundaries prevent article duplication across pages
- Country domain added (`GET /api/v1/countries`) for onboarding picker
