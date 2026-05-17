package solutions.imperium.news_api.domain.feed.v3;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;
import reactor.core.publisher.Flux;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.article.ArticlePostgresRepository;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v3.model.BuildFeedRequest;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v2.FeedV2Properties;
import solutions.imperium.news_api.domain.feed.v2.RedisPostgresArticleHydrator;
import solutions.imperium.news_api.domain.feed.v2.RedisUserFeedPreferences;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * End-to-end V3 pipeline test against a Redis testcontainer with PostgreSQL stubbed via
 * a mocked {@link ArticlePostgresRepository}. Covers Phase A injection, deep-gap interval-skip,
 * dense-window buffer drain, topic and latest endpoints.
 */
class FeedScannerPipelineIT {

    @SuppressWarnings("resource")
    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static ReactiveStringRedisTemplate stringTemplate;
    private static FeedScannerProperties scannerProperties;
    private static FeedV2Properties v2Properties;
    private static DefaultFeedScannerPipeline pipeline;
    private static FeedScannerMetrics scannerMetrics;
    private static SimpleMeterRegistry meterRegistry;

    @BeforeAll
    static void startContainer() throws Exception {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        stringTemplate = new ReactiveStringRedisTemplate(connectionFactory);

        ObjectMapper objectMapper = new ObjectMapper();
        scannerProperties = new FeedScannerProperties();
        // Allow small page sizes in the test.
        scannerProperties.setPageSizeMin(1);
        scannerProperties.setPageSizeMax(50);
        // Smaller window to make interval-skip test deterministic (60 seconds).
        scannerProperties.setWindowMillis(60L);
        v2Properties = new FeedV2Properties();
        v2Properties.setMaxTopicsPerRequest(64);

        ArticlePostgresRepository repo = mock(ArticlePostgresRepository.class);
        when(repo.findAllByIds(anyCollection())).thenReturn(Flux.empty());

        RedisPostgresArticleHydrator v2Hydrator = new RedisPostgresArticleHydrator(
                stringTemplate, repo, objectMapper, v2Properties);
        RedisPgFeedScannerArticleHydrator hydrator = new RedisPgFeedScannerArticleHydrator(v2Hydrator);

        RedisUserFeedPreferences userPreferences = new RedisUserFeedPreferences(
                stringTemplate, objectMapper, v2Properties);
        FeedScopeResolver scopeResolver = new FeedScopeResolver(scannerProperties);

        RedisFeedScannerSessionStore sessionStore = new RedisFeedScannerSessionStore(stringTemplate);
        sessionStore.loadScripts();

        RedisFeedScannerReadStateStore readStateStore = new RedisFeedScannerReadStateStore(
                stringTemplate, objectMapper, scannerProperties);

        RedisCandidateWindowScanner scanner = new RedisCandidateWindowScanner(stringTemplate, scannerProperties);
        FeedCandidateRanker ranker = new FeedCandidateRanker(scannerProperties);
        DefaultFeedScannerCommitter committer = new DefaultFeedScannerCommitter(
                readStateStore, sessionStore, scannerProperties);

        meterRegistry = new SimpleMeterRegistry();
        scannerMetrics = new FeedScannerMetrics(meterRegistry);

        pipeline = new DefaultFeedScannerPipeline(userPreferences, scopeResolver, sessionStore,
                readStateStore, scanner, ranker, hydrator, committer, scannerProperties, scannerMetrics);
    }

    @AfterAll
    static void stopContainer() {
        if (connectionFactory != null) connectionFactory.destroy();
        REDIS.stop();
    }

    @BeforeEach
    void flush() {
        stringTemplate.execute(conn -> conn.serverCommands().flushAll()).blockLast();
    }

    /* --------- helpers --------- */

