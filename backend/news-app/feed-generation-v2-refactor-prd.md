# PRD: Feed Generation Refactor v2

**Status:** Proposed for implementation
**Replaces:** Feed Generation v1 and supersedes the earlier v2 draft
**Owner:** Backend / Feed Platform
**Last updated:** 2026-05-13

---

## 1. Executive Summary

This PRD defines a simpler, safer, and cheaper refactor of the feed generation logic for a topic-based news feed.

The design keeps the strongest ideas from the prior draft:
- **session-scoped anchor** for "what existed when the session started"
- **monotonic scroll cursor** for downward continuation
- **server-side seen tracking** to eliminate the read-gap class of bugs
- **Redis-side topic aggregation** to avoid N round-trips per request

It intentionally changes four parts of the earlier draft:
1. **Guarantees are made honest.** We do not claim mathematically zero duplicates or zero stranded articles when using probabilistic seen-memory.
2. **Session semantics are made stricter.** A session is valid only for one feed scope (endpoint + country + topic selection + preference version).
3. **Concurrency is handled explicitly.** Only one page-build runs at a time per session.
4. **Bloom rotation is removed from v2.** It adds complexity and weakens operational safety. v2 uses one generously-sized Bloom filter per active user, plus saturation monitoring.

The resulting design aims for:
- **Fast common-case reads**
- **Stable pagination**
- **Low Redis round-trips relative to topic count**
- **Low per-user seen-state memory**
- **Simple debugging and production observability**

This PRD solves the problem in small sub-problems, each with an explicit invariant.

---

## 2. Product Goals

### 2.1 Primary Goals

- **G1**: Eliminate the read-gap failure mode caused by representing read state as a contiguous range.
- **G2**: Keep the feed topic-based and country-aware.
- **G3**: Show new arrivals during a session without forcing the user to restart pagination.
- **G4**: Keep the common request path cheap and fast.
- **G5**: Reduce per-user memory versus an exact Redis SET of all viewed article IDs.
- **G6**: Support graceful fallback when followed topics are exhausted.
- **G7**: Keep the logic understandable by backend engineers and debuggable in production.

### 2.2 Secondary Goals

- **S1**: Prepare for future topic weighting without changing cursor semantics.
- **S2**: Allow safe migration from v1 with a feature flag.
- **S3**: Avoid adding new always-on background jobs.

### 2.3 Non-Goals

- Hot-shard mitigation across countries or regions
- Real-time push delivery
- Building a full recommendation system
- Story-cluster deduplication across publishers (left as v3 extension)
- Per-user materialized feed timelines

---

## 3. What Was Kept, What Was Changed

### 3.1 Kept from the earlier v2 draft

The previous draft correctly identified the core architectural problems and the value of `sessionAnchor`, `scrollCursor`, server-side seen updates, Lua aggregation, topic fallback, and future topic weights. It also correctly identified read-gap, ghost-page risk, topic fan-out cost, and hydration mismatch as major concerns. See the earlier draft’s goals, state model, request flow, and component split. fileciteturn3file1 fileciteturn3file2

### 3.2 Changed in this PRD

This refactor changes the earlier draft in the following ways:

- **No absolute correctness claims.** The earlier draft claimed zero duplicates and zero stranded articles while also using a Bloom filter with non-zero false-positive rate. That claim is removed. We target elimination of the structural read-gap bug, not mathematical perfection under probabilistic filtering. fileciteturn3file0turn3file3
- **No Bloom rotation in v2.** The earlier draft proposed filter rotation as part of the base release. This PRD removes it to reduce operational complexity. Saturation is monitored; rotation is deferred to v3 unless data proves it is urgently needed. fileciteturn3file3turn3file4
- **Session scope is explicit.** Sessions are bound to a feed scope fingerprint; reusing a session across `/feed`, `/feed/topic`, and `/feed/latest` is not allowed.
- **Client cursor is deprecated.** The server-owned session cursor is the source of truth. The request may still accept `cursor` for backward compatibility, but it is advisory only.
- **Per-session request serialization is explicit.** This prevents overlapping page-builds for the same session.
- **Inject is capped per page.** This prevents permanent starvation of downward scroll when many new articles arrive.
- **Inject is fetched once per page-build.** Seek iterations fetch more scroll only, not the same inject window repeatedly.
- **Session TTL is reduced.** The earlier draft kept full session state for 7 days. v2 stores session state only as long as it is useful for resuming an active reading session.

