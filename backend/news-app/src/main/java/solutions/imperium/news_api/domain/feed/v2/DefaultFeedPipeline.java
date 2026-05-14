package solutions.imperium.news_api.domain.feed.v2;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v2.model.AggregationRequest;
import solutions.imperium.news_api.domain.feed.v2.model.BuildRequest;
import solutions.imperium.news_api.domain.feed.v2.model.Candidate;
import solutions.imperium.news_api.domain.feed.v2.model.CandidateBucket;
import solutions.imperium.news_api.domain.feed.v2.model.CandidateSource;
import solutions.imperium.news_api.domain.feed.v2.model.FeedScope;
import solutions.imperium.news_api.domain.feed.v2.model.FeedV2Session;
import solutions.imperium.news_api.domain.feed.v2.model.ServedItem;
import solutions.imperium.news_api.domain.feed.v2.model.UserPrefs;
import solutions.imperium.news_api.exception.CustomExceptions;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

@Service
@RequiredArgsConstructor
public class DefaultFeedPipeline implements FeedPipeline {

    private static final int WEIGHT_CONFIG_VERSION = 0;
    private static final String WARNING_TOPICS_TRUNCATED = "topics_truncated";
    private static final String WARNING_FALLBACK_USED = "fallback_used";

    private final UserFeedPreferences userPreferences;
    private final FeedSessionStore sessionStore;
    private final SeenArticleStore seenStore;
    private final CandidateAggregator aggregator;
    private final ArticleHydrator hydrator;
    private final FeedV2Properties properties;

    @Override
    public Mono<PageResult<ArticleCardDto>> build(BuildRequest request) {
        int safeLimit = clampLimit(request.limit());
        return userPreferences.load(request.userId())
                .flatMap(prefs -> resolveSession(request, prefs)
                        .flatMap(session -> withLock(request.userId(), session,
                                () -> buildPage(request, prefs, session, safeLimit))));
    }

    /* ----------------- session ----------------- */

    private Mono<FeedV2Session> resolveSession(BuildRequest request, UserPrefs prefs) {
        FeedScope scope = new FeedScope(
                request.endpointKind(),
                prefs.countryIds(),
                request.topicParam(),
                prefs.prefsVersion(),
                WEIGHT_CONFIG_VERSION
        );
        String fingerprint = scope.fingerprint();

        return sessionStore.find(request.userId(), request.sessionId())
                .flatMap(maybeSession -> maybeSession
                        .filter(s -> isSessionUsable(s, request.userId(), fingerprint))
                        .map(Mono::just)
                        .orElseGet(() -> createSession(request, prefs, fingerprint)));
    }

    private boolean isSessionUsable(FeedV2Session session, String userId, String fingerprint) {
        if (session == null) return false;
        if (!userId.equals(session.getUserId())) return false;
        if (!fingerprint.equals(session.getScopeFingerprint())) return false;
        long idleMs = Duration.ofHours(properties.getSessionIdleThresholdHours()).toMillis();
        return session.getLastAccessAt() > 0 && (System.currentTimeMillis() - session.getLastAccessAt()) <= idleMs;
    }

    private Mono<FeedV2Session> createSession(BuildRequest request, UserPrefs prefs, String fingerprint) {
        List<String> topicsForAnchor = effectiveTopics(request, prefs);
        boolean useFallback = topicsForAnchor.isEmpty();
        // Anchor must reflect the user's accessible content universe — including the country
        // fallback so the personalized endpoint still has a usable anchor when followed
        // topics are momentarily empty.
        Mono<Long> primaryAnchor = topicsForAnchor.isEmpty()
                ? Mono.just(0L)
                : aggregator.topScoreForScope(prefs.countryIds(), topicsForAnchor, false);
        Mono<Long> fallbackAnchor = aggregator.topScoreForScope(prefs.countryIds(), List.of(), true);
        return Mono.zip(primaryAnchor, fallbackAnchor)
                .map(tuple -> Math.max(tuple.getT1(), tuple.getT2()))
                .map(anchor -> {
                    long now = System.currentTimeMillis();
                    return FeedV2Session.builder()
                            .sessionId(UUID.randomUUID().toString())
                            .userId(request.userId())
                            .scopeFingerprint(fingerprint)
                            .endpointKind(request.endpointKind())
                            .topicParam(request.topicParam())
                            .countryIds(prefs.countryIds())
                            .sessionAnchor(anchor)
                            .scrollCursor(Long.MAX_VALUE)
                            .createdAt(now)
                            .lastAccessAt(now)
                            .build();
                })
                .flatMap(s -> sessionStore.save(s, Duration.ofHours(properties.getSessionTtlHours())));
    }

