# Feed V3 PRD

## 1. Summary

Feed V3 is a simplified feed-generation system for Redis, Spring WebFlux, and PostgreSQL.

The goal is to replace the old Feed V2 design, which depends on large per-user seen-ID filtering, heavy Lua aggregation, and complex session-anchor/injection logic.

Feed V3 uses:

```text
Topic ZSETs
+ timestamp-window scanning
+ global per-user exhausted intervals
+ global per-user exact read IDs
+ short-lived session buffer
+ Java-side ranking
+ Redis JSON MGET hydration
+ PostgreSQL fallback hydration
```

The main optimization is to avoid looping through huge seen lists. Instead of storing every seen article as the primary read-state mechanism, Feed V3 stores compact timestamp intervals that represent fully exhausted feed windows.

---

## 2. Goals

```text
Feed V3 should be:
├── fast
├── cost-effective
├── reliable
├── simple to reason about
├── safe against huge seen-list filtering
├── compatible with Redis + Spring WebFlux + PostgreSQL
└── easier to evolve than Feed V2
```

Primary goals:

1. Always return recent unread articles first.
2. Inject new articles immediately on every request.
3. Avoid filtering against a huge per-user seen list on every page.
4. Support large read gaps without expensive loops.
5. Support page filling from older unread articles.
6. Hydrate articles in batches, avoiding N+1 Redis or PostgreSQL calls.
7. Keep the implementation simpler than Feed V2.

---

## 3. Non-goals

Feed V3 does not initially handle these cases:

1. Multi-device conflict resolution.
2. Non-unique timestamps.
3. Very large follow graph beyond approximately 100 topics per user.
4. Exact client-side read receipts where only visible items are marked read.
5. Advanced recommendation-system implementation.
6. Complex distributed locking or CAS-based pagination.

Initial product assumption:

```text
Returned by server = consumed/read.
```

If later we need true read receipts, this can be added as a separate layer.

---

## 4. Assumptions

```text
- User follows max ~100 topics.
- Each article belongs to one topic.
- Each article has a unique timestamp score.
- Article TTL = 12 days.
- Returned by server means consumed/read.
- New articles should be injected immediately.
- Redis stores feed indexes and short-lived state.
- PostgreSQL remains the source of truth for article data.
```

---

## 5. Feed V2 Problems to Solve

### 5.1 Huge seen-list filtering

Feed V2 uses:

```text
seen:{userId}
```

This grows with every article returned to the user. During pagination, candidates are repeatedly filtered against this seen set.

Problem:

```text
Large read history
+ large gaps
+ repeated seen filtering
= expensive pagination
```

### 5.2 Useless seek loops

If a large block of candidates has already been seen, Feed V2 can repeatedly fetch and discard candidates until `seekMaxIterations` is reached.

This can return partial or empty pages even when unread articles exist deeper in the feed.

### 5.3 Heavy Redis Lua aggregation

Feed V2 uses Lua to:

```text
- loop through topic keys
- fetch inject candidates
- fetch scroll candidates
- apply topic weights
- sort candidates
- flatten results
```

This risks blocking Redis under load.

### 5.4 Session-anchor complexity

Feed V2 probes Redis to calculate a max score across all feed topics when creating a session.

Feed V3 removes this by using the current request timestamp as the top cursor.

### 5.5 Hydration overhead

Feed V2 stores article cache data as Redis HASHes and maps them to DTOs.

Feed V3 prefers JSON strings and batch `MGET`.

---

## 6. Feed V3 Core Design

Feed V3 uses two read-state structures.

### 6.1 Exhausted read intervals

```text
feed:read:intervals:{userId}:{scopeHash}
```

Meaning:

```text
The server fully scanned and exhausted these timestamp ranges.
```

Example:

```json
[
  [1000, 5000],
  [8000, 12000]
]
```

If the user later requests a page, the scanner can skip these ranges directly.

### 6.2 Exact read IDs

```text
feed:read:ids:{userId}:{scopeHash}
```

Meaning:

```text
Articles returned to the user but not yet safely compressible into an interval.
```

This protects against hiding unread articles when only part of a timestamp window was served.

### 6.3 Why both are needed

Intervals are fast but only safe when a full timestamp window was exhausted.

Exact IDs are safe for partial windows.

```text
Intervals = fast skip
Exact IDs = safety
```

---

## 7. Redis Schema

### 7.1 Topic feed

```text
feed:country:{countryId}:topic:{topicId}
```

Type:

```text
ZSET
```

Score:

```text
article timestamp
```