---

## 4. Core Design Principles

### P1. Split the problem into independent sub-problems

The feed pipeline is deliberately broken into separate concerns:
1. **Scope selection**
2. **Session state**
3. **Candidate retrieval**
4. **Seen suppression**
5. **Page fill**
6. **Hydration**
7. **Writeback**
8. **Fallback**
9. **Observability**

Each concern has its own invariant.

### P2. The server owns pagination state

This feed is not a stateless public timeline. It is personalized and session-based. The server therefore owns:
- the authoritative scroll cursor
- the authoritative session anchor
- the seen-memory write path

The client should not be trusted to define position.

### P3. Cursor semantics must stay chronological even if ranking changes later

Any future topic weighting may change local ordering of candidates, but it must never redefine the meaning of the cursor. The cursor is a position in the raw time-ordered feed, not in the ranked list.

### P4. Simpler beats clever

If two options are close in performance, choose the one that is easier to reason about in production.

---

## 5. Problem Decomposition and Solution

## 5.1 Sub-problem A — Feed Scope

### Problem
A single user can request different feed surfaces:
- personalized feed (`/feed`)
- single-topic feed (`/feed/topic?topicId=x`)
- latest country feed (`/feed/latest`)

If the same session state is reused across those surfaces, cursor and anchor semantics break.

### Solution
Define a **scope fingerprint**:

```
scopeFingerprint = hash(
  endpointKind,
  countryId,
  topicParamOrNull,
  userPrefVersion,
  weightConfigVersion
)
```

A session is valid only if its stored scope fingerprint matches the current request.

### Invariant
**I-A1:** One session maps to exactly one feed scope.

### Why this matters
This solves hidden edge cases:
- user changes followed topics mid-session
- user changes country mid-session
- client reuses an old sessionId on a different endpoint
- future weight changes alter ranking universe

---

## 5.2 Sub-problem B — Session State

### Problem
We need to represent both:
- new arrivals since session start
- downward continuation in older content

A single cursor cannot represent both safely.

### Solution
Each session stores:

```
session:{user:42}:{sessionId} -> Hash {
  userId
  scopeFingerprint
  endpointKind
  countryId
  topicParam
  sessionAnchor   (microsecond epoch)
  scrollCursor    (microsecond epoch)
  createdAt
  lastAccessAt
}
TTL: 12 hours
```

- `sessionAnchor`: immutable for the lifetime of the session
- `scrollCursor`: mutable, monotonic downward

**Idle expiration threshold:** 4 hours  
**Storage TTL:** 12 hours  
This is enough to resume realistic sessions without paying 7-day storage cost.

### Session creation rules

If request has no sessionId, or session is missing, expired, locked to another scope, or belongs to another user:
- create a new session

Session creation computes:
- **personalized feed:** `sessionAnchor = max raw score across followed topic keys`
- **single-topic feed:** `sessionAnchor = max raw score in that topic key`
- **latest feed:** `sessionAnchor = max raw score in fallback key`
- `scrollCursor = +∞`

### Invariants
- **I-B1:** `sessionAnchor` never changes within a session.
- **I-B2:** `scrollCursor` only moves downward.
- **I-B3:** `scrollCursor` changes only after a page is successfully built.
- **I-B4:** Session creation uses the feed universe for that endpoint, not a different one.

---

## 5.3 Sub-problem C — Seen Memory

### Problem
The old exact Redis SET is expensive. But a probabilistic filter introduces false positives.

