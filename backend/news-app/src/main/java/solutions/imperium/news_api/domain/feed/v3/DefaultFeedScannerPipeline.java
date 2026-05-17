package solutions.imperium.news_api.domain.feed.v3;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v3.model.BuildFeedRequest;
import solutions.imperium.news_api.domain.feed.v3.model.Candidate;
import solutions.imperium.news_api.domain.feed.v3.model.CandidateSource;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerScope;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerSession;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;
import solutions.imperium.news_api.domain.feed.v3.model.RankedItem;
import solutions.imperium.news_api.domain.feed.v3.model.ReadState;
import solutions.imperium.news_api.domain.feed.v3.model.Window;
import solutions.imperium.news_api.domain.feed.v2.UserFeedPreferences;
import solutions.imperium.news_api.domain.feed.v2.model.UserPrefs;
import solutions.imperium.news_api.exception.CustomExceptions;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Default V3 feed-scanner pipeline.
 *
 * <p>Per request:
 * <ol>
 *   <li>Load V2 {@link UserPrefs} (read-only). Resolve {@link FeedScannerScope}.</li>
 *   <li>Find or create {@link FeedScannerSession}. Acquire per-session lock.</li>
 *   <li>Load + normalize read intervals.</li>
 *   <li><b>Phase A</b>: scan {@code (initialNewestCursor, now]} for new items above the cursor.</li>
 *   <li><b>Phase B</b>: drain the previous session's pending {@code bufferIds}, promoting the
 *       prior {@code pendingWindow} to a read interval if fully drained.</li>
 *   <li><b>Phase C</b>: step backward from {@code olderCursor} by {@code windowMillis};
 *       skip windows fully covered by intervals, scan the rest, fill the page.</li>
 *   <li>Hydrate served IDs → commit (read IDs + new exhausted intervals + session).</li>
 *   <li>Return {@link PageResult}.</li>
 * </ol>
 */
@Service
@RequiredArgsConstructor
public class DefaultFeedScannerPipeline implements FeedScannerPipeline {

    private static final String WARNING_TOPICS_TRUNCATED = "topics_truncated";
    private static final String WARNING_FALLBACK_USED = "fallback_used";

    private final UserFeedPreferences userPreferences;
    private final FeedScopeResolver scopeResolver;
    private final FeedScannerSessionStore sessionStore;
    private final FeedScannerReadStateStore readStateStore;
    private final CandidateWindowScanner scanner;
    private final FeedCandidateRanker ranker;
    private final FeedScannerArticleHydrator hydrator;
    private final FeedScannerCommitter committer;
    private final FeedScannerProperties properties;
    private final FeedScannerMetrics metrics;

    @Override
    public Mono<PageResult<ArticleCardDto>> build(BuildFeedRequest request) {
        BuildFeedRequest sanitized = sanitize(request);
        long start = System.nanoTime();
        return userPreferences.load(sanitized.userId())
                .map(prefs -> scopeResolver.resolve(sanitized, prefs))
                .flatMap(scope -> resolveSession(sanitized, scope)
                        .flatMap(session -> withLock(sanitized.userId(), session,
                                () -> buildPage(sanitized, scope, session))))
                .doOnSuccess(result -> recordRequestMetrics(start, sanitized.limit(), result));
    }

    /** Current time in epoch seconds — matches the ZSET score unit used by the Redis projector. */
    private static long nowSeconds() {
        return java.time.Instant.now().getEpochSecond();
    }

    /** 12-day TTL in seconds. */
    private long readStateTtlSeconds() {
        return (long) properties.getReadStateTtlDays() * 86_400L;
    }

    private void recordRequestMetrics(long startNanos, int limit, PageResult<ArticleCardDto> result) {
        if (metrics == null) return;
        metrics.requestLatency.record(java.time.Duration.ofNanos(System.nanoTime() - startNanos));
        if (result != null && result.getData() != null && limit > 0) {
            metrics.pageFillRate.record(100.0d * result.getData().size() / (double) limit);
        }
    }

    /* --------------------------------- session --------------------------------- */

    private Mono<FeedScannerSession> resolveSession(BuildFeedRequest request, FeedScannerScope scope) {
        long now = nowSeconds();
        return sessionStore.find(request.userId(), request.sessionId())
                .flatMap(maybe -> maybe
                        .filter(s -> isSessionUsable(s, request.userId(), scope.scopeHash(), now))
                        .map(Mono::just)
                        .orElseGet(() -> createSession(request, scope, now)));
    }