Member:

```text
articleId
```

### 7.2 Latest country feed

```text
feed:country:{countryId}
```

Type:

```text
ZSET
```

Score:

```text
article timestamp
```

Member:

```text
articleId
```

### 7.3 Article cache

```text
article:{articleId}
```

Type:

```text
STRING JSON
```

TTL:

```text
12 days
```

Hydration should use:

```text
MGET article:{id1} article:{id2} ... article:{idN}
```

### 7.4 User read intervals

```text
feed:read:intervals:{userId}:{scopeHash}
```

Type:

```text
STRING JSON
```

Value:

```json
[[startTs, endTs], [startTs, endTs]]
```

TTL:

```text
12 days
```

### 7.5 User exact read IDs

```text
feed:read:ids:{userId}:{scopeHash}
```

Type:

```text
SET
```

TTL:

```text
12 days
```

### 7.6 Session

```text
feed:session:{userId}:{sessionId}
```

Type:

```text
HASH or JSON string
```

Fields:

```text
scopeHash
newestCursor
olderCursor
pendingWindowStart
pendingWindowEnd
bufferIds
createdAt
updatedAt
```

TTL:

```text
1-4 hours
```

---

## 8. Scope Hash

Read state should be tied to a scope.

```text
scopeHash = hash(endpointKind, countryIds, topics or topicId, userPrefsVersion)
```

Examples:

```text
personalized:country=0:topicsVersion=17
topic:country=0:topic=tech
latest:country=0
```

Why this matters:

If a user follows a new topic, old read intervals should not hide articles from the newly followed topic.

---

## 9. Feed State Model

Feed generation can be treated as a state transition problem.

### 9.1 State

```text
S = {
  readIntervals,
  readIds,
  newestCursor,
  olderCursor,
  pendingBuffer
}
```

### 9.2 Decision

At each request:

```text
Choose the best next unread articles.
```

### 9.3 Transition

After serving a page:

```text
S -> S'
```

Where:

```text
readIds += returnedIds
readIntervals += exhaustedWindows
newestCursor = now
olderCursor moves down
pendingBuffer shrinks or is refilled
```

### 9.4 Optimization goal

```text
Return pageSize articles with minimum Redis and PostgreSQL work.
```

---

## 10. High-level Request Flow

```text
Request page
├── Build scopeHash
├── Load or create session
├── Load read intervals
├── Normalize read intervals
│   ├── remove expired intervals
│   ├── merge overlapping intervals
│   └── merge touching intervals
│
├── Phase A: check new articles
│   ├── scan from session.newestCursor to now
│   ├── inject new unread articles immediately
│   └── add candidates first
│
├── Phase B: drain session buffer
│   ├── use leftover candidates from previous scan window
│   └── avoid rescanning dense windows
│
├── Phase C: scan older articles
│   ├── scan below session.olderCursor
│   ├── skip exhausted intervals
│   ├── fetch candidates from max 100 topic ZSETs
│   ├── apply formula in Java
│   └── fill remaining page slots
│
├── Batch hydrate article IDs
│   ├── Redis MGET first
│   └── PostgreSQL fallback for misses
│
├── Commit read state
│   ├── add returned IDs to readIds
│   ├── add exhausted windows to readIntervals
│   ├── merge intervals
│   └── update session cursors/buffer
│
└── Return page + sessionId + nextCursor
```

---

## 11. Candidate Fetching

Since each user follows at most approximately 100 topics, Feed V3 can fetch from topic ZSETs directly.

For each topic:

```text
ZREVRANGEBYSCORE topicKey maxTs minTs LIMIT 0 perTopicLimit
```

Then Java/WebFlux handles:

```text
- merging
- read interval filtering
- exact read ID filtering
- formula scoring
- sorting
- diversity limits if needed
```

Redis should fetch raw candidates only.

No heavy Lua aggregation is required.

---

## 12. Ranking Formula

Feed V3 applies ranking in Java.

Example:

```text
finalScore =
  timestampScore
  + topicWeight
  + recommendationWeight
  + freshnessBoost
```

Rules:

```text
- Newer items should usually win.
- Followed topics should be prioritized.
- Recommendation items can be mixed in later.
- Optional diversity caps can prevent one topic from dominating.
```

The recommendation system itself is not part of this PRD.

---

## 13. Window Scanning

Feed V3 scans by timestamp windows.

Example:

```text
scan 12000 -> 11500
```

If the server fully processes the window, it can store:

```text
read_intervals += [11500, 12000]
```

