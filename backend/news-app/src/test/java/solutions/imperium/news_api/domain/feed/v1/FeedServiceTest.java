package solutions.imperium.news_api.domain.feed.v1;

import solutions.imperium.news_api.domain.feed.v1.FeedRepository;
import solutions.imperium.news_api.domain.feed.v1.FeedProperties;
import solutions.imperium.news_api.domain.feed.v1.FeedService;
import solutions.imperium.news_api.domain.feed.v1.FeedSession;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidate;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidateBucket;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidateSource;
import solutions.imperium.news_api.domain.feed.v1.ScoredArticle;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import solutions.imperium.news_api.domain.article.ArticlePostgresRepository;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.exception.CustomExceptions;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeedServiceTest {

    @Mock
    private FeedRepository feedRepository;

    @Mock
    private ArticlePostgresRepository articlePostgresRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @Spy
    private FeedProperties feedProperties = new FeedProperties();

    @InjectMocks
    private FeedService feedService;

    @Test
    void testGenerateFeed_CreatesSessionAndReturnsV2Fields() {
        String userId = "user123";

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(7L));
        when(feedRepository.getTopScoreByCountryAndTopicWithScores(1, "tech")).thenReturn(Mono.just(1500.0));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), anyString(), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), anyString(), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1500L), eq(Long.MAX_VALUE), anyInt(), anyInt(), eq(true)))
                .thenReturn(Mono.just(List.of(
                        new FeedCandidate("art1", 1700.0, 1700.0, FeedCandidateBucket.INJECT, FeedCandidateSource.PRIMARY),
                        new FeedCandidate("art2", 1200.0, 1200.0, FeedCandidateBucket.SCROLL, FeedCandidateSource.PRIMARY),
                        new FeedCandidate("art3", 1000.0, 1000.0, FeedCandidateBucket.SCROLL, FeedCandidateSource.PRIMARY))));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1500L), eq(1000L), anyInt(), anyInt(), eq(false)))
                .thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), anyDouble(), anyInt())).thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("art2", "art3")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(2L));
        when(feedRepository.getArticleMetadataWithFallback("art2")).thenReturn(Mono.just(Map.of("title", "Title 2", "published_at", "1200")));
        when(feedRepository.getArticleMetadataWithFallback("art3")).thenReturn(Mono.just(Map.of("title", "Title 3", "published_at", "1000")));

        StepVerifier.create(feedService.generateFeed(userId, null, 2000L, null, 2))
                .expectNextMatches(page -> {
                    boolean correctSize = page.getData().size() == 2;
                    boolean filteredArt1 = page.getData().stream().noneMatch(a -> a.getId().equals("art1"));
                    boolean sortedDesc = page.getData().get(0).getId().equals("art2");
                    boolean cursorSet = page.getNextCursor() == 1000L;
                    boolean sessionFieldsSet = page.getSessionId() != null
                            && page.getSessionAnchor() == 1500L
                            && page.getSessionCursor() == 1500L
                            && page.getNextScrollCursor() == 1000L
                            && "primary".equals(page.getSource())
                            && Boolean.FALSE.equals(page.getHasMore());
                    return correctSize && filteredArt1 && sortedDesc && cursorSet && sessionFieldsSet;
                })
                .verifyComplete();
    }

    @Test
    void testGenerateFeed_ReusesValidSessionAndIgnoresClientCursor() {
        String userId = "user456";
        FeedSession session = FeedSession.builder()
                .sessionId("sess-1")
                .userId(userId)
                .scopeFingerprint(scope("feed|1|null|0|0"))
                .endpointKind("feed")
                .countryId(1)
                .sessionAnchor(1800L)
                .scrollCursor(1500L)
                .createdAt(System.currentTimeMillis())
                .lastAccessAt(System.currentTimeMillis())
                .build();

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(0L));
        when(feedRepository.findFeedSession(userId, "sess-1")).thenReturn(Mono.just(session));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), eq("sess-1"), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), eq("sess-1"), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1800L), eq(1500L), anyInt(), anyInt(), eq(true)))
                .thenReturn(Mono.just(List.of(new FeedCandidate("art9", 1400.0, 1400.0, FeedCandidateBucket.SCROLL, FeedCandidateSource.PRIMARY))));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1800L), eq(1400L), anyInt(), anyInt(), eq(false)))
                .thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), anyDouble(), anyInt())).thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("art9")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(1L));
        when(feedRepository.getArticleMetadataWithFallback("art9")).thenReturn(Mono.just(Map.of("title", "Title 9", "published_at", "1400")));

        StepVerifier.create(feedService.generateFeed(userId, "sess-1", 999L, 888L, 10))
                .expectNextMatches(page ->
                        page.getData().size() == 1
                                && "sess-1".equals(page.getSessionId())
                                && page.getSessionAnchor() == 1800L
                                && page.getNextCursor() == 1400L)
                .verifyComplete();

        verify(feedRepository, never()).getTopScoreByCountryAndTopicWithScores(anyInt(), anyString());
    }

    @Test
    void testGenerateFeed_CountryFallback_WhenNoTopicsConfigured() {
        String userId = "user789";

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of()));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(0L));
        when(feedRepository.getTopScoreByCountryWithScores(1)).thenReturn(Mono.just(900.0));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), anyString(), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), anyString(), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), anyDouble(), anyInt()))
                .thenReturn(Flux.just(
                        new ScoredArticle("c1", 900.0),
                        new ScoredArticle("c2", 800.0)));
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("c1", "c2")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(2L));
        when(feedRepository.getArticleMetadataWithFallback("c1")).thenReturn(Mono.just(Map.of("title", "Country 1", "published_at", "900")));
        when(feedRepository.getArticleMetadataWithFallback("c2")).thenReturn(Mono.just(Map.of("title", "Country 2", "published_at", "800")));

        StepVerifier.create(feedService.generateFeed(userId, null, null, null, 2))
                .expectNextMatches(page ->
                        page.getData().size() == 2
                                && "fallback".equals(page.getSource())
                                && page.getSessionAnchor() == 900L
                                && page.getNextCursor() == 800L)
                .verifyComplete();
    }

    @Test
    void testGenerateFeed_LegacySessionCursorFlowStillWorksWithoutSessionId() {
        String userId = "legacy-user";

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getArticleIdsByCountryAndTopicWithScores(eq(1), eq("tech"), eq(2000.0), anyInt()))
                .thenReturn(Flux.just(new ScoredArticle("art2", 1200.0)));
        when(feedRepository.getNewArticlesByCountryAndTopic(eq(1), eq("tech"), eq(1700.0), anyInt()))
                .thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("art2")));
        when(feedRepository.getArticleMetadataWithFallback("art2")).thenReturn(Mono.just(Map.of("title", "Title 2", "published_at", "1200")));

        StepVerifier.create(feedService.generateFeed(userId, null, 2000L, 1700L, 10))
                .expectNextMatches(page ->
                        page.getData().size() == 1
                                && page.getSessionId() == null
                                && page.getSessionCursor() == 1700L
                                && page.getNextCursor() == 1200L)
                .verifyComplete();
    }

    @Test
    void testGetByTopic_ReturnsArticlesFromCountryTopicZSet() {
        String userId = "user1";
        String topicId = "business_economy";

        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(2));
        when(feedRepository.findFeedSession(userId, "topic-session")).thenReturn(Mono.just(
                FeedSession.builder()
                        .sessionId("topic-session")
                        .userId(userId)
                        .scopeFingerprint(scope("feed-topic|2|business_economy|0|0"))
                        .endpointKind("feed-topic")
                        .countryId(2)
                        .topicParam(topicId)
                        .sessionAnchor(1800L)
                        .scrollCursor(2000L)
                        .createdAt(System.currentTimeMillis())
                        .lastAccessAt(System.currentTimeMillis())
                        .build()));
        when(feedRepository.getTopScoreByCountryAndTopicWithScores(2, topicId)).thenReturn(Mono.just(1800.0));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), anyString(), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), anyString(), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.getArticleIdsByCountryAndTopicWithScores(eq(2), eq(topicId), anyDouble(), anyInt()))
                .thenReturn(Flux.just(new ScoredArticle("b1", 1800.0), new ScoredArticle("b2", 1700.0)));
        when(feedRepository.getNewArticlesByCountryAndTopic(eq(2), eq(topicId), eq(1800.0), anyInt()))
                .thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("b1", "b2")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(2L));
        when(feedRepository.getArticleMetadataWithFallback("b1")).thenReturn(Mono.just(Map.of("title", "Business 1", "published_at", "1800")));
        when(feedRepository.getArticleMetadataWithFallback("b2")).thenReturn(Mono.just(Map.of("title", "Business 2", "published_at", "1700")));

        StepVerifier.create(feedService.getByTopic(userId, topicId, "topic-session", 0L, null, 5))
                .expectNextMatches(page ->
                        page.getData().size() == 2
                                && page.getData().get(0).getId().equals("b1")
                                && page.getNextCursor() == 1700L)
                .verifyComplete();
    }

    @Test
    void testGetLatest_ReturnsArticlesFromCountryZSet() {
        String userId = "user2";

        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(3));
        when(feedRepository.findFeedSession(userId, "latest-session")).thenReturn(Mono.just(
                FeedSession.builder()
                        .sessionId("latest-session")
                        .userId(userId)
                        .scopeFingerprint(scope("feed-latest|3|null|0|0"))
                        .endpointKind("feed-latest")
                        .countryId(3)
                        .sessionAnchor(2000L)
                        .scrollCursor(3000L)
                        .createdAt(System.currentTimeMillis())
                        .lastAccessAt(System.currentTimeMillis())
                        .build()));
        when(feedRepository.getTopScoreByCountryWithScores(3)).thenReturn(Mono.just(2000.0));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), anyString(), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), anyString(), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(3), anyDouble(), anyInt()))
                .thenReturn(Flux.just(new ScoredArticle("l1", 2000.0), new ScoredArticle("l2", 1900.0)));
        when(feedRepository.getNewArticlesByCountry(eq(3), eq(2000.0), anyInt()))
                .thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("l1", "l2")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(2L));
        when(feedRepository.getArticleMetadataWithFallback("l1")).thenReturn(Mono.just(Map.of("title", "Latest 1", "published_at", "2000")));
        when(feedRepository.getArticleMetadataWithFallback("l2")).thenReturn(Mono.just(Map.of("title", "Latest 2", "published_at", "1900")));

        StepVerifier.create(feedService.getLatest(userId, "latest-session", 0L, null, 5))
                .expectNextMatches(page ->
                        page.getData().size() == 2
                                && page.getData().get(0).getId().equals("l1")
                                && page.getNextCursor() == 1900L)
                .verifyComplete();
    }

    @Test
    void testGenerateFeed_ReturnsConflictWhenSessionLockIsBusy() {
        String userId = "busy-user";
        FeedSession session = FeedSession.builder()
                .sessionId("busy-session")
                .userId(userId)
                .scopeFingerprint(scope("feed|1|null|0|0"))
                .endpointKind("feed")
                .countryId(1)
                .sessionAnchor(1800L)
                .scrollCursor(1500L)
                .createdAt(System.currentTimeMillis())
                .lastAccessAt(System.currentTimeMillis())
                .build();

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(0L));
        when(feedRepository.findFeedSession(userId, "busy-session")).thenReturn(Mono.just(session));
        when(feedRepository.acquireFeedBuildLock(eq(userId), eq("busy-session"), anyString(), any())).thenReturn(Mono.just(false));
        StepVerifier.create(feedService.generateFeed(userId, "busy-session", null, null, 10))
                .expectError(CustomExceptions.FeedRequestInProgressException.class)
                .verify();
    }

    @Test
    void testGenerateFeed_ReleasesSessionLockWhenWritebackFails() {
        String userId = "release-user";
        FeedSession session = FeedSession.builder()
                .sessionId("release-session")
                .userId(userId)
                .scopeFingerprint(scope("feed|1|null|0|0"))
                .endpointKind("feed")
                .countryId(1)
                .sessionAnchor(1800L)
                .scrollCursor(1500L)
                .createdAt(System.currentTimeMillis())
                .lastAccessAt(System.currentTimeMillis())
                .build();

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(0L));
        when(feedRepository.findFeedSession(userId, "release-session")).thenReturn(Mono.just(session));
        when(feedRepository.acquireFeedBuildLock(eq(userId), eq("release-session"), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), eq("release-session"), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1800L), eq(1500L), anyInt(), anyInt(), eq(true)))
                .thenReturn(Mono.just(List.of(new FeedCandidate("art9", 1400.0, 1400.0, FeedCandidateBucket.SCROLL, FeedCandidateSource.PRIMARY))));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1800L), eq(1400L), anyInt(), anyInt(), eq(false)))
                .thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), anyDouble(), anyInt())).thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("art9")));
        when(feedRepository.getArticleMetadataWithFallback("art9")).thenReturn(Mono.just(Map.of("title", "Title 9", "published_at", "1400")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.error(new IllegalStateException("writeback failed")));

        StepVerifier.create(feedService.generateFeed(userId, "release-session", null, null, 10))
                .expectError(IllegalStateException.class)
                .verify();

        verify(feedRepository, times(1)).releaseFeedBuildLock(eq(userId), eq("release-session"), anyString());
    }

    @Test
    void testGenerateFeed_HydratesFromFallbackMetadataSource() {
        String userId = "fallback-meta-user";

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(1L));
        when(feedRepository.getTopScoreByCountryAndTopicWithScores(1, "tech")).thenReturn(Mono.just(1500.0));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), anyString(), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), anyString(), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1500L), eq(Long.MAX_VALUE), anyInt(), anyInt(), eq(true)))
                .thenReturn(Mono.just(List.of(new FeedCandidate("art-pg", 1500.0, 1500.0, FeedCandidateBucket.SCROLL, FeedCandidateSource.PRIMARY))));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1500L), eq(1500L), anyInt(), anyInt(), eq(false)))
                .thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), anyDouble(), anyInt())).thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("art-pg")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(1L));
        when(feedRepository.getArticleMetadataWithFallback("art-pg"))
                .thenReturn(Mono.just(Map.of("title", "Postgres Title", "published_at", "1500", "excerpt", "Rewarmed")));

        StepVerifier.create(feedService.generateFeed(userId, null, null, null, 10))
                .expectNextMatches(page ->
                        page.getData().size() == 1
                                && page.getData().get(0).getId().equals("art-pg")
                                && page.getData().get(0).getTitle().equals("Postgres Title"))
                .verifyComplete();
    }

    @Test
    void testGenerateFeed_InjectOnlyPageDoesNotMoveScrollCursor() {
        String userId = "inject-only-user";

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(0L));
        when(feedRepository.getTopScoreByCountryAndTopicWithScores(1, "tech")).thenReturn(Mono.just(1500.0));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), anyString(), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), anyString(), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(List.of("tech")), eq(1500L), eq(Long.MAX_VALUE), anyInt(), anyInt(), eq(true)))
                .thenReturn(Mono.just(List.of(
                        new FeedCandidate("new-1", 1700.0, 1700.0, FeedCandidateBucket.INJECT, FeedCandidateSource.PRIMARY),
                        new FeedCandidate("new-2", 1600.0, 1600.0, FeedCandidateBucket.INJECT, FeedCandidateSource.PRIMARY))));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), anyDouble(), anyInt())).thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any())).thenReturn(Mono.just(List.of("new-1", "new-2")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(2L));
        when(feedRepository.getArticleMetadataWithFallback("new-1")).thenReturn(Mono.just(Map.of("title", "New 1", "published_at", "1700")));
        when(feedRepository.getArticleMetadataWithFallback("new-2")).thenReturn(Mono.just(Map.of("title", "New 2", "published_at", "1600")));

        StepVerifier.create(feedService.generateFeed(userId, null, null, null, 5))
                .expectNextMatches(page ->
                        page.getData().size() == 2
                                && page.getNextScrollCursor() == Long.MAX_VALUE
                                && page.getNextCursor() == 1600L)
                .verifyComplete();
    }

    @Test
    void testGenerateFeed_FallsBackWhenTopicsExhaustedAndMarksMixedSource() {
        String userId = "mixed-user";
        List<String> topics = List.of("tech");

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(topics));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getUserTopicPrefsVersion(userId)).thenReturn(Mono.just(0L));
        when(feedRepository.getTopScoreByCountryAndTopicWithScores(1, "tech")).thenReturn(Mono.just(1500.0));
        when(feedRepository.saveFeedSession(any(FeedSession.class))).thenAnswer(invocation -> Mono.just(invocation.getArgument(0)));
        when(feedRepository.acquireFeedBuildLock(eq(userId), anyString(), anyString(), any())).thenReturn(Mono.just(true));
        when(feedRepository.releaseFeedBuildLock(eq(userId), anyString(), anyString())).thenReturn(Mono.just(true));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(topics), eq(1500L), eq(Long.MAX_VALUE), anyInt(), anyInt(), eq(true)))
                .thenReturn(Mono.just(List.of(new FeedCandidate("p1", 1400.0, 1400.0, FeedCandidateBucket.SCROLL, FeedCandidateSource.PRIMARY))));
        when(feedRepository.aggregatePersonalizedCandidates(eq(1), eq(topics), eq(1500L), eq(1400L), anyInt(), anyInt(), eq(false)))
                .thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), eq(1400.0), anyInt()))
                .thenReturn(Flux.just(new ScoredArticle("f1", 1300.0)));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), eq(1300.0), anyInt()))
                .thenReturn(Flux.empty());
        when(feedRepository.getUnseenArticleIds(eq(userId), any()))
                .thenReturn(Mono.just(List.of("p1")))
                .thenReturn(Mono.just(List.of("f1")));
        when(feedRepository.markArticlesAsViewed(eq(userId), any())).thenReturn(Mono.just(2L));
        when(feedRepository.getArticleMetadataWithFallback("p1")).thenReturn(Mono.just(Map.of("title", "Primary 1", "published_at", "1400")));
        when(feedRepository.getArticleMetadataWithFallback("f1")).thenReturn(Mono.just(Map.of("title", "Fallback 1", "published_at", "1300")));

        StepVerifier.create(feedService.generateFeed(userId, null, null, null, 5))
                .expectNextMatches(page ->
                        page.getData().size() == 2
                                && "mixed".equals(page.getSource())
                                && page.getNextScrollCursor() == 1300L)
                .verifyComplete();
    }

    private static String scope(String raw) {
        return UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