    private boolean isSessionUsable(FeedScannerSession session, String userId, String scopeHash, long nowSec) {
        if (session == null) return false;
        if (!userId.equals(session.getUserId())) return false;
        if (!scopeHash.equals(session.getScopeHash())) return false;
        long idleSec = Duration.ofHours(properties.getSessionIdleThresholdHours()).toSeconds();
        return session.getUpdatedAt() > 0 && (nowSec - session.getUpdatedAt()) <= idleSec;
    }

    private Mono<FeedScannerSession> createSession(BuildFeedRequest request, FeedScannerScope scope, long nowSec) {
        // Seed olderCursor from the actual top ZSET score so Phase C starts at the right place.
        // This mirrors V2's sessionAnchor probing and avoids the ms-vs-seconds mismatch.
        return topScoreForScope(scope)
                .map(topScore -> {
                    long cursor = topScore > 0 ? topScore : nowSec;
                    return FeedScannerSession.builder()
                            .sessionId(java.util.UUID.randomUUID().toString())
                            .userId(request.userId())
                            .scopeHash(scope.scopeHash())
                            .endpointKind(scope.endpointKind())
                            .topicParam(scope.topicParam())
                            .countryIds(scope.countryIds())
                            .newestCursor(cursor)
                            .olderCursor(cursor)
                            .pendingWindowStart(0L)
                            .pendingWindowEnd(0L)
                            .bufferIds(List.of())
                            .createdAt(nowSec)
                            .updatedAt(nowSec)
                            .build();
                });
    }

    /** Returns the highest ZSET score across the scope's topic/country keys. */
    private Mono<Long> topScoreForScope(FeedScannerScope scope) {
        if (scope.countryIds() == null || scope.countryIds().isEmpty()) return Mono.just(0L);
        boolean fallback = scope.isFallbackOnly();
        List<String> keys = new java.util.ArrayList<>();
        for (int countryId : scope.countryIds()) {
            if (fallback) {
                keys.add(String.format(solutions.imperium.news_api.core.Constants.KEY_FEED_COUNTRY, countryId));
            } else {
                for (String topic : scope.topics()) {
                    keys.add(String.format(solutions.imperium.news_api.core.Constants.KEY_FEED_COUNTRY_TOPIC, countryId, topic));
                }
            }
        }
        if (keys.isEmpty()) return Mono.just(0L);
        return reactor.core.publisher.Flux.fromIterable(keys)
                .flatMap(key -> scanner.scan(scope.countryIds(), scope.topics(), fallback,
                        0L, Long.MAX_VALUE, 1)
                        .map(cands -> cands.isEmpty() ? 0L : cands.get(0).rawScore()))
                .reduce(0L, Math::max);
    }

    /* ----------------------------------- lock ---------------------------------- */

    private Mono<PageResult<ArticleCardDto>> withLock(String userId,
                                                     FeedScannerSession session,
                                                     Supplier<Mono<PageResult<ArticleCardDto>>> work) {
        String token = UUID.randomUUID().toString();
        Duration ttl = Duration.ofMillis(properties.getLockTtlMs());
        return sessionStore.acquireLock(userId, session.getSessionId(), token, ttl)
                .flatMap(acquired -> {
                    if (!Boolean.TRUE.equals(acquired)) {
                        return Mono.error(new CustomExceptions.FeedRequestInProgressException(session.getSessionId()));
                    }
                    return Mono.usingWhen(
                            Mono.just(token),
                            ignore -> work.get(),
                            ignore -> sessionStore.releaseLock(userId, session.getSessionId(), token).then(),
                            (ignore, err) -> sessionStore.releaseLock(userId, session.getSessionId(), token).then(),
                            ignore -> sessionStore.releaseLock(userId, session.getSessionId(), token).then()
                    );
                });
    }

    /* --------------------------------- build page ------------------------------ */