If the page fills before the window is fully consumed:

```text
- store leftovers in session buffer
- store returned IDs in read_ids
- do not mark the full window exhausted yet
```

When the buffer is fully drained, the window can become an exhausted interval.

---

## 14. Session Buffer

The session buffer avoids rescanning dense windows.

Example:

```text
Window 12000 -> 11900 contains 500 candidates.
Page size = 40.
```

Feed V3 returns 40 and stores the remaining candidates:

```text
bufferIds = remaining candidate IDs
pendingWindow = [11900, 12000]
```

Next request:

```text
1. check new articles first
2. then drain buffer
3. then scan older windows if needed
```

This keeps immediate new-item injection while avoiding repeated scans.

---

## 15. Read-state Commit Rules

### 15.1 Safe interval rule

Only create an interval when the full timestamp window was exhausted.

Safe:

```text
Scanned 12000 -> 11500
No remaining unread eligible candidates in that range
Add [11500, 12000]
```

Unsafe:

```text
Returned 40 from a dense window of 500 candidates
Do not add [11900, 12000]
```

### 15.2 Exact ID rule

Every returned article ID is added to:

```text
feed:read:ids:{userId}:{scopeHash}
```

When a pending window is fully exhausted and converted into an interval, exact IDs inside that window can be removed later as an optimization.

---

## 16. Interval Normalization

Whenever intervals are loaded or updated:

```text
Normalize intervals
├── remove intervals older than 12 days
├── sort by start timestamp
├── merge overlapping intervals
└── merge touching intervals
```

Example:

```text
Before:
[7000, 8000]
[5000, 7000]
[3000, 4500]
[4400, 5200]

After:
[3000, 8000]
```

This keeps filtering cheap.

---

## 17. Hydration

### 17.1 Redis first

Use batch JSON fetch:

```text
MGET article:{id1} article:{id2} ... article:{idN}
```

### 17.2 PostgreSQL fallback

For cache misses:

```sql
SELECT * FROM articles WHERE id IN (...)
```

Then cache results:

```text
SET article:{articleId} json EX 12days
```

### 17.3 Preserve order

Hydration should return items in feed order.

Implementation:

```text
1. Build Map<articleId, ArticleCardDto>
2. Iterate original ranked IDs
3. Append existing hydrated DTOs in that order
```

### 17.4 Missing articles

If an article is missing or deleted:

```text
- remove it from the response
- optionally cleanup from Redis ZSET lazily
- fetch more candidates if needed
```

---

## 18. TTL and Cleanup

### 18.1 TTL window

```text
minValidTs = now - 12 days
```

### 18.2 Read intervals

Remove interval data older than `minValidTs`.

### 18.3 Exact read IDs

Use Redis key TTL of 12 days.

### 18.4 Article cache

Use Redis key TTL of 12 days.

### 18.5 Topic ZSET cleanup

Scheduled cleanup:

```text
ZREMRANGEBYSCORE feed:country:{country}:topic:{topic} -inf minValidTs
ZREMRANGEBYSCORE feed:country:{country} -inf minValidTs
```

---

## 19. Endpoint Behavior

### 19.1 Personalized feed

Endpoint:

```text
/api/v3/feed
```

Source:

```text
user followed topics
```

Fallback:

```text
country latest feed, if followed topics are empty or exhausted
```

### 19.2 Topic feed

Endpoint:

```text
/api/v3/feed/topic
```

Source:

```text
specific topic ZSET
```

Fallback:

```text
none
```

### 19.3 Latest feed

Endpoint:

```text
/api/v3/feed/latest
```

Source:

```text
country latest feed
```

Fallback:

```text
none
```

---

## 20. Components

### 20.1 FeedV3Controller

Responsibilities:

```text
- expose v3 endpoints
- validate request
- call FeedV3Pipeline
```

### 20.2 FeedV3Pipeline

Responsibilities:

```text
- build scope
- load session
- load read state
- call page builder
- hydrate articles
- commit state
- return response
```

### 20.3 FeedScopeResolver

Responsibilities:

```text
- resolve endpoint kind
- resolve country IDs
- resolve topic IDs
- build scopeHash
```

### 20.4 RedisFeedSessionStore

Responsibilities:

```text
- create session
- load session
- save cursors
- save pending buffer
- expire session
```

### 20.5 RedisReadStateStore

Responsibilities:

```text
- load intervals
- normalize intervals
- check timestamp against intervals
- check exact read IDs
- add returned IDs
- add exhausted intervals
```

### 20.6 RedisCandidateWindowScanner