    private List<String> effectiveTopics(BuildRequest request, UserPrefs prefs) {
        return switch (request.endpointKind()) {
            case BuildRequest.ENDPOINT_TOPIC -> List.of(request.topicParam());
            case BuildRequest.ENDPOINT_LATEST -> List.of();
            default -> prefs.topics();
        };
    }

    /* ----------------- locking ----------------- */

    private Mono<PageResult<ArticleCardDto>> withLock(String userId, FeedV2Session session,
                                                     Supplier<Mono<PageResult<ArticleCardDto>>> action) {
        String token = UUID.randomUUID().toString();
        Duration lockTtl = Duration.ofMillis(properties.getLockTtlMs());
        return sessionStore.acquireLock(userId, session.getSessionId(), token, lockTtl)
                .flatMap(acquired -> {
                    if (!Boolean.TRUE.equals(acquired)) {
                        return Mono.error(new CustomExceptions.FeedRequestInProgressException(session.getSessionId()));
                    }
                    return Mono.usingWhen(
                            Mono.just(token),
                            ignored -> action.get(),
                            ignored -> sessionStore.releaseLock(userId, session.getSessionId(), token).then(),
                            (ignored, err) -> sessionStore.releaseLock(userId, session.getSessionId(), token).then(),
                            ignored -> sessionStore.releaseLock(userId, session.getSessionId(), token).then()
                    );
                });
    }

    /* ----------------- page building ----------------- */

    private Mono<PageResult<ArticleCardDto>> buildPage(BuildRequest request, UserPrefs prefs,
                                                       FeedV2Session session, int limit) {
        BuildState state = new BuildState(session, prefs, request, limit);
        List<Stage> stages = stagesForEndpoint(request, prefs);

        return runStages(state, stages, 0)
                .then(Mono.defer(() -> commit(state)));
    }

    private Mono<Void> runStages(BuildState state, List<Stage> stages, int index) {
        if (index >= stages.size() || state.served.size() >= state.limit) {
            return Mono.empty();
        }
        return seekLoop(state, stages.get(index), 0)
                .then(Mono.defer(() -> runStages(state, stages, index + 1)));
    }

    private List<Stage> stagesForEndpoint(BuildRequest request, UserPrefs prefs) {
        return switch (request.endpointKind()) {
            case BuildRequest.ENDPOINT_TOPIC ->
                    List.of(new Stage(List.of(request.topicParam()), false, CandidateSource.PRIMARY));
            case BuildRequest.ENDPOINT_LATEST ->
                    List.of(new Stage(List.of(), true, CandidateSource.PRIMARY));
            default -> {
                if (prefs.topics().isEmpty()) {
                    yield List.of(new Stage(List.of(), true, CandidateSource.PRIMARY));
                }
                yield List.of(
                        new Stage(prefs.topics(), false, CandidateSource.PRIMARY),
                        new Stage(List.of(), true, CandidateSource.FALLBACK)
                );
            }
        };
    }