    private Mono<PageResult<ArticleCardDto>> buildPage(BuildFeedRequest request,
                                                       FeedScannerScope scope,
                                                       FeedScannerSession initialSession) {
        long now = nowSeconds();
        long minValidTs = now - readStateTtlSeconds();
        return readStateStore.loadReadState(request.userId(), scope.scopeHash(), minValidTs)
                .flatMap(readState -> {
                    PageBuildState state = new PageBuildState(request, scope, initialSession,
                            readState, now, minValidTs);
                    return runPhaseA(state)
                            .then(Mono.defer(() -> runPhaseB(state)))
                            .then(Mono.defer(() -> runPhaseC(state)))
                            .then(Mono.defer(() -> hydrateAndCommit(state)));
                });
    }

    /* ----------------------------------- phases -------------------------------- */

    /** Phase A: scan {@code (initialSession.newestCursor, now]} for new items. */
    private Mono<Void> runPhaseA(PageBuildState state) {
        long lower = state.initialSession.getNewestCursor();
        long wStart = lower + 1;
        long wEnd = state.now;
        if (wEnd < wStart) {
            // No new-item window to scan. Still advance newestCursor to current now.
            state.updatedNewestCursor = state.now;
            return Mono.empty();
        }
        return scanner.scan(state.scope.countryIds(), state.scope.topics(), state.scope.isFallbackOnly(),
                        wStart, wEnd, properties.getPerTopicLimit())
                .flatMap(candidates -> filterAndRank(state, candidates)
                        .doOnNext(ranked -> {
                            int absorbed = absorbRanked(state, ranked, false);
                            state.phaseACount += absorbed;
                            if (metrics != null && absorbed > 0) {
                                metrics.newItemsInjected.increment(absorbed);
                            }
                        }))
                .doOnSuccess(ignored -> state.updatedNewestCursor = state.now)
                .then();
    }

    /** Phase B: drain bufferIds carried over from a previous request's incomplete window. */
    private Mono<Void> runPhaseB(PageBuildState state) {
        List<String> buffer = state.initialSession.getBufferIds();
        if (buffer == null || buffer.isEmpty() || state.served() >= state.limit) {
            // Even if we don't drain, surface the pending window when unchanged so we don't lose it.
            state.pendingWindowStart = state.initialSession.getPendingWindowStart();
            state.pendingWindowEnd = state.initialSession.getPendingWindowEnd();
            state.updatedBufferIds = buffer == null ? List.of() : new ArrayList<>(buffer);
            return Mono.empty();
        }
        return readStateStore.filterUnreadIds(state.request.userId(), state.scope.scopeHash(), buffer)
                .doOnNext(unread -> {
                    int remaining = state.limit - state.served();
                    int absorbed = 0;
                    List<String> leftover = new ArrayList<>();
                    boolean filled = false;
                    for (String id : unread) {
                        if (state.servedIdSet.contains(id)) continue;
                        if (filled) {
                            leftover.add(id);
                            continue;
                        }
                        // We don't know the exact rawScore for buffered IDs, so we use the pending
                        // window's end timestamp as a deterministic placeholder; ranking does not
                        // re-shuffle across phases.
                        state.servedIds.add(id);
                        state.servedIdSet.add(id);
                        state.servedCandidates.add(bufferCandidate(id, state));
                        absorbed++;
                        if (absorbed >= remaining) filled = true;
                    }
                    boolean fullyDrained = leftover.isEmpty();
                    if (fullyDrained) {
                        // The pending window is fully consumed → promote to interval at commit.
                        long pStart = state.initialSession.getPendingWindowStart();
                        long pEnd = state.initialSession.getPendingWindowEnd();
                        if (pEnd > 0 && pEnd >= pStart) {
                            state.newExhaustedIntervals.add(new Interval(pStart, pEnd));
                            state.windowsExhausted++;
                        }
                        state.updatedBufferIds = List.of();
                        state.pendingWindowStart = 0L;
                        state.pendingWindowEnd = 0L;
                    } else {
                        // Page filled mid-buffer; preserve remainder + pending window.
                        state.updatedBufferIds = capBuffer(leftover);
                        state.pendingWindowStart = state.initialSession.getPendingWindowStart();
                        state.pendingWindowEnd = state.initialSession.getPendingWindowEnd();
                    }
                })
                .then();
    }

