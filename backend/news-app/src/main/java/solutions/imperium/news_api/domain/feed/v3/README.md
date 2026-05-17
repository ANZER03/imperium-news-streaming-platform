# Feed V3 — Timestamp-Window Scanner

Feed V3 replaces the V2 Lua-heavy, seen-list-filtered pipeline with a compact
timestamp-window scanner. The core idea: instead of filtering every candidate
against a growing `seen:{userId}` ZSET on every page, V3 stores **exhausted
timestamp intervals** that represent ranges the server has fully scanned. A
single interval can skip thousands of articles in O(1).

---

## Why V3

V2 problems:

| Problem | Impact |
|---|---|
| `seen:{userId}` grows unboundedly | Every page filters against a huge ZSET |
| Lua `aggregate.lua` runs on Redis | Blocks Redis under load |
| `seekMaxIterations` cap | Returns partial pages when read history is large |
| Session anchor probing | Extra Redis round-trip on session create |

V3 fixes:

- No Lua scripts for aggregation — plain `ZREVRANGEBYSCORE` per topic, merge in Java.
- No per-page seen-list scan — intervals skip entire time ranges in O(1).
- Dense windows buffered in session — no re-scan on next page.
- Immediate new-item injection on every request (Phase A).

---

## Algorithm

Each request runs three phases in order:

```
Phase A  →  Phase B  →  Phase C  →  Hydrate  →  Commit
```

### Phase A — New items

Scans the window `(session.newestCursor, now]` for articles published since the
last request. These are injected first, before any older content.

After Phase A: `newestCursor = now`.

### Phase B — Buffer drain

If the previous request filled the page mid-window, the leftover candidates were
stored in `session.bufferIds` alongside `pendingWindow = [wStart, wEnd]`. Phase B
serves those buffered IDs without any Redis ZSET scan.

When the buffer is fully drained, `pendingWindow` is promoted to a read interval
at commit time.

### Phase C — Older window scan with interval-skip

Steps backward from `session.olderCursor` by `windowMillis` (default 4 hours in
epoch-seconds). For each window:

1. **Covered by an interval?** → jump past the entire interval in O(1), no Redis call.
2. **Partially covered?** → `subtract(intervals, wStart, wEnd)` returns only the
   uncovered sub-ranges; scan those with `ZREVRANGEBYSCORE`.
3. **Window fully consumed?** → add `[wStart, wEnd]` to exhausted intervals at commit.
4. **Page filled mid-window?** → store leftovers as `bufferIds + pendingWindow` on session.

Loop is bounded by `maxWindowsPerRequest` (default 12).

### Hydrate

Batch-hydrate the final ordered article IDs via `news:{id}` Redis HASH (V2 cache
path), falling back to PostgreSQL for misses and re-warming Redis.

### Commit

Under the held session lock (atomic with respect to concurrent requests):

1. `SADD` returned IDs → `feed:read:ids:{userId}:{scopeHash}` (TTL 12 days).
2. Merge any newly-exhausted windows into `feed:read:intervals:{userId}:{scopeHash}`.
3. Save updated session HASH with TTL.
4. Release lock.

---

## Redis Keys

| Key | Type | Content | TTL |
|---|---|---|---|
| `feed:read:intervals:{userId}:{scopeHash}` | STRING JSON | `[[startTs,endTs],...]` normalized | 12 days |
| `feed:read:ids:{userId}:{scopeHash}` | SET | exact article IDs returned | 12 days |
| `feed:session:{userId}:{sessionId}` | HASH | cursors, buffer, pendingWindow | 4 hours |
| `feed:lock:{userId}:{sessionId}` | STRING | lock token | 1.5 s |
| `feed:country:{c}:topic:{t}` | ZSET | articleId → epoch-second score | managed by projector |
| `feed:country:{c}` | ZSET | articleId → epoch-second score (fallback) | managed by projector |
| `news:{articleId}` | HASH | feed-card fields (title, excerpt, …) | 10 days |

> **Score unit**: ZSET scores are Unix epoch **seconds** (set by the Redis projector).
> All V3 cursors and window bounds are also in epoch seconds.

---

## Scope Hash

Read state is scoped per `(endpointKind, sortedCountryIds, topicParam/sortedTopics, prefsVersion)`.

```
scopeHash = sha256(endpointKind:countryIdsCsv:topicParam:topicsCsv:prefsVersion)[0:16]
```

If the user follows a new topic, `prefsVersion` bumps → new `scopeHash` → fresh read state,
so old intervals never hide articles from newly followed topics.