    private Mono<Void> seekLoop(BuildState state, Stage stage, int iteration) {
        if (state.served.size() >= state.limit) return Mono.empty();
        if (iteration > properties.getSeekMaxIterations()) {
            markExhausted(state, stage);
            return Mono.empty();
        }

        boolean includeInject = !state.injectFetched;
        AggregationRequest req = new AggregationRequest(
                state.session.getCountryIds(),
                stage.topics,
                state.session.getSessionAnchor(),
                state.seekCursor,
                properties.getInjectPerTopic(),
                properties.getScrollPerTopic(),
                includeInject,
                stage.useFallback,
                properties.getWeightScale()
        );

        return aggregator.aggregate(req).flatMap(candidates -> {
            if (includeInject) state.injectFetched = true;
            if (candidates.isEmpty()) {
                markExhausted(state, stage);
                return Mono.empty();
            }

            long minScrollFetched = candidates.stream()
                    .filter(c -> c.bucket() == CandidateBucket.SCROLL)
                    .mapToLong(Candidate::rawScore)
                    .min().orElse(Long.MIN_VALUE);

            List<Candidate> notYetAccumulated = candidates.stream()
                    .filter(c -> !state.alreadyAccumulated.contains(c.articleId()))
                    .toList();
            if (notYetAccumulated.isEmpty()) {
                if (minScrollFetched == Long.MIN_VALUE) {
                    markExhausted(state, stage);
                    return Mono.empty();
                }
                state.seekCursor = minScrollFetched;
                return seekLoop(state, stage, iteration + 1);
            }

            List<String> idsToCheck = notYetAccumulated.stream().map(Candidate::articleId).toList();
            return seenStore.filterUnseen(state.session.getUserId(), idsToCheck)
                    .flatMap(unseenSet -> {
                        List<Candidate> eligible = applyInjectBudget(state, notYetAccumulated, unseenSet);
                        if (eligible.isEmpty()) {
                            if (minScrollFetched == Long.MIN_VALUE) {
                                markExhausted(state, stage);
                                return Mono.empty();
                            }
                            state.seekCursor = minScrollFetched;
                            return seekLoop(state, stage, iteration + 1);
                        }

                        List<String> ids = eligible.stream().map(Candidate::articleId).toList();
                        return hydrator.hydrate(ids).flatMap(hydrated -> {
                            int remaining = state.limit - state.served.size();
                            int absorbed = absorb(state, eligible, hydrated, remaining, stage);
                            if (state.served.size() >= state.limit) return Mono.empty();
                            if (minScrollFetched == Long.MIN_VALUE) {
                                markExhausted(state, stage);
                                return Mono.empty();
                            }
                            state.seekCursor = minScrollFetched;
                            return seekLoop(state, stage, iteration + 1);
                        });
                    });
        });
    }

    private List<Candidate> applyInjectBudget(BuildState state, List<Candidate> candidates, Set<String> unseen) {
        List<Candidate> eligible = new ArrayList<>(candidates.size());
        int injectAcceptedSoFar = state.injectAccepted;
        for (Candidate candidate : candidates) {
            if (!unseen.contains(candidate.articleId())) continue;
            if (candidate.bucket() == CandidateBucket.INJECT) {
                if (injectAcceptedSoFar >= state.injectBudget) continue;
                injectAcceptedSoFar++;
            }
            eligible.add(candidate);
        }
        return eligible;
    }

    private int absorb(BuildState state, List<Candidate> eligible,
                       java.util.Map<String, ArticleCardDto> hydrated, int remaining, Stage stage) {
        int absorbed = 0;
        for (Candidate candidate : eligible) {
            if (absorbed >= remaining) break;
            ArticleCardDto dto = hydrated.get(candidate.articleId());
            if (dto == null) continue;
            dto.setScore(candidate.rawScore());
            state.served.add(new ServedItem(candidate, dto));
            state.alreadyAccumulated.add(candidate.articleId());
            if (candidate.bucket() == CandidateBucket.INJECT) state.injectAccepted++;
            absorbed++;
        }
        if (stage.source == CandidateSource.FALLBACK && absorbed > 0
                && !state.warnings.contains(WARNING_FALLBACK_USED)) {
            state.warnings.add(WARNING_FALLBACK_USED);
        }
        return absorbed;
    }

    private void markExhausted(BuildState state, Stage stage) {
        if (stage.source == CandidateSource.PRIMARY) state.primaryExhausted = true;
        else state.fallbackExhausted = true;
    }

    /* ----------------- commit ----------------- */