    /** Phase C: scan older windows backward from {@code olderCursor} with interval-skip. */
    private Mono<Void> runPhaseC(PageBuildState state) {
        if (state.served() >= state.limit) {
            state.updatedOlderCursor = state.initialSession.getOlderCursor();
            return Mono.empty();
        }
        boolean useFallback = state.scope.isFallbackOnly();
        return runPhaseCStage(state, useFallback)
                .then(Mono.defer(() -> {
                    // Personalized + topics: if we ran out of primary candidates and still have slots,
                    // try one fallback pass on the country ZSET for the same range.
                    if (state.served() < state.limit
                            && state.scope.endpointKind() == EndpointKind.PERSONALIZED
                            && !state.scope.isFallbackOnly()
                            && state.primaryExhaustedNow) {
                        return runPhaseCStage(state, true);
                    }
                    return Mono.empty();
                }))
                .then();
    }

    private Mono<Void> runPhaseCStage(PageBuildState state, boolean useFallback) {
        long currentOlder = state.updatedOlderCursor != Long.MIN_VALUE
                ? state.updatedOlderCursor
                : state.initialSession.getOlderCursor();
        return Mono.defer(() -> stepWindow(state, currentOlder, 0, useFallback));
    }

    /**
     * Recursively scan windows backward until {@code state.served() >= limit}, max iterations
     * reached, or we hit {@code minValidTs}. Each step decrements {@code currentOlder} by one
     * window or by an interval-skip jump.
     */
    private Mono<Void> stepWindow(PageBuildState state, long currentOlder, int iterations, boolean useFallback) {
        if (state.served() >= state.limit) {
            state.updatedOlderCursor = currentOlder;
            return Mono.empty();
        }
        if (iterations >= properties.getMaxWindowsPerRequest()) {
            state.updatedOlderCursor = currentOlder;
            return Mono.empty();
        }
        if (currentOlder < state.minValidTs) {
            state.updatedOlderCursor = state.minValidTs;
            markStageExhausted(state, useFallback);
            return Mono.empty();
        }
        long wEnd = currentOlder;
        long wStart = Math.max(state.minValidTs, wEnd - properties.getWindowMillis() + 1);
        if (ReadIntervals.coversRange(state.intervals, wStart, wEnd)) {
            state.windowsSkipped++;
            if (metrics != null) metrics.windowSkipped.increment();
            // Jump past the entire covering interval in O(1) — not just one window — so a single
            // huge interval doesn't burn the whole {@code maxWindowsPerRequest} budget.
            solutions.imperium.news_api.domain.feed.v3.model.Interval covering =
                    ReadIntervals.findCoveringInterval(state.intervals, wStart, wEnd);
            long jumpTo = covering != null ? covering.startTs() - 1 : wStart - 1;
            return stepWindow(state, jumpTo, iterations + 1, useFallback);
        }
        List<Window> gaps = ReadIntervals.subtract(state.intervals, wStart, wEnd);
        if (gaps.isEmpty()) {
            return stepWindow(state, wStart - 1, iterations + 1, useFallback);
        }
        return scanGaps(gaps, state, useFallback)
                .flatMap(candidates -> {
                    state.windowsScanned++;
                    if (metrics != null) metrics.windowScanned.increment();
                    if (candidates.isEmpty()) {
                        // Nothing in this window; treat as exhausted and move on.
                        state.newExhaustedIntervals.add(new Interval(wStart, wEnd));
                        state.windowsExhausted++;
                        if (metrics != null) metrics.windowExhausted.increment();
                        return stepWindow(state, wStart - 1, iterations + 1, useFallback);
                    }
                    return filterAndRank(state, candidates).flatMap(ranked -> {
                        int remaining = state.limit - state.served();
                        int absorbed = absorbRanked(state, ranked, useFallback);
                        if (absorbed < ranked.size() && state.served() >= state.limit) {
                            // Page filled mid-window; remember leftovers.
                            List<String> leftoverIds = new ArrayList<>();
                            for (int idx = absorbed; idx < ranked.size(); idx++) {
                                String id = ranked.get(idx).candidate().articleId();
                                if (!state.servedIdSet.contains(id)) leftoverIds.add(id);
                            }
                            state.updatedBufferIds = capBuffer(leftoverIds);
                            state.pendingWindowStart = wStart;
                            state.pendingWindowEnd = wEnd;
                            state.updatedOlderCursor = wStart - 1;
                            return Mono.empty();
                        }
                        // Window fully consumed; mark exhausted and step back.
                        state.newExhaustedIntervals.add(new Interval(wStart, wEnd));
                        state.windowsExhausted++;
                        if (metrics != null) metrics.windowExhausted.increment();
                        return stepWindow(state, wStart - 1, iterations + 1, useFallback);
                    });
                });
    }