### Design options considered

#### Option 1 — Exact Redis SET
- Correct
- Easy to reason about
- Too expensive in memory at scale

#### Option 2 — Bloom filter only
- Cheap
- Fast batch membership
- False positives exist
- Simpler than rotating versions

#### Option 3 — Bloom rotation in v2
- More complex
- More operational surface area
- Harder to test and debug

### Chosen solution
Use **one Bloom filter per active user** in v2.

```
bf:{user:42}:viewed
capacity = configured from measured percentile of 12-day traffic
error_rate = 0.01
TTL = 12 days rolling
```

The server writes viewed IDs after a page is assembled.

### Important honesty rule
This reduces memory sharply, but it does **not** guarantee zero false positives. Therefore:
- the design eliminates the structural read-gap bug
- the design does **not** guarantee mathematically zero skipped unseen articles

### Why this is still acceptable
For a fast-moving news feed, a low false-positive rate is usually a better trade than large exact per-user memory.

### Invariants
- **I-C1:** Seen memory is user-wide, not session-wide.
- **I-C2:** Seen memory survives session expiration.
- **I-C3:** Only returned article IDs are marked seen.
- **I-C4:** If seen-memory write fails, the page request fails; we do not silently return a page without consistency writeback.

### Deferred work
Bloom saturation management and rotation are observed in v2, not implemented by default.

---

## 5.4 Sub-problem D — Candidate Retrieval

### Problem
We need topic-based retrieval that is:
- low round-trip
- deduped
- compatible with future weights
- bounded in work even for many topics

### Chosen solution
Use one Redis Lua script to aggregate from topic ZSETs.

Keys:
```
feed:{country:1}:topic:tech
feed:{country:1}:topic:finance
...
feed:{country:1}:fallback
```

Scores are **microsecond timestamps** written by the ingestion pipeline.

### Important change from earlier draft
Inject is retrieved **once per page-build**, not on every seek iteration.

### Candidate buckets

#### INJECT bucket
Articles with:
```
rawScore > sessionAnchor
```

These are new arrivals since session start.

#### SCROLL bucket
Articles with:
```
rawScore < seekCursor
```

Where `seekCursor` starts as the stored `scrollCursor` and may move lower temporarily during the page-build.

### Per-page inject cap
To prevent scroll starvation during high-ingestion periods:

```
injectPageMax = min(configured value, floor(limit / 2))
```

Default recommendation: `injectPageMax = 5` when `limit = 20`

This means new arrivals are always shown first, but not allowed to consume the entire page indefinitely.

### Per-topic candidate caps
To prevent dominant-topic flood:

- `injectPerTopic = 3`
- `scrollPerTopic = 12`

These are starting points, not fixed truths.

### Dedup rule
Dedup by `articleId` inside Lua using this priority:
1. higher raw score
2. if tied, higher adjusted score
3. if tied, stable topic order

We do **not** use “first encountered by key order” as the semantic dedup policy.

### Topic cap
To bound Lua work:
- `maxTopicsPerRequest = 64`
- if user follows more, use the highest-weighted 64
- if equal weights, use stable deterministic order

This is a performance safeguard, not a product ideal.

### Weighting formula (future-ready, disabled by default)

```
adjustedScore = rawScore + log(topicWeight) * weightScale
```

- `weightScale = 0` in v2 launch
- raw score remains the only value used for cursor semantics

### Invariants
- **I-D1:** All feed keys inside one Lua call share the same country hash tag.
- **I-D2:** Inject and scroll are always kept logically separate.
- **I-D3:** Dedup happens before candidates leave Redis.
- **I-D4:** Raw score, not adjusted score, drives cursor movement.

---

## 5.5 Sub-problem E — Page Fill / Seek Loop

### Problem
The first candidate batch may not contain enough unseen hydrated articles, especially for heavy readers.

### Chosen solution
Use a bounded seek loop.