    private Mono<PageResult<ArticleCardDto>> commit(BuildState state) {
        state.served.sort(Comparator.<ServedItem>comparingLong(it -> it.candidate().rawScore()).reversed());
        List<String> servedIds = state.served.stream().map(it -> it.dto().getId()).toList();

        long minServedScrollScore = state.served.stream()
                .filter(item -> item.candidate().bucket() == CandidateBucket.SCROLL)
                .mapToLong(item -> item.candidate().rawScore())
                .min().orElse(state.session.getScrollCursor());

        long updatedScrollCursor = state.served.stream().anyMatch(i -> i.candidate().bucket() == CandidateBucket.SCROLL)
                ? Math.min(minServedScrollScore, state.session.getScrollCursor())
                : state.session.getScrollCursor();

        FeedV2Session updatedSession = state.session.toBuilder()
                .scrollCursor(updatedScrollCursor)
                .lastAccessAt(System.currentTimeMillis())
                .build();

        if (state.prefs.topicsTruncated() && !state.warnings.contains(WARNING_TOPICS_TRUNCATED)) {
            state.warnings.add(WARNING_TOPICS_TRUNCATED);
        }

        return seenStore.markServed(state.session.getUserId(), servedIds)
                .then(sessionStore.save(updatedSession, Duration.ofHours(properties.getSessionTtlHours())))
                .map(saved -> buildResponse(state, saved));
    }

    private PageResult<ArticleCardDto> buildResponse(BuildState state, FeedV2Session saved) {
        List<ArticleCardDto> dtos = state.served.stream().map(ServedItem::dto).toList();
        Long nextCursor = state.served.isEmpty()
                ? null
                : state.served.stream().mapToLong(it -> it.candidate().rawScore()).min().orElse(0L);

        boolean hasPrimary = state.served.stream().anyMatch(i -> i.candidate().source() == CandidateSource.PRIMARY);
        boolean hasFallback = state.served.stream().anyMatch(i -> i.candidate().source() == CandidateSource.FALLBACK);
        String source;
        if (hasPrimary && hasFallback) source = "mixed";
        else if (hasFallback) source = "fallback";
        else source = "primary";

        int newSinceLastSession = (int) state.served.stream()
                .filter(i -> i.candidate().bucket() == CandidateBucket.INJECT
                        && i.candidate().source() == CandidateSource.PRIMARY)
                .count();

        boolean hasMore = !(state.primaryExhausted && state.fallbackExhausted);

        PageResult<ArticleCardDto> result = new PageResult<>(dtos, nextCursor);
        result.setSessionId(saved.getSessionId());
        result.setSessionAnchor(saved.getSessionAnchor());
        result.setNextScrollCursor(saved.getScrollCursor());
        result.setSource(source);
        result.setHasMore(hasMore);
        result.setNewSinceLastSession(newSinceLastSession);
        result.setWarnings(state.warnings);
        return result;
    }

    /* ----------------- helpers ----------------- */

    private int clampLimit(int requested) {
        int defaulted = requested <= 0 ? properties.getPageSizeDefault() : requested;
        return Math.max(properties.getPageSizeMin(), Math.min(properties.getPageSizeMax(), defaulted));
    }

    private int injectPageCap(int limit) {
        return Math.min(properties.getInjectPageMax(), Math.max(0, limit / 2));
    }

    /* ----------------- inner types ----------------- */

    private record Stage(List<String> topics, boolean useFallback, CandidateSource source) {}

    private final class BuildState {
        final FeedV2Session session;
        final UserPrefs prefs;
        final BuildRequest request;
        final int limit;
        final int injectBudget;

        final List<ServedItem> served = new ArrayList<>();
        final Set<String> alreadyAccumulated = new LinkedHashSet<>();
        final List<String> warnings = new ArrayList<>();
        long seekCursor;
        boolean injectFetched;
        int injectAccepted;
        boolean primaryExhausted;
        boolean fallbackExhausted;

        BuildState(FeedV2Session session, UserPrefs prefs, BuildRequest request, int limit) {
            this.session = session;
            this.prefs = prefs;
            this.request = request;
            this.limit = limit;
            this.injectBudget = injectPageCap(limit);
            this.seekCursor = session.getScrollCursor();
            if (prefs.topicsTruncated()) warnings.add(WARNING_TOPICS_TRUNCATED);
        }
    }
}