Responsibilities:

```text
- fetch raw candidates from Redis ZSETs by timestamp window
- support topic feed, latest feed, and personalized topic groups
```

### 20.7 FeedCandidateRanker

Responsibilities:

```text
- apply formula
- sort candidates
- optionally enforce diversity rules
```

### 20.8 ArticleJsonHydrator

Responsibilities:

```text
- MGET Redis article JSON
- fallback to PostgreSQL
- cache misses
- preserve feed order
```

### 20.9 FeedCommitter

Responsibilities:

```text
- write read IDs
- write exhausted intervals
- update session buffer
- update cursors
- refresh TTLs
```

---

## 21. Implementation Phases

### Phase 1: Read state

Implement:

```text
- interval model
- interval normalization
- interval merge
- TTL cleanup
- exact read ID store
- unit tests
```

Goal:

```text
Prove the system can skip large read gaps without a huge seen-ID scan.
```

### Phase 2: Candidate scanner

Implement:

```text
- Redis ZSET window scan
- max 100 topic support
- reactive fetch per topic
- Java merge
- no Lua aggregation
```

Goal:

```text
Fetch candidates without aggregate.lua.
```

### Phase 3: Page builder

Implement:

```text
- new item phase
- buffer drain phase
- older scan phase
- ranking
- read filtering
- page fill logic
```

Goal:

```text
Return correct pages with immediate new item injection.
```

### Phase 4: Hydration

Implement:

```text
- Redis JSON MGET
- PostgreSQL fallback
- Redis cache refill
- order preservation
```

Goal:

```text
Remove N+1 hydration.
```

### Phase 5: Commit logic

Implement:

```text
- add returned IDs
- add exhausted intervals
- merge intervals
- update cursors
- save buffer
- expire keys
```

Goal:

```text
Make pagination state reliable and compact.
```

### Phase 6: Migration

Run Feed V3 behind a feature flag.

Compare:

```text
- latency
- Redis commands per request
- page fill rate
- duplicate rate
- PostgreSQL fallback rate
- Redis memory usage
- request error rate
```

---

## 22. Metrics

Track:

```text
feed.v3.request.latency
feed.v3.redis.commands_per_request
feed.v3.redis.read_state.interval_count
feed.v3.redis.read_ids.count
feed.v3.page.fill_rate
feed.v3.page.duplicate_count
feed.v3.hydration.redis_hit_rate
feed.v3.hydration.pg_fallback_count
feed.v3.window.scanned_count
feed.v3.window.exhausted_count
feed.v3.buffer.size
feed.v3.new_items.injected_count
```

---

## 23. Risks and Mitigations

### Risk: exact read IDs grow too large

Mitigation:

```text
- TTL = 12 days
- convert dense windows into intervals when exhausted
- monitor read_ids count
```

### Risk: interval list grows too large

Mitigation:

```text
- normalize on load/write
- merge touching intervals
- remove expired intervals
- optionally bucket by day later
```

### Risk: dense windows create large buffers

Mitigation:

```text
- cap buffer size
- use smaller windows for dense topics
- continue scanning in next request
```

### Risk: sparse feeds require large scans

Mitigation:

```text
- adaptive window expansion
- stop at 12-day lower bound
- use country latest fallback for personalized feed
```

### Risk: formula changes hide or reveal different items

Mitigation:

```text
- include userPrefsVersion and feed definition in scopeHash
- bump scope version for major formula changes if needed
```

---

## 24. Removed Feed V2 Complexity

Feed V3 removes or avoids:

```text
- aggregate.lua heavy sorting
- zmscore.lua seen filtering
- seen_mark.lua giant seen writes
- sessionAnchor top-score probing
- inject bucket budget complexity
- seekMaxIterations dependency
- Redis HASH DTO conversion
```

---

## 25. Final Target Architecture

```text
FeedV3Controller
└── FeedV3Pipeline
    ├── FeedScopeResolver
    ├── RedisFeedSessionStore
    ├── RedisReadStateStore
    ├── RedisCandidateWindowScanner
    ├── FeedCandidateRanker
    ├── ArticleJsonHydrator
    └── FeedCommitter
```

---

## 26. Final Design Statement

Feed V3 is a timestamp-window feed scanner that uses compact exhausted intervals, exact read IDs for safety, a short-lived session buffer for dense windows, Java-side ranking, and batch JSON hydration.

It keeps the useful parts of Feed V2 while removing the Lua-heavy and seen-ID-heavy logic that makes pagination expensive under large read histories and large read gaps.