Algorithm:
1. Fetch inject once + first scroll slice
2. Bloom-check candidates
3. Hydrate in rank order until page fills or candidates run out
4. If page still underfilled, move a **temporary** `seekCursor` lower and fetch more scroll only
5. Repeat up to `seekMaxIterations`
6. If still underfilled, activate fallback

### Key design detail
The stored session `scrollCursor` is **not** mutated during the seek loop.  
Only the temporary `seekCursor` changes.

### Recommended defaults
- `seekMaxIterations = 4`
- `scrollBatchMultiplier = 1.5`

### Invariants
- **I-E1:** Seek loops never change stored session state.
- **I-E2:** Inject is not re-fetched within the same page-build.
- **I-E3:** `hasMore = false` only when primary and fallback both exhaust after seek.

---

## 5.6 Sub-problem F — Fallback

### Problem
A user can exhaust followed topics.

### Chosen solution
The pipeline maintains a country-wide fallback ZSET:

```
feed:{country:1}:fallback
```

Fallback is used only when primary topic retrieval cannot fill the page after seek.

### Fallback semantics
Fallback is not hidden. Each response declares:
- `source = primary | fallback | mixed`

The client may show:
- “You’re caught up on your topics — here’s more from your country.”

### Important simplification
Fallback does **not** need its own sessionAnchor semantics for v2. It is treated as fill content below the current reading point, not as a second independent feed universe.

This keeps the model simple.

### Invariants
- **I-F1:** Fallback is a fill path, not a second primary feed.
- **I-F2:** Fallback candidates are also passed through seen-memory.
- **I-F3:** Fallback never changes the meaning of the session anchor.

---

## 5.7 Sub-problem G — Hydration

### Problem
Redis may contain feed IDs whose `news:{id}` hash is missing.

### Chosen solution
Hydration flow:
1. batched/pipelined `HGETALL news:{id}` for selected candidates
2. for missing hashes, query Postgres by articleId
3. if found, re-warm Redis hash with correct TTL
4. if still missing, skip the article and continue filling

### TTL contract
- feed ZSET entries: 7 days
- news hashes: 10 days minimum

Hydration fallback rate above threshold indicates ingestion/TTL drift.

### Invariants
- **I-G1:** Missing Redis hashes do not fail the whole page.
- **I-G2:** Missing Redis + missing Postgres article is skipped, logged, and counted.
- **I-G3:** Hydration keeps raw candidate score attached to DTO.

---

## 5.8 Sub-problem H — Writeback and Concurrency

### Problem
Parallel requests for the same session can produce overlapping pages.

### Chosen solution
Use a short-lived **per-session build lock**.

```
lock:{user:42}:{sessionId}
SET NX PX 1500
```

A page-build must hold the lock from candidate generation through seen writeback and cursor update.

### Behavior on conflict
If another request is already building a page for the same session:
- return `409 FEED_REQUEST_IN_PROGRESS` with a retryable error code
- client retries after a short backoff

This is simpler and safer than trying to merge concurrent in-flight page-builds.

### Successful writeback order
After page payload is finalized:
1. add returned article IDs to seen-memory
2. update stored `scrollCursor` if the page contained scroll items
3. update `lastAccessAt`
4. release the lock

### Cursor update rule
`scrollCursor` is updated using:

```
min(rawScore among served scroll items only)
```

If a page contains only inject items:
- do not move `scrollCursor`

### Invariants
- **I-H1:** Only one page-build can run per session at a time.
- **I-H2:** `scrollCursor` never advances upward.
- **I-H3:** Inject-only pages do not move the scroll cursor.
- **I-H4:** A page is never returned without a successful seen-memory write.

---

## 6. End-to-End Request Flow

### 6.1 Request

```
GET /api/v1/feed?sessionId={optional}&limit={optional}&cursor={deprecated}
```

### 6.2 Response