    private Mono<List<Candidate>> scanGaps(List<Window> gaps, PageBuildState state, boolean useFallback) {
        if (gaps.size() == 1) {
            Window only = gaps.get(0);
            return scanner.scan(state.scope.countryIds(), state.scope.topics(),
                    useFallback, only.startTs(), only.endTs(), properties.getPerTopicLimit());
        }
        // Multiple gaps in one window — scan each then concatenate (already in newest-first order).
        return reactor.core.publisher.Flux.fromIterable(gaps)
                .concatMap(g -> scanner.scan(state.scope.countryIds(), state.scope.topics(),
                        useFallback, g.startTs(), g.endTs(), properties.getPerTopicLimit()))
                .flatMapIterable(list -> list)
                .collectList();
    }

    private void markStageExhausted(PageBuildState state, boolean useFallback) {
        if (useFallback) {
            state.fallbackExhausted = true;
        } else {
            state.primaryExhausted = true;
            state.primaryExhaustedNow = true;
        }
    }

    /* ----------------------------- helpers ----------------------------- */

    private Mono<List<RankedItem>> filterAndRank(PageBuildState state, List<Candidate> candidates) {
        if (candidates.isEmpty()) return Mono.just(List.of());
        List<String> ids = candidates.stream().map(Candidate::articleId).toList();
        return readStateStore.filterUnreadIds(state.request.userId(), state.scope.scopeHash(), ids)
                .map(unreadSet -> {
                    if (unreadSet.isEmpty()) return List.<RankedItem>of();
                    Set<String> dedup = new LinkedHashSet<>();
                    List<Candidate> eligible = new ArrayList<>();
                    for (Candidate c : candidates) {
                        if (!unreadSet.contains(c.articleId())) continue;
                        if (state.servedIdSet.contains(c.articleId())) continue;
                        if (!dedup.add(c.articleId())) continue;
                        eligible.add(c);
                    }
                    return ranker.rank(eligible, state.scope, state.now);
                });
    }

    /** Absorbs as many ranked items as remaining slots. Returns the number absorbed. */
    private int absorbRanked(PageBuildState state, List<RankedItem> ranked, boolean useFallback) {
        if (ranked.isEmpty()) return 0;
        int absorbed = 0;
        int remaining = state.limit - state.served();
        for (RankedItem item : ranked) {
            if (absorbed >= remaining) break;
            String id = item.candidate().articleId();
            if (state.servedIdSet.contains(id)) continue;
            state.servedIds.add(id);
            state.servedIdSet.add(id);
            state.servedCandidates.add(item.candidate());
            if (item.candidate().source() == CandidateSource.FALLBACK || useFallback) {
                state.usedFallback = true;
            } else {
                state.usedPrimary = true;
            }
            absorbed++;
        }
        return absorbed;
    }

    private List<String> capBuffer(List<String> ids) {
        int cap = properties.getMaxBufferSize();
        if (ids.size() <= cap) return Collections.unmodifiableList(new ArrayList<>(ids));
        return Collections.unmodifiableList(new ArrayList<>(ids.subList(0, cap)));
    }

    private Candidate bufferCandidate(String id, PageBuildState state) {
        long score = state.initialSession.getPendingWindowEnd();
        return new Candidate(id, score, 0, null, CandidateSource.PRIMARY);
    }

    /* ------------------------------ commit + response ------------------------------ */

    private Mono<PageResult<ArticleCardDto>> hydrateAndCommit(PageBuildState state) {
        return hydrator.hydrate(state.servedIds)
                .flatMap(hydrated -> {
                    FeedScannerSession updated = buildUpdatedSession(state);
                    return committer.commit(state.request.userId(),
                                    state.scope.scopeHash(),
                                    state.servedIds,
                                    state.newExhaustedIntervals,
                                    updated,
                                    state.minValidTs)
                            .map(saved -> buildResponse(state, hydrated, saved));
                });
    }