    private String onboardUser(List<Integer> countryIds, List<String> topics) {
        String userId = UUID.randomUUID().toString();
        String key = "user:" + userId + ":prefs";
        String countryCsv = countryIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String topicsJson = "[" + topics.stream().map(t -> "\"" + t + "\"")
                .collect(Collectors.joining(",")) + "]";
        Map<String, String> values = new HashMap<>();
        values.put("country_ids", countryCsv);
        values.put("topics", topicsJson);
        values.put("topic_prefs_version", "1");
        stringTemplate.<String, String>opsForHash().putAll(key, values).block();
        return userId;
    }

    private void seedTopicArticle(int countryId, String topic, String articleId, long score) {
        String key = "feed:country:" + countryId + ":topic:" + topic;
        stringTemplate.opsForZSet().add(key, articleId, score).block();
        seedNewsHash(articleId);
    }

    private void seedCountryArticle(int countryId, String articleId, long score) {
        String key = "feed:country:" + countryId;
        stringTemplate.opsForZSet().add(key, articleId, score).block();
        seedNewsHash(articleId);
    }

    private void seedNewsHash(String articleId) {
        Map<String, String> hash = new HashMap<>();
        hash.put("title", "Title " + articleId);
        hash.put("excerpt", "Excerpt for " + articleId);
        hash.put("source_name", "TestSource");
        hash.put("image_url", "http://img/" + articleId);
        hash.put("published_at", "1700000000000");
        hash.put("root_topic_label", "Test");
        stringTemplate.<String, String>opsForHash().putAll("news:" + articleId, hash).block();
    }

    private PageResult<ArticleCardDto> request(String userId, EndpointKind kind, String topicParam,
                                               String sessionId, int limit) {
        return pipeline.build(new BuildFeedRequest(userId, kind, topicParam, sessionId, limit)).block();
    }

    /* --------- tests --------- */

    @Test
    void firstPage_returnsMostRecentItemsBelowNow() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        long now = java.time.Instant.now().getEpochSecond();
        for (int i = 0; i < 10; i++) {
            seedTopicArticle(1, "tech", "tech-" + i, now - (long) i);
        }