```json
{
  "articles": [/* ArticleCardDto[] */],
  "sessionId": "...",
  "sessionAnchor": 1714032456000000,
  "nextScrollCursor": 1714032000000123,
  "source": "primary | fallback | mixed",
  "hasMore": true,
  "newSinceLastSession": 7,
  "warnings": []
}
```

### 6.3 Flow

1. **Resolve scope** from endpoint + country + topic param + pref version
2. **Load or create session** for that scope
3. **Acquire per-session lock**
4. **Load topics and weights** (personalized endpoint only)
5. **Run Lua aggregation** for:
   - inject once
   - first scroll slice
6. **Bloom-check candidates**
7. **Hydrate until page fills or candidates run out**
8. **Seek deeper scroll** if needed
9. **Fallback** if needed
10. **Finalize page**
11. **Seen-memory writeback**
12. **Update cursor if scroll items were served**
13. **Release lock**
14. **Return page**

---

## 7. API Contract

### 7.1 Endpoints

Unchanged:
- `GET /api/v1/feed`
- `GET /api/v1/feed/topic?topicId=X`
- `GET /api/v1/feed/latest`

Deprecated:
- `POST /api/v1/feed/views`

The earlier draft’s argument for server-side seen writes remains correct and is retained here. fileciteturn3file2

### 7.2 Request parameters

| Param | Status | Notes |
|---|---|---|
| `sessionId` | active | Required after first response |
| `limit` | active | clamped to `[5, 50]` |
| `cursor` | deprecated | ignored when a valid session exists |

### 7.3 Backward compatibility

For one migration window:
- accept `cursor`
- accept old clients without `sessionId`
- create a new session when absent

---

## 8. Data Model

### 8.1 Redis keys

```text
session:{user:42}:{sessionId}           Hash
lock:{user:42}:{sessionId}              String (short TTL)
user:{userId}:topics                    Hash(topic -> weight)
user:{userId}:topicPrefsVersion         String/Int
user:{userId}:feedMeta                  Hash(lastSessionAnchor, lastSeenAt)
bf:{user:42}:viewed                     Bloom filter
feed:{country:1}:topic:tech             ZSET(articleId -> microsecond_score)
feed:{country:1}:fallback               ZSET(articleId -> microsecond_score)
news:{articleId}                        Hash(article fields)
```

### 8.2 Cluster requirements

- All keys used in one Lua aggregation call must share the same country hash tag.
- User/session keys and seen-memory share the user hash tag.
- We do not attempt to access user keys and feed keys inside the same Lua script.

---

## 9. Performance Expectations

### 9.1 Honest common-case path

Typical common-case personalized request:
1. session read
2. lock acquire
3. Lua aggregation
4. Bloom batch check
5. Redis hash pipeline hydration
6. seen writeback + session update

This is usually **5–6 Redis interactions**, not “4 regardless of topic count”. The previous draft’s round-trip claim is therefore replaced by a more honest target. fileciteturn3file0turn3file3

### 9.2 Expected fast path

Expected p50 conditions:
- 1 Lua call
- 1 Bloom check
- no fallback
- no Postgres hydration
- no lock contention

### 9.3 Expected slow path

Slow path is triggered by one or more of:
- many seen candidates
- multiple seek iterations
- fallback usage
- hydration misses to Postgres
- lock contention retries

### 9.4 Targets

| Metric | Target |
|---|---|
| p50 latency | < 60 ms server-side |
| p95 latency | < 150 ms |
| p99 latency | < 250 ms |
| common-case Redis interactions | 5–6 |
| extra Redis interactions per seek iteration | +2 max |
| Lua execution p99 | < 10 ms |
| Postgres fallback rate | < 1% sustained |
| empty-page rate | < 0.1% |

---

## 10. Edge Cases and Expected Behavior

This section intentionally brainstorms both known and newly discovered edge cases.

### E1. Read gap across sessions
**Expected:** solved structurally by session anchor + downward cursor + user-wide seen-memory.

