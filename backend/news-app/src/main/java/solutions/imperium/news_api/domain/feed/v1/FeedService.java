package solutions.imperium.news_api.domain.feed.v1;

import solutions.imperium.news_api.domain.feed.v1.FeedRepository;
import solutions.imperium.news_api.domain.feed.v1.FeedProperties;
import solutions.imperium.news_api.domain.feed.v1.FeedSession;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidate;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidateBucket;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidateSource;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.exception.CustomExceptions;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedService {

    private static final String ENDPOINT_PERSONALIZED = "feed";
    private static final String ENDPOINT_TOPIC = "feed-topic";
    private static final String ENDPOINT_LATEST = "feed-latest";
    private static final int DEFAULT_WEIGHT_CONFIG_VERSION = 0;
    private static final Duration SESSION_IDLE_THRESHOLD = Duration.ofHours(4);
    private static final Duration SESSION_LOCK_TTL = Duration.ofMillis(1500);
    private static final String WARNING_TOPICS_TRUNCATED = "topics_truncated";

    private final FeedRepository feedRepository;
    private final ObjectMapper objectMapper;
    private final FeedProperties feedProperties;

    public Mono<PageResult<ArticleCardDto>> generateFeed(
            String userId,
            String sessionId,
            Long cursor,
            Long sessionCursor,
            int limit
    ) {
        int safeLimit = normalizeLimit(limit);
        if (sessionId == null && sessionCursor != null) {
            return legacyGenerateFeed(userId, cursor, sessionCursor, safeLimit);
        }

        return resolveSession(userId, sessionId, ENDPOINT_PERSONALIZED, null, true)
                .flatMap(context -> withSessionLock(userId, context.session(), () -> buildPersonalizedPage(userId, context, safeLimit)));
    }

    public Mono<PageResult<ArticleCardDto>> getByTopic(
            String userId,
            String topicId,
            String sessionId,
            Long cursor,
            Long sessionCursor,
            int limit
    ) {
        int safeLimit = normalizeLimit(limit);
        if (sessionId == null && sessionCursor != null) {
            return legacyGetByTopic(userId, topicId, cursor, sessionCursor, safeLimit);
        }

        return resolveSession(userId, sessionId, ENDPOINT_TOPIC, topicId, false)
                .flatMap(context -> withSessionLock(userId, context.session(), () -> buildTopicPage(userId, context, safeLimit, topicId)));
    }

    public Mono<PageResult<ArticleCardDto>> getLatest(
            String userId,
            String sessionId,
            Long cursor,
            Long sessionCursor,
            int limit
    ) {
        int safeLimit = normalizeLimit(limit);
        if (sessionId == null && sessionCursor != null) {
            return legacyGetLatest(userId, cursor, sessionCursor, safeLimit);
        }

        return resolveSession(userId, sessionId, ENDPOINT_LATEST, null, false)
                .flatMap(context -> withSessionLock(userId, context.session(), () -> buildLatestPage(userId, context, safeLimit)));
    }

    public Mono<Void> trackViews(String userId, List<String> articleIds) {
        if (articleIds == null || articleIds.isEmpty()) {
            return Mono.empty();
        }
        return feedRepository.markArticlesAsViewed(userId, articleIds).then();
    }

    private Mono<PageResult<ArticleCardDto>> buildPersonalizedPage(String userId, ResolvedSessionContext context, int limit) {
        FeedSession session = context.session();
        PageAccumulator initial = PageAccumulator.empty(session.getScrollCursor());

        Mono<PageAccumulator> primaryMono = context.topics().isEmpty()
                ? Mono.just(initial.markPrimaryExhausted())
                : loadPersonalizedInitialCandidates(context)
                        .flatMap(candidates -> consumeAndAdvance(userId, candidates, limit, initial, injectPageCap(limit))
                                .flatMap(accumulator -> seekPersonalizedScroll(userId, context, limit, accumulator, accumulator.nextSeekCursor(), 1)));

        return primaryMono.flatMap(primary -> {
            if (primary.isFull(limit) || !primary.primaryExhausted()) {
                return finalizePage(session, primary, context.warnings(), limit);
            }

            long fallbackSeekCursor = primary.nextSeekCursor() != null
                    ? primary.nextSeekCursor()
                    : Math.min(session.getScrollCursor(), session.getSessionAnchor());
            return seekCountryFallback(userId, session, context.countryId(), limit, primary, fallbackSeekCursor, 0)
                    .flatMap(result -> finalizePage(session, result, context.warnings(), limit));
        });
    }

    private Mono<PageResult<ArticleCardDto>> buildTopicPage(String userId, ResolvedSessionContext context, int limit, String topicId) {
        FeedSession session = context.session();
        Mono<List<FeedCandidate>> initialCandidatesMono = Mono.zip(
                        feedRepository.getNewArticlesByCountryAndTopic(
                                        context.countryId(),
                                        topicId,
                                        session.getSessionAnchor(),
                                        injectPageCap(limit) + feedProperties.getInjectPerTopic())
                                .collectList(),
                        loadTopicScrollCandidates(context.countryId(), topicId, session.getSessionAnchor(), session.getScrollCursor(), scrollBatchLimit(limit))
                                .collectList())
                .map(tuple -> mergeSimpleCandidates(tuple.getT1(), tuple.getT2(), FeedCandidateSource.PRIMARY));

        return initialCandidatesMono
                .flatMap(candidates -> consumeAndAdvance(userId, candidates, limit, PageAccumulator.empty(session.getScrollCursor()), injectPageCap(limit))
                        .flatMap(accumulator -> seekTopicScroll(userId, context, topicId, limit, accumulator, accumulator.nextSeekCursor(), 1)))
                .flatMap(result -> finalizePage(session, result.markFallbackExhausted(), context.warnings(), limit));
    }

    private Mono<PageResult<ArticleCardDto>> buildLatestPage(String userId, ResolvedSessionContext context, int limit) {
        FeedSession session = context.session();
        Mono<List<FeedCandidate>> initialCandidatesMono = Mono.zip(
                        feedRepository.getNewArticlesByCountry(
                                        context.countryId(),
                                        session.getSessionAnchor(),
                                        injectPageCap(limit) + feedProperties.getInjectPerTopic())
                                .collectList(),
                        loadCountryScrollCandidates(context.countryId(), session.getSessionAnchor(), session.getScrollCursor(), scrollBatchLimit(limit))
                                .collectList())
                .map(tuple -> mergeSimpleCandidates(tuple.getT1(), tuple.getT2(), FeedCandidateSource.PRIMARY));

        return initialCandidatesMono
                .flatMap(candidates -> consumeAndAdvance(userId, candidates, limit, PageAccumulator.empty(session.getScrollCursor()), injectPageCap(limit))
                        .flatMap(accumulator -> seekLatestScroll(userId, context, limit, accumulator, accumulator.nextSeekCursor(), 1)))
                .flatMap(result -> finalizePage(session, result.markFallbackExhausted(), context.warnings(), limit));
    }

    private Mono<PageAccumulator> seekPersonalizedScroll(
            String userId,
            ResolvedSessionContext context,
            int limit,
            PageAccumulator accumulator,
            Long seekCursor,
            int iteration
    ) {
        if (accumulator.isFull(limit) || seekCursor == null || iteration > feedProperties.getSeekMaxIterations()) {
            return Mono.just(seekCursor == null ? accumulator.markPrimaryExhausted() : accumulator);
        }

        return loadPersonalizedScrollCandidates(context, seekCursor)
                .flatMap(candidates -> {
                    if (candidates.isEmpty()) {
                        return Mono.just(accumulator.markPrimaryExhausted());
                    }

                    return consumeAndAdvance(userId, candidates, limit, accumulator, injectPageCap(limit))
                            .flatMap(next -> {
                                if (next.isFull(limit)) {
                                    return Mono.just(next);
                                }
                                if (next.nextSeekCursor() == null || next.nextSeekCursor() >= seekCursor) {
                                    return Mono.just(next.markPrimaryExhausted());
                                }
                                return seekPersonalizedScroll(userId, context, limit, next, next.nextSeekCursor(), iteration + 1);
                            });
                });
    }

    private Mono<PageAccumulator> seekTopicScroll(
            String userId,
            ResolvedSessionContext context,
            String topicId,
            int limit,
            PageAccumulator accumulator,
            Long seekCursor,
            int iteration
    ) {
        if (accumulator.isFull(limit) || seekCursor == null || iteration > feedProperties.getSeekMaxIterations()) {
            return Mono.just(seekCursor == null ? accumulator.markPrimaryExhausted() : accumulator);
        }

        return loadTopicScrollCandidates(context.countryId(), topicId, context.session().getSessionAnchor(), seekCursor, scrollBatchLimit(limit))
                .collectList()
                .flatMap(scroll -> {
                    if (scroll.isEmpty()) {
                        return Mono.just(accumulator.markPrimaryExhausted());
                    }

                    return consumeAndAdvance(userId, wrapScrollCandidates(scroll, FeedCandidateSource.PRIMARY), limit, accumulator, injectPageCap(limit))
                            .flatMap(next -> {
                                if (next.isFull(limit)) {
                                    return Mono.just(next);
                                }
                                if (next.nextSeekCursor() == null || next.nextSeekCursor() >= seekCursor) {
                                    return Mono.just(next.markPrimaryExhausted());
                                }
                                return seekTopicScroll(userId, context, topicId, limit, next, next.nextSeekCursor(), iteration + 1);
                            });
                });
    }

    private Mono<PageAccumulator> seekLatestScroll(
            String userId,
            ResolvedSessionContext context,
            int limit,
            PageAccumulator accumulator,
            Long seekCursor,
            int iteration
    ) {
        if (accumulator.isFull(limit) || seekCursor == null || iteration > feedProperties.getSeekMaxIterations()) {
            return Mono.just(seekCursor == null ? accumulator.markPrimaryExhausted() : accumulator);
        }

        return loadCountryScrollCandidates(context.countryId(), context.session().getSessionAnchor(), seekCursor, scrollBatchLimit(limit))
                .collectList()
                .flatMap(scroll -> {
                    if (scroll.isEmpty()) {
                        return Mono.just(accumulator.markPrimaryExhausted());
                    }

                    return consumeAndAdvance(userId, wrapScrollCandidates(scroll, FeedCandidateSource.PRIMARY), limit, accumulator, injectPageCap(limit))
                            .flatMap(next -> {
                                if (next.isFull(limit)) {
                                    return Mono.just(next);
                                }
                                if (next.nextSeekCursor() == null || next.nextSeekCursor() >= seekCursor) {
                                    return Mono.just(next.markPrimaryExhausted());
                                }
                                return seekLatestScroll(userId, context, limit, next, next.nextSeekCursor(), iteration + 1);
                            });
                });
    }

    private Mono<PageAccumulator> seekCountryFallback(
            String userId,
            FeedSession session,
            int countryId,
            int limit,
            PageAccumulator accumulator,
            Long seekCursor,
            int iteration
    ) {
        if (accumulator.isFull(limit) || seekCursor == null || iteration > feedProperties.getSeekMaxIterations()) {
            return Mono.just(seekCursor == null ? accumulator.markFallbackExhausted() : accumulator);
        }

        return loadCountryScrollCandidates(countryId, session.getSessionAnchor(), seekCursor, scrollBatchLimit(limit))
                .collectList()
                .flatMap(scroll -> {
                    if (scroll.isEmpty()) {
                        return Mono.just(accumulator.markFallbackExhausted());
                    }

                    return consumeAndAdvance(userId, wrapScrollCandidates(scroll, FeedCandidateSource.FALLBACK), limit, accumulator, injectPageCap(limit))
                            .flatMap(next -> {
                                if (next.isFull(limit)) {
                                    return Mono.just(next);
                                }
                                if (next.nextSeekCursor() == null || next.nextSeekCursor() >= seekCursor) {
                                    return Mono.just(next.markFallbackExhausted());
                                }
                                return seekCountryFallback(userId, session, countryId, limit, next, next.nextSeekCursor(), iteration + 1);
                            });
                });
    }

    private Mono<PageAccumulator> consumeAndAdvance(
            String userId,
            List<FeedCandidate> candidates,
            int limit,
            PageAccumulator accumulator,
            int injectPageCap
    ) {
        int remaining = limit - accumulator.items().size();
        if (remaining <= 0 || candidates.isEmpty()) {
            return Mono.just(accumulator);
        }

        LinkedHashSet<String> orderedIds = candidates.stream()
                .map(FeedCandidate::id)
                .filter(id -> !accumulator.fetchedCandidateIds().contains(id))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (orderedIds.isEmpty()) {
            Long nextSeekCursor = candidates.stream()
                    .filter(candidate -> candidate.bucket() == FeedCandidateBucket.SCROLL)
                    .map(candidate -> (long) candidate.rawScore())
                    .min(Long::compareTo)
                    .orElse(null);
            return Mono.just(accumulator.withNextSeekCursor(nextSeekCursor));
        }

        List<FeedCandidate> orderedCandidates = orderedIds.stream()
                .map(id -> candidates.stream().filter(candidate -> candidate.id().equals(id)).findFirst().orElseThrow())
                .toList();
        int injectBudget = Math.max(0, injectPageCap - accumulator.injectServedCount());

        return feedRepository.getUnseenArticleIds(userId, new ArrayList<>(orderedIds))
                .flatMap(unseenIds -> {
                    Set<String> unseenSet = Set.copyOf(unseenIds);
                    List<FeedCandidate> eligible = new ArrayList<>();
                    int injectAccepted = 0;
                    for (FeedCandidate candidate : orderedCandidates) {
                        if (!unseenSet.contains(candidate.id())) {
                            continue;
                        }
                        if (candidate.bucket() == FeedCandidateBucket.INJECT) {
                            if (injectAccepted >= injectBudget) {
                                continue;
                            }
                            injectAccepted++;
                        }
                        eligible.add(candidate);
                    }

                    return Flux.fromIterable(eligible)
                            .concatMap(candidate -> hydrateCandidate(candidate)
                                    .map(dto -> new ServedFeedItem(candidate, dto)))
                            .take(remaining)
                            .collectList()
                            .map(served -> {
                                Long nextSeekCursor = orderedCandidates.stream()
                                        .filter(candidate -> candidate.bucket() == FeedCandidateBucket.SCROLL)
                                        .map(candidate -> (long) candidate.rawScore())
                                        .min(Long::compareTo)
                                        .orElse(null);
                                return accumulator.merge(served, orderedIds, nextSeekCursor);
                            });
                });
    }

    private Mono<ArticleCardDto> hydrateCandidate(FeedCandidate candidate) {
        return feedRepository.getArticleMetadataWithFallback(candidate.id())
                .map(map -> {
                    ArticleCardDto dto = mapToDto(candidate.id(), map);
                    dto.setScore(candidate.rawScore());
                    return dto;
                });
    }

    private Mono<PageResult<ArticleCardDto>> finalizePage(
            FeedSession session,
            PageAccumulator accumulator,
            List<String> warnings,
            int limit
    ) {
        List<ServedFeedItem> sortedItems = accumulator.items().stream()
                .sorted(Comparator.comparingDouble((ServedFeedItem item) -> item.candidate().rawScore()).reversed())
                .limit(limit)
                .toList();
        List<ArticleCardDto> pageItems = sortedItems.stream().map(ServedFeedItem::dto).toList();
        List<String> servedIds = pageItems.stream().map(ArticleCardDto::getId).toList();
        long updatedScrollCursor = sortedItems.stream()
                .filter(item -> item.candidate().bucket() == FeedCandidateBucket.SCROLL)
                .map(item -> (long) item.candidate().rawScore())
                .min(Long::compareTo)
                .orElse(session.getScrollCursor());

        FeedSession updatedSession = session.toBuilder()
                .scrollCursor(updatedScrollCursor)
                .lastAccessAt(System.currentTimeMillis())
                .build();

        PageResult<ArticleCardDto> page = new PageResult<>(pageItems, nextCursorForCompatibility(pageItems));
        return feedRepository.markArticlesAsViewed(session.getUserId(), servedIds)
                .then(feedRepository.saveFeedSession(updatedSession))
                .map(saved -> enrichPage(page, saved, accumulator, warnings));
    }

    private Mono<PageResult<ArticleCardDto>> withSessionLock(String userId, FeedSession session, java.util.function.Supplier<Mono<PageResult<ArticleCardDto>>> action) {
        String lockToken = UUID.randomUUID().toString();
        return feedRepository.acquireFeedBuildLock(userId, session.getSessionId(), lockToken, SESSION_LOCK_TTL)
                .flatMap(acquired -> {
                    if (!acquired) {
                        return Mono.error(new CustomExceptions.FeedRequestInProgressException(session.getSessionId()));
                    }

                    return Mono.usingWhen(
                            Mono.just(lockToken),
                            ignored -> action.get(),
                            ignored -> feedRepository.releaseFeedBuildLock(userId, session.getSessionId(), lockToken).then(),
                            (ignored, error) -> feedRepository.releaseFeedBuildLock(userId, session.getSessionId(), lockToken).then(),
                            ignored -> feedRepository.releaseFeedBuildLock(userId, session.getSessionId(), lockToken).then()
                    );
                });
    }

    private FeedCandidateSource resolveSource(PageAccumulator accumulator) {
        boolean primary = accumulator.items().stream().anyMatch(item -> item.candidate().source() == FeedCandidateSource.PRIMARY);
        boolean fallback = accumulator.items().stream().anyMatch(item -> item.candidate().source() == FeedCandidateSource.FALLBACK);
        if (primary && fallback) {
            return FeedCandidateSource.FALLBACK;
        }
        return fallback ? FeedCandidateSource.FALLBACK : FeedCandidateSource.PRIMARY;
    }

    private PageResult<ArticleCardDto> enrichPage(
            PageResult<ArticleCardDto> page,
            FeedSession session,
            PageAccumulator accumulator,
            List<String> warnings
    ) {
        boolean primary = accumulator.items().stream().anyMatch(item -> item.candidate().source() == FeedCandidateSource.PRIMARY);
        boolean fallback = accumulator.items().stream().anyMatch(item -> item.candidate().source() == FeedCandidateSource.FALLBACK);
        String source = primary && fallback ? "mixed" : fallback ? "fallback" : "primary";

        page.setSessionId(session.getSessionId());
        page.setSessionAnchor(session.getSessionAnchor());
        page.setSessionCursor(session.getSessionAnchor());
        page.setNextScrollCursor(session.getScrollCursor());
        page.setSource(source);
        page.setHasMore(!(accumulator.primaryExhausted() && accumulator.fallbackExhausted()));
        page.setNewSinceLastSession(accumulator.newSinceLastSession());
        page.setWarnings(warnings);
        return page;
    }

    private Mono<List<FeedCandidate>> loadPersonalizedInitialCandidates(ResolvedSessionContext context) {
        return feedRepository.aggregatePersonalizedCandidates(
                context.countryId(),
                context.topics(),
                context.session().getSessionAnchor(),
                context.session().getScrollCursor(),
                feedProperties.getInjectPerTopic(),
                feedProperties.getScrollPerTopic(),
                true
        );
    }

    private Mono<List<FeedCandidate>> loadPersonalizedScrollCandidates(ResolvedSessionContext context, long seekCursor) {
        return feedRepository.aggregatePersonalizedCandidates(
                context.countryId(),
                context.topics(),
                context.session().getSessionAnchor(),
                seekCursor,
                0,
                feedProperties.getScrollPerTopic(),
                false
        );
    }

    private Flux<ScoredArticle> loadTopicScrollCandidates(int countryId, String topicId, long sessionAnchor, long seekCursor, int limit) {
        double upperBound = Math.min(seekCursor, sessionAnchor);
        return feedRepository.getArticleIdsByCountryAndTopicWithScores(countryId, topicId, upperBound, limit);
    }

    private Flux<ScoredArticle> loadCountryScrollCandidates(int countryId, long sessionAnchor, long seekCursor, int limit) {
        double upperBound = Math.min(seekCursor, sessionAnchor);
        return feedRepository.getArticleIdsByCountryWithScores(countryId, upperBound, limit);
    }

    private List<FeedCandidate> mergeSimpleCandidates(
            List<ScoredArticle> injectCandidates,
            List<ScoredArticle> scrollCandidates,
            FeedCandidateSource source
    ) {
        List<FeedCandidate> merged = new ArrayList<>();
        merged.addAll(wrapInjectCandidates(injectCandidates, source));
        merged.addAll(wrapScrollCandidates(scrollCandidates, source));
        merged.sort(Comparator.comparingDouble(FeedCandidate::rawScore).reversed());
        return merged;
    }

    private List<FeedCandidate> wrapInjectCandidates(List<ScoredArticle> articles, FeedCandidateSource source) {
        return articles.stream()
                .map(article -> new FeedCandidate(article.id(), article.score(), article.score(), FeedCandidateBucket.INJECT, source))
                .toList();
    }

    private List<FeedCandidate> wrapScrollCandidates(List<ScoredArticle> articles, FeedCandidateSource source) {
        return articles.stream()
                .map(article -> new FeedCandidate(article.id(), article.score(), article.score(), FeedCandidateBucket.SCROLL, source))
                .toList();
    }

    private Mono<PageResult<ArticleCardDto>> legacyGenerateFeed(String userId, Long cursor, Long sessionCursor, int limit) {
        double safeCursor = normalizeLegacyCursor(cursor);
        double safeSessionCursor = normalizeLegacySessionCursor(cursor, sessionCursor);

        Mono<List<String>> topicsMono = feedRepository.getUserTopics(userId);
        Mono<Integer> countryMono = feedRepository.getUserCountryId(userId);

        return Mono.zip(topicsMono, countryMono)
                .flatMap(prefs -> {
                    List<String> topics = prefs.getT1();
                    int countryId = prefs.getT2();

                    Mono<List<ScoredArticle>> olderMono = Flux.fromIterable(topics)
                            .flatMap(topic -> feedRepository.getArticleIdsByCountryAndTopicWithScores(countryId, topic, safeCursor, limit * 3))
                            .collectList();

                    Mono<List<ScoredArticle>> newerMono = Flux.fromIterable(topics)
                            .flatMap(topic -> feedRepository.getNewArticlesByCountryAndTopic(countryId, topic, safeSessionCursor, limit * 3))
                            .collectList();

                    return Mono.zip(olderMono, newerMono).flatMap(tuple -> {
                        List<ScoredArticle> primary = new ArrayList<>(tuple.getT1());
                        primary.addAll(tuple.getT2());
                        if (!primary.isEmpty()) {
                            return buildLegacyPage(userId, primary, limit, (long) safeSessionCursor);
                        }

                        return Mono.zip(
                                        feedRepository.getArticleIdsByCountryWithScores(countryId, safeCursor, limit * 4).collectList(),
                                        feedRepository.getNewArticlesByCountry(countryId, safeSessionCursor, limit * 4).collectList())
                                .flatMap(fallback -> {
                                    List<ScoredArticle> all = new ArrayList<>(fallback.getT1());
                                    all.addAll(fallback.getT2());
                                    return buildLegacyPage(userId, all, limit, (long) safeSessionCursor);
                                });
                    });
                });
    }

    private Mono<PageResult<ArticleCardDto>> legacyGetByTopic(String userId, String topicId, Long cursor, Long sessionCursor, int limit) {
        double safeCursor = normalizeLegacyCursor(cursor);
        double safeSessionCursor = normalizeLegacySessionCursor(cursor, sessionCursor);

        return feedRepository.getUserCountryId(userId).flatMap(countryId -> Mono.zip(
                        feedRepository.getArticleIdsByCountryAndTopicWithScores(countryId, topicId, safeCursor, limit * 3).collectList(),
                        feedRepository.getNewArticlesByCountryAndTopic(countryId, topicId, safeSessionCursor, limit * 3).collectList())
                .flatMap(tuple -> {
                    List<ScoredArticle> all = new ArrayList<>(tuple.getT1());
                    all.addAll(tuple.getT2());
                    return buildLegacyPage(userId, all, limit, (long) safeSessionCursor);
                }));
    }

    private Mono<PageResult<ArticleCardDto>> legacyGetLatest(String userId, Long cursor, Long sessionCursor, int limit) {
        double safeCursor = normalizeLegacyCursor(cursor);
        double safeSessionCursor = normalizeLegacySessionCursor(cursor, sessionCursor);

        return feedRepository.getUserCountryId(userId).flatMap(countryId -> Mono.zip(
                        feedRepository.getArticleIdsByCountryWithScores(countryId, safeCursor, limit * 3).collectList(),
                        feedRepository.getNewArticlesByCountry(countryId, safeSessionCursor, limit * 3).collectList())
                .flatMap(tuple -> {
                    List<ScoredArticle> all = new ArrayList<>(tuple.getT1());
                    all.addAll(tuple.getT2());
                    return buildLegacyPage(userId, all, limit, (long) safeSessionCursor);
                }));
    }

    private Mono<ResolvedSessionContext> resolveSession(
            String userId,
            String requestedSessionId,
            String endpointKind,
            String topicParam,
            boolean loadTopics
    ) {
        Mono<Integer> countryMono = feedRepository.getUserCountryId(userId);
        Mono<Long> prefsVersionMono = loadTopics ? feedRepository.getUserTopicPrefsVersion(userId) : Mono.just(0L);
        Mono<List<String>> topicsMono = loadTopics ? feedRepository.getUserTopics(userId).defaultIfEmpty(List.of()) : Mono.just(List.of());

        return Mono.zip(countryMono, prefsVersionMono, topicsMono)
                .flatMap(tuple -> {
                    int countryId = tuple.getT1();
                    long prefsVersion = tuple.getT2();
                    List<String> rawTopics = tuple.getT3() == null ? List.of() : tuple.getT3();
                    List<String> warnings = new ArrayList<>();
                    List<String> topics = rawTopics;
                    if (rawTopics.size() > feedProperties.getMaxTopicsPerRequest()) {
                        topics = rawTopics.subList(0, feedProperties.getMaxTopicsPerRequest());
                        warnings.add(WARNING_TOPICS_TRUNCATED);
                    }

                    String scopeFingerprint = buildScopeFingerprint(endpointKind, countryId, topicParam, prefsVersion, DEFAULT_WEIGHT_CONFIG_VERSION);
                    Mono<FeedSession> existingMono = requestedSessionId == null
                            ? Mono.empty()
                            : feedRepository.findFeedSession(userId, requestedSessionId)
                                    .filter(session -> isSessionUsable(session, userId, scopeFingerprint));

                    List<String> finalTopics = List.copyOf(topics);
                    List<String> finalWarnings = List.copyOf(warnings);
                    return existingMono
                            .switchIfEmpty(createSession(userId, endpointKind, countryId, topicParam, scopeFingerprint, finalTopics))
                            .map(session -> new ResolvedSessionContext(session, countryId, finalTopics, finalWarnings));
                });
    }

    private boolean isSessionUsable(FeedSession session, String userId, String scopeFingerprint) {
        if (session == null) {
            return false;
        }
        if (!userId.equals(session.getUserId())) {
            return false;
        }
        if (!scopeFingerprint.equals(session.getScopeFingerprint())) {
            return false;
        }
        long now = System.currentTimeMillis();
        return session.getLastAccessAt() != null && now - session.getLastAccessAt() <= SESSION_IDLE_THRESHOLD.toMillis();
    }

    private Mono<FeedSession> createSession(
            String userId,
            String endpointKind,
            int countryId,
            String topicParam,
            String scopeFingerprint,
            List<String> topics
    ) {
        Mono<Long> anchorMono;
        if (ENDPOINT_TOPIC.equals(endpointKind)) {
            anchorMono = feedRepository.getTopScoreByCountryAndTopicWithScores(countryId, topicParam)
                    .map(Double::longValue);
        } else if (ENDPOINT_LATEST.equals(endpointKind)) {
            anchorMono = feedRepository.getTopScoreByCountryWithScores(countryId)
                    .map(Double::longValue);
        } else if (topics == null || topics.isEmpty()) {
            anchorMono = feedRepository.getTopScoreByCountryWithScores(countryId)
                    .map(Double::longValue);
        } else {
            anchorMono = Flux.fromIterable(topics)
                    .flatMap(topic -> feedRepository.getTopScoreByCountryAndTopicWithScores(countryId, topic))
                    .reduce(0.0, Math::max)
                    .map(Double::longValue);
        }

        return anchorMono.flatMap(anchor -> {
            long now = System.currentTimeMillis();
            FeedSession session = FeedSession.builder()
                    .sessionId(UUID.randomUUID().toString())
                    .userId(userId)
                    .scopeFingerprint(scopeFingerprint)
                    .endpointKind(endpointKind)
                    .countryId(countryId)
                    .topicParam(topicParam)
                    .sessionAnchor(anchor)
                    .scrollCursor(Long.MAX_VALUE)
                    .createdAt(now)
                    .lastAccessAt(now)
                    .build();
            return feedRepository.saveFeedSession(session);
        });
    }

    private Mono<PageResult<ArticleCardDto>> buildLegacyPage(String userId, List<ScoredArticle> candidates, int limit, long sessionCursorOut) {
        return buildLegacyBasePage(userId, candidates, limit)
                .map(page -> {
                    page.setSessionCursor(sessionCursorOut);
                    return page;
                });
    }

    private Mono<PageResult<ArticleCardDto>> buildLegacyBasePage(String userId, List<ScoredArticle> candidates, int limit) {
        if (candidates.isEmpty()) {
            return Mono.just(new PageResult<>(List.of(), null));
        }

        Map<String, Double> best = candidates.stream()
                .collect(Collectors.toMap(
                        ScoredArticle::id,
                        ScoredArticle::score,
                        Math::max,
                        java.util.LinkedHashMap::new));

        List<ScoredArticle> sorted = best.entrySet().stream()
                .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                .map(entry -> new ScoredArticle(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());

        List<String> candidateIds = sorted.stream().map(ScoredArticle::id).toList();
        return feedRepository.getUnseenArticleIds(userId, candidateIds).flatMap(unseenIds -> {
            if (unseenIds.isEmpty()) {
                return Mono.just(new PageResult<>(List.of(), null));
            }

            Set<String> unseenSet = Set.copyOf(unseenIds);
            List<ScoredArticle> filtered = sorted.stream()
                    .filter(article -> unseenSet.contains(article.id()))
                    .toList();

            return Flux.fromIterable(filtered)
                    .concatMap(scoredArticle -> feedRepository.getArticleMetadataWithFallback(scoredArticle.id())
                            .map(map -> {
                                ArticleCardDto dto = mapToDto(scoredArticle.id(), map);
                                dto.setScore(scoredArticle.score());
                                return dto;
                            }))
                    .take(limit)
                    .collectList()
                    .map(hydrated -> {
                        Long nextCursor = hydrated.isEmpty()
                                ? null
                                : (long) hydrated.stream().mapToDouble(ArticleCardDto::getScore).min().orElse(0);
                        return new PageResult<>(hydrated, nextCursor);
                    });
        });
    }

    private ArticleCardDto mapToDto(String id, Map<String, String> map) {
        ArticleCardDto dto = objectMapper.convertValue(map, ArticleCardDto.class);
        dto.setId(id);
        return dto;
    }

    private Long nextCursorForCompatibility(List<ArticleCardDto> pageItems) {
        return pageItems.isEmpty()
                ? null
                : (long) pageItems.stream().mapToDouble(ArticleCardDto::getScore).min().orElse(0);
    }

    private int injectPageCap(int limit) {
        return Math.min(feedProperties.getInjectPageMax(), Math.max(0, limit / 2));
    }

    private int scrollBatchLimit(int limit) {
        return Math.max(feedProperties.getScrollPerTopic(), (int) Math.ceil(limit * feedProperties.getScrollBatchMultiplier()));
    }

    private int normalizeLimit(int limit) {
        return Math.min(50, Math.max(5, limit));
    }

    private double normalizeLegacyCursor(Long cursor) {
        long rawCursor = (cursor == null || cursor == 0) ? System.currentTimeMillis() : cursor;
        return rawCursor > 20_000_000_000L ? rawCursor / 1000.0 : (double) rawCursor;
    }

    private double normalizeLegacySessionCursor(Long cursor, Long sessionCursor) {
        boolean isFirstPage = (sessionCursor == null || cursor == null || cursor == 0);
        if (isFirstPage) {
            return normalizeLegacyCursor(cursor);
        }
        return sessionCursor > 20_000_000_000L ? sessionCursor / 1000.0 : (double) sessionCursor;
    }

    private String buildScopeFingerprint(
            String endpointKind,
            int countryId,
            String topicParam,
            long userPrefVersion,
            int weightConfigVersion
    ) {
        String raw = endpointKind + "|" + countryId + "|" + topicParam + "|" + userPrefVersion + "|" + weightConfigVersion;
        return UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8)).toString();
    }

    private record ResolvedSessionContext(FeedSession session, int countryId, List<String> topics, List<String> warnings) {
    }

    private record ServedFeedItem(FeedCandidate candidate, ArticleCardDto dto) {
    }

    private record PageAccumulator(
            List<ServedFeedItem> items,
            Set<String> fetchedCandidateIds,
            Long nextSeekCursor,
            boolean primaryExhausted,
            boolean fallbackExhausted,
            int injectServedCount,
            int newSinceLastSession
    ) {
        private static PageAccumulator empty(long initialSeekCursor) {
            return new PageAccumulator(List.of(), Set.of(), initialSeekCursor, false, false, 0, 0);
        }

        private PageAccumulator merge(List<ServedFeedItem> served, Set<String> fetchedIds, Long updatedSeekCursor) {
            List<ServedFeedItem> mergedItems = new ArrayList<>(items);
            mergedItems.addAll(served);
            Set<String> mergedFetchedIds = new LinkedHashSet<>(fetchedCandidateIds);
            mergedFetchedIds.addAll(fetchedIds);
            int mergedInjectServed = injectServedCount + (int) served.stream()
                    .filter(item -> item.candidate().bucket() == FeedCandidateBucket.INJECT)
                    .count();
            int mergedNewSinceLastSession = newSinceLastSession + (int) served.stream()
                    .filter(item -> item.candidate().bucket() == FeedCandidateBucket.INJECT && item.candidate().source() == FeedCandidateSource.PRIMARY)
                    .count();
            return new PageAccumulator(
                    List.copyOf(mergedItems),
                    Set.copyOf(mergedFetchedIds),
                    updatedSeekCursor,
                    primaryExhausted,
                    fallbackExhausted,
                    mergedInjectServed,
                    mergedNewSinceLastSession
            );
        }

        private boolean isFull(int limit) {
            return items.size() >= limit;
        }

        private PageAccumulator withNextSeekCursor(Long updatedSeekCursor) {
            return new PageAccumulator(items, fetchedCandidateIds, updatedSeekCursor, primaryExhausted, fallbackExhausted, injectServedCount, newSinceLastSession);
        }

        private PageAccumulator markPrimaryExhausted() {
            return new PageAccumulator(items, fetchedCandidateIds, nextSeekCursor, true, fallbackExhausted, injectServedCount, newSinceLastSession);
        }

        private PageAccumulator markFallbackExhausted() {
            return new PageAccumulator(items, fetchedCandidateIds, nextSeekCursor, primaryExhausted, true, injectServedCount, newSinceLastSession);
        }
    }
}