---

## Endpoints

| Endpoint | Source ZSETs | Fallback |
|---|---|---|
| `GET /api/v3/feed` | `feed:country:{c}:topic:{t}` for each followed topic | country ZSET when topics exhausted |
| `GET /api/v3/feed/topic?topicId=X` | `feed:country:{c}:topic:X` | none |
| `GET /api/v3/feed/latest` | `feed:country:{c}` | none |

Query params (same as V2): `userId`, `sessionId?`, `limit?` (default 40, min 5, max 50).

---

## Configuration (`feed.scanner.*`)

```yaml
feed:
  scanner:
    page-size-default: 40
    window-millis: 14400          # 4 hours in epoch seconds
    per-topic-limit: 50           # ZREVRANGEBYSCORE cap per (country, topic)
    max-topics-per-request: 100
    max-windows-per-request: 12
    max-buffer-size: 400
    session-ttl-hours: 4
    read-state-ttl-days: 12
    lock-ttl-ms: 1500
    topic-weights: {}             # optional per-topic score boost
    freshness-coefficient: 0.0    # disabled by default
```

---

## Ranking

```
finalScore = rawScore (epoch-second) + topicWeight + freshnessBoost
```

With default config (all weights zero, freshness disabled) this is pure
timestamp ordering with a deterministic `articleId` tiebreak. Topic weights
and freshness boost are opt-in via `feed.scanner.topic-weights` and
`feed.scanner.freshness-coefficient`.

---

## Interval Normalization

Intervals are normalized on every load and write:

1. Drop intervals older than `now - readStateTtlDays`.
2. Sort by `startTs`.
3. Merge overlapping and touching ranges.

Example from the PRD:
```
[[7000,8000], [5000,7000], [3000,4500], [4400,5200]]
→ [[3000,8000]]
```

---

## Package Layout

```
domain/feed/v3/
  FeedScannerController.java          /api/v3/feed*
  FeedScannerPipeline.java            interface
  DefaultFeedScannerPipeline.java     orchestrator (Phases A/B/C)
  FeedScopeResolver.java              scope hash
  ReadIntervals.java                  normalize / coversRange / subtract
  FeedScannerReadStateStore.java      interface
  RedisFeedScannerReadStateStore.java intervals JSON + read IDs SET
  FeedScannerSessionStore.java        interface
  RedisFeedScannerSessionStore.java   HASH session + lock
  CandidateWindowScanner.java         interface
  RedisCandidateWindowScanner.java    ZREVRANGEBYSCORE + Java merge
  FeedCandidateRanker.java            scoring formula
  FeedScannerArticleHydrator.java     interface
  RedisPgFeedScannerArticleHydrator   delegates to V2 hydrator
  FeedScannerCommitter.java           interface
  DefaultFeedScannerCommitter.java    write IDs → merge intervals → save session
  FeedScannerMetrics.java             Micrometer counters/timers
  FeedScannerProperties.java          @ConfigurationProperties feed.scanner.*
  model/
    BuildFeedRequest.java
    EndpointKind.java
    CandidateSource.java
    FeedScannerScope.java
    FeedScannerSession.java
    Interval.java                     [startTs, endTs] JSON tuple
    Window.java
    Candidate.java
    RankedItem.java
    ReadState.java
resources/feed/v3/
  release_lock.lua                    atomic lock release (compare-and-delete)
```

---

## Metrics (`/actuator/prometheus`)

| Metric | Type | Description |
|---|---|---|
| `feed_scanner_request_latency_seconds` | Timer | End-to-end page build latency |
| `feed_scanner_new_items_injected_count_total` | Counter | Phase A items injected |
| `feed_scanner_window_scanned_count_total` | Counter | Phase C Redis scans |
| `feed_scanner_window_skipped_count_total` | Counter | Phase C interval-skips |
| `feed_scanner_window_exhausted_count_total` | Counter | Windows promoted to intervals |
| `feed_scanner_page_fill_rate` | Summary | % of requested limit returned |
| `feed_scanner_buffer_size` | Summary | Session buffer size at commit |
| `feed_scanner_read_state_interval_count` | Summary | Interval count per request |

---

## Coexistence with V1 / V2

V3 runs alongside V1 (`/api/v1/feed`) and V2 (`/api/v2/feed`) with no shared
mutable state. V3 reuses the same read-only ZSETs and the same `news:{id}` HASH
cache (warming it on PostgreSQL fallback), so both versions benefit from each
other's cache hits.