### E2. New articles arrive mid-session
**Expected:** surfaced in inject bucket, up to page cap, before scroll continuation.

### E3. Flood of new arrivals
**Expected:** inject is capped per page so old scroll is not starved forever.

### E4. Heavy reader sees mostly-seen candidates
**Expected:** seek loop deepens scroll window until enough unseen or exhaustion.

### E5. Personalized topics exhausted
**Expected:** fallback activates and response `source` becomes `fallback` or `mixed`.

### E6. Same article in two followed topics
**Expected:** dedup in Lua before network return.

### E7. Topic A dominates recent volume
**Expected:** per-topic caps prevent total page takeover.

### E8. Topic list changed while client kept old sessionId
**Expected:** scope fingerprint mismatch creates a new session.

### E9. Country changed mid-session
**Expected:** new scope, new session.

### E10. Client reuses a personalized session on `/feed/latest`
**Expected:** session rejected for scope mismatch; new session created.

### E11. Client sends stale cursor higher or lower than stored cursor
**Expected:** ignored when session exists; server state wins.

### E12. Session expired while app is open
**Expected:** next request creates a new session; seen-memory persists.

### E13. Exact duplicate page request sent in parallel
**Expected:** one request acquires lock; second gets retryable conflict.

### E14. Duplicate request sent after response timeout but before client receives it
**Expected:** if first request completed and marked seen, retry returns next consistent page semantics, not necessarily identical payload. This is acceptable under “served = seen”.

### E15. Inject-only page
**Expected:** scroll cursor does not move.

### E16. No topics configured for user
**Expected:** default to `world` or fallback-only policy based on product config.

### E17. More than 64 followed topics
**Expected:** highest-weighted 64 are used; metric emitted.

### E18. Redis hash missing, Postgres present
**Expected:** hydrate from Postgres and re-warm Redis.

### E19. Redis hash and Postgres row both missing
**Expected:** skip article, continue filling.

### E20. Feed ZSET empty for the country
**Expected:** return empty page with `hasMore=false`.

### E21. Microsecond tie still occurs
**Expected:** stable secondary sort by articleId if necessary in app layer; investigate ingestion timestamp uniqueness.

### E22. Bloom false positive on unseen article
**Expected:** article may be skipped. Metric and offline audit estimate practical rate.

### E23. Bloom near saturation
**Expected:** request still works; metric and alert fire. No in-band rotation in v2.

### E24. Seen writeback fails after page built
**Expected:** request fails; client retries. We do not return an uncommitted page.

### E25. Cursor update fails after seen writeback
**Expected:** request fails and is retried. If partial write occurred, later reads remain safe because seen-memory prevents duplicates; alert and metric emitted.

### E26. Lock key leaked by crash
**Expected:** short TTL unlocks automatically.

### E27. Redis restart loses Lua SHA
**Expected:** app reloads script on `NOSCRIPT` and retries once.

### E28. User opens app on two devices
**Expected:** separate sessions are allowed; seen-memory remains shared at user level.

### E29. Article deleted after being ranked but before hydration
**Expected:** skip safely.

### E30. Pipeline clock skew
**Expected:** small inject anomalies possible; acceptable and observable.

---

## 11. Test Plan

## 11.1 Unit tests

### Session tests
- create session with correct endpoint-specific anchor
- session scope mismatch creates new session
- session idle threshold creates new session
- scroll cursor only moves downward
- inject-only page does not move cursor

### Lua tests
- inject and scroll obey strict boundaries
- dedup keeps best candidate by score rule
- per-topic caps work
- inject and scroll order are stable
- weight scale zero preserves pure time order

### Seen-memory tests
- create Bloom on first use
- membership check matches adds
- saturation metric emitted near threshold
- false-positive rate within configured envelope

### Hydration tests
- full Redis success
- Redis miss with Postgres fallback
- both missing
- score preserved on DTO

### Lock tests
- one session lock holder only
- TTL expiry releases orphaned lock

## 11.2 Integration tests