        PageResult<ArticleCardDto> page = request(userId, EndpointKind.PERSONALIZED, null, null, 5);
        assertThat(page).isNotNull();
        assertThat(page.getData()).hasSize(5);
        assertThat(page.getData().stream().map(ArticleCardDto::getId).toList())
                .containsExactly("tech-0", "tech-1", "tech-2", "tech-3", "tech-4");
        assertThat(page.getSessionId()).isNotBlank();
        assertThat(page.getSource()).isEqualTo("primary");
    }

    @Test
    void secondPage_doesNotOverlapWithFirst() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        long now = java.time.Instant.now().getEpochSecond();
        for (int i = 0; i < 20; i++) {
            seedTopicArticle(1, "tech", "tech-" + i, now - (long) i);
        }

        PageResult<ArticleCardDto> p1 = request(userId, EndpointKind.PERSONALIZED, null, null, 5);
        Set<String> p1Ids = p1.getData().stream().map(ArticleCardDto::getId).collect(Collectors.toSet());

        PageResult<ArticleCardDto> p2 = request(userId, EndpointKind.PERSONALIZED, null, p1.getSessionId(), 5);
        Set<String> p2Ids = p2.getData().stream().map(ArticleCardDto::getId).collect(Collectors.toSet());

        assertThat(p1Ids).doesNotContainAnyElementsOf(p2Ids);
        assertThat(p2.getData()).hasSize(5);
    }

    @Test
    void deepReadGap_skippedViaIntervalCoverage() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        long now = java.time.Instant.now().getEpochSecond();
        // Article ~6 days ago in seconds.
        long deepScore = now - 6L * 86_400L;
        seedTopicArticle(1, "tech", "deep", deepScore);

        FeedScopeResolver resolver = new FeedScopeResolver(scannerProperties);
        solutions.imperium.news_api.domain.feed.v2.model.UserPrefs prefs =
                new solutions.imperium.news_api.domain.feed.v2.model.UserPrefs(
                        List.of(1), List.of("tech"), 1L, false);
        String scopeHash = resolver.resolve(
                new BuildFeedRequest(userId, EndpointKind.PERSONALIZED, null, null, 5),
                prefs).scopeHash();

        // Plant interval covering (deepScore+1, now+1year) in seconds.
        long intervalEnd = now + 365L * 86_400L;
        stringTemplate.opsForValue().set(
                "feed:read:intervals:" + userId + ":" + scopeHash,
                "[[" + (deepScore + 1) + "," + intervalEnd + "]]").block();

        long beforeScanned = (long) scannerMetrics.windowScanned.count();
        long beforeSkipped = (long) scannerMetrics.windowSkipped.count();
        PageResult<ArticleCardDto> page = request(userId, EndpointKind.PERSONALIZED, null, null, 5);
        long afterScanned = (long) scannerMetrics.windowScanned.count();
        long afterSkipped = (long) scannerMetrics.windowSkipped.count();

        assertThat(page).isNotNull();
        assertThat(page.getData()).extracting(ArticleCardDto::getId).contains("deep");
        assertThat(afterSkipped - beforeSkipped).isGreaterThan(0L);
        assertThat(afterScanned - beforeScanned).isLessThanOrEqualTo(scannerProperties.getMaxWindowsPerRequest());
    }

    @Test
    void denseWindow_drainsBufferOnSecondPage_withoutExtraScans() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        long now = java.time.Instant.now().getEpochSecond();
        // 12 candidates inside ONE 60-second window.
        for (int i = 0; i < 12; i++) {
            seedTopicArticle(1, "tech", "dense-" + i, now - 5L - (long) i);
        }

        long beforeScannedA = (long) scannerMetrics.windowScanned.count();
        PageResult<ArticleCardDto> p1 = request(userId, EndpointKind.PERSONALIZED, null, null, 5);
        long afterScannedA = (long) scannerMetrics.windowScanned.count();
        assertThat(p1.getData()).hasSize(5);

        long beforeScannedB = (long) scannerMetrics.windowScanned.count();
        PageResult<ArticleCardDto> p2 = request(userId, EndpointKind.PERSONALIZED, null, p1.getSessionId(), 5);
        long afterScannedB = (long) scannerMetrics.windowScanned.count();

        assertThat(afterScannedB - beforeScannedB).isZero();
        assertThat(p2.getData()).hasSize(5);
        Set<String> p1Ids = p1.getData().stream().map(ArticleCardDto::getId).collect(Collectors.toSet());
        Set<String> p2Ids = p2.getData().stream().map(ArticleCardDto::getId).collect(Collectors.toSet());
        assertThat(p1Ids).doesNotContainAnyElementsOf(p2Ids);
    }

    @Test
    void topicEndpoint_usesTopicZsetOnly() {
        String userId = onboardUser(List.of(1), List.of("tech", "sports"));
        long now = java.time.Instant.now().getEpochSecond();
        seedTopicArticle(1, "tech", "tech-1", now - 1);
        seedTopicArticle(1, "sports", "sports-1", now - 2);

        PageResult<ArticleCardDto> page = request(userId, EndpointKind.TOPIC, "tech", null, 5);
        assertThat(page.getData()).extracting(ArticleCardDto::getId).containsExactly("tech-1");
    }

    @Test
    void latestEndpoint_readsCountryFallbackZset() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        long now = java.time.Instant.now().getEpochSecond();
        seedTopicArticle(1, "tech", "topic-only", now - 1);
        seedCountryArticle(1, "country-1", now - 2);
        seedCountryArticle(1, "country-2", now - 3);

        PageResult<ArticleCardDto> page = request(userId, EndpointKind.LATEST, null, null, 5);
        assertThat(page.getData()).extracting(ArticleCardDto::getId)
                .containsExactlyInAnyOrder("country-1", "country-2");
        assertThat(page.getSource()).isEqualTo("fallback");
    }
}