    private FeedScannerSession buildUpdatedSession(PageBuildState state) {
        long olderCursor = state.updatedOlderCursor != Long.MIN_VALUE
                ? state.updatedOlderCursor
                : state.initialSession.getOlderCursor();
        long newest = state.updatedNewestCursor != 0L
                ? state.updatedNewestCursor
                : state.initialSession.getNewestCursor();
        List<String> buffer = state.updatedBufferIds != null
                ? state.updatedBufferIds
                : (state.initialSession.getBufferIds() == null ? List.of() : state.initialSession.getBufferIds());
        long pStart = state.pendingWindowStart != 0L
                ? state.pendingWindowStart
                : (buffer.isEmpty() ? 0L : state.initialSession.getPendingWindowStart());
        long pEnd = state.pendingWindowEnd != 0L
                ? state.pendingWindowEnd
                : (buffer.isEmpty() ? 0L : state.initialSession.getPendingWindowEnd());
        return state.initialSession.toBuilder()
                .newestCursor(newest)
                .olderCursor(olderCursor)
                .pendingWindowStart(pStart)
                .pendingWindowEnd(pEnd)
                .bufferIds(buffer)
                .updatedAt(nowSeconds())
                .build();
    }

    private PageResult<ArticleCardDto> buildResponse(PageBuildState state,
                                                     List<ArticleCardDto> hydrated,
                                                     FeedScannerSession saved) {
        List<String> warnings = new ArrayList<>();
        if (state.scope.topicsTruncated()) warnings.add(WARNING_TOPICS_TRUNCATED);
        if (state.usedFallback && state.scope.endpointKind() == EndpointKind.PERSONALIZED) {
            warnings.add(WARNING_FALLBACK_USED);
        }
        String source;
        if (state.usedPrimary && state.usedFallback) source = "mixed";
        else if (state.usedFallback) source = "fallback";
        else source = "primary";

        Long nextCursor = saved.getOlderCursor() <= 0 ? null : saved.getOlderCursor();
        boolean hasMore;
        if (state.scope.endpointKind() == EndpointKind.PERSONALIZED) {
            hasMore = !(state.primaryExhausted && state.fallbackExhausted)
                    && saved.getOlderCursor() > state.minValidTs;
        } else {
            hasMore = !state.primaryExhausted && saved.getOlderCursor() > state.minValidTs;
        }

        PageResult<ArticleCardDto> result = new PageResult<>(hydrated, nextCursor);
        result.setSessionId(saved.getSessionId());
        result.setSessionAnchor(saved.getNewestCursor());
        result.setNextScrollCursor(saved.getOlderCursor());
        result.setSource(source);
        result.setHasMore(hasMore);
        result.setNewSinceLastSession(state.phaseACount);
        result.setWarnings(warnings);
        return result;
    }

    /* ------------------------------ utilities ------------------------------ */

    private BuildFeedRequest sanitize(BuildFeedRequest in) {
        int requested = in.limit();
        int defaulted = requested <= 0 ? properties.getPageSizeDefault() : requested;
        int safe = Math.max(properties.getPageSizeMin(), Math.min(properties.getPageSizeMax(), defaulted));
        return new BuildFeedRequest(in.userId(), in.endpointKind(), in.topicParam(), in.sessionId(), safe);
    }

    /* ------------------------------ inner state ------------------------------ */

    private static final class PageBuildState {
        final BuildFeedRequest request;
        final FeedScannerScope scope;
        final FeedScannerSession initialSession;
        final List<Interval> intervals;
        final long now;
        final long minValidTs;
        final int limit;

        final List<String> servedIds = new ArrayList<>();
        final Set<String> servedIdSet = new LinkedHashSet<>();
        final List<Candidate> servedCandidates = new ArrayList<>();
        final List<Interval> newExhaustedIntervals = new ArrayList<>();

        long updatedNewestCursor;
        long updatedOlderCursor = Long.MIN_VALUE;
        long pendingWindowStart;
        long pendingWindowEnd;
        List<String> updatedBufferIds;

        int phaseACount;
        int windowsScanned;
        int windowsSkipped;
        int windowsExhausted;
        boolean primaryExhausted;
        boolean fallbackExhausted;
        boolean primaryExhaustedNow;
        boolean usedPrimary;
        boolean usedFallback;

        PageBuildState(BuildFeedRequest request, FeedScannerScope scope, FeedScannerSession session,
                       ReadState readState, long now, long minValidTs) {
            this.request = request;
            this.scope = scope;
            this.initialSession = session;
            this.intervals = readState == null ? List.of() : readState.intervals();
            this.now = now;
            this.minValidTs = minValidTs;
            this.limit = request.limit();
        }

        int served() {
            return servedIds.size();
        }
    }
}