- first page fresh user
- multiple pages no new arrivals
- new arrivals mid-session
- read-gap across sessions
- topic exhaustion to fallback
- flood of inject items with per-page cap
- many topics with bounded Lua time
- stale session on changed prefs
- concurrent requests same session
- missing hashes with re-warm
- empty country feed

## 11.3 Load tests

- 10k RPS mixed user base
- 1k sequential pages one heavy user
- 100 RPS users with 64 topics each
- 95% seen-rate stress test
- Postgres fallback spike drill

---

## 12. Observability

### Metrics

```text
feed.request.count
feed.request.duration
feed.session.created
feed.session.resumed
feed.session.scope_mismatch
feed.lock.conflict
feed.lua.duration
feed.lua.candidates_returned
feed.bloom.check.duration
feed.bloom.filtered.count
feed.bloom.saturation_ratio
feed.seek.iterations
feed.fallback.triggered
feed.hydration.redis_miss
feed.hydration.postgres_fallback
feed.empty_page
feed.inject.count
feed.scroll.count
feed.topics.truncated
```

### Structured logs

Log at `INFO` or sampled `WARN` for:
- empty pages
- lock conflicts above threshold
- high seek iterations
- saturation above threshold
- Postgres fallback
- scope mismatch session resets

### Dashboards

- latency breakdown by step
- lock conflict rate
- seek iteration distribution
- bloom saturation distribution
- fallback rate by country and endpoint
- hydration fallback rate

---

## 13. Migration Plan

### Phase 1 — Infrastructure
- ensure country fallback ZSET exists in pipeline
- ensure microsecond timestamps end-to-end
- confirm news-hash TTL > ZSET TTL

### Phase 2 — Code behind feature flag
- implement session scope fingerprint
- implement lock
- implement Lua aggregation changes
- implement server-owned cursor semantics
- implement Bloom filter path

### Phase 3 — Controlled rollout
- 1% → 10% → 25% → 50% → 100%
- compare with v1 on:
  - latency
  - empty page rate
  - duplicate complaints
  - fallback rate
  - seen-memory saturation

### Phase 4 — Cleanup
- remove client `/views` dependency
- deprecate request cursor in client
- delete v1 exact viewed SET after migration window

---

## 14. Configuration

```yaml
feed:
  page-size-default: 20
  page-size-max: 50
  session-idle-threshold-hours: 4
  session-ttl-hours: 12
  inject-page-max: 5
  inject-per-topic: 3
  scroll-per-topic: 12
  seek-max-iterations: 4
  max-topics-per-request: 64
  weight-scale: 0
  lock-ttl-ms: 1500
  hydration-buffer-multiplier: 1.5

seen:
  bloom-capacity: 20000
  bloom-error-rate: 0.01
  bloom-ttl-days: 12
  bloom-saturation-alert-threshold: 0.85
```

`bloom-capacity` must be validated against real traffic percentiles before production-wide rollout.

---

## 15. Why This Version Is Better

This refactor is better than v1 because it fixes the read-gap architecture bug.

It is better than the earlier v2 draft because it:
- defines session scope correctly
- removes misleading correctness claims
- replaces optimistic round-trip claims with realistic ones
- removes Bloom rotation from the base release
- prevents same-session overlapping page-builds
- prevents inject starvation of scroll
- reduces session-state retention cost
- treats client cursor as non-authoritative

The result is not the fanciest design. It is the one most likely to be implemented correctly, operated cheaply, and debugged under production pressure.

---

## 16. Open Questions

1. Should inject be capped at a fixed number or a fraction of page size?
2. Should users with no topics default to `world` or go directly to fallback?
3. Should weight-based truncation of >64 topics be tied to recency of follow instead of stable order?
4. Do we need an exact small session-local served cache in v2.1 for better diagnostics?
5. Is `409 FEED_REQUEST_IN_PROGRESS` better than `429` for client retry behavior?

---

**End of PRD**
