package solutions.imperium.news_api.domain.feed.v2;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext;
import org.springframework.data.redis.serializer.StringRedisSerializer;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.article.Article;
import solutions.imperium.news_api.domain.article.ArticlePostgresRepository;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v2.model.BuildRequest;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FeedV2PipelineIT {

    @SuppressWarnings("resource")
    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static ReactiveStringRedisTemplate stringTemplate;
    private static ReactiveRedisTemplate<String, Object> objectTemplate;
    private static ArticlePostgresRepository articleRepo;
    private static FeedV2Properties properties;

    private static DefaultFeedPipeline pipeline;

    @BeforeAll
    static void startContainer() throws Exception {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();

        stringTemplate = new ReactiveStringRedisTemplate(connectionFactory);
        objectTemplate = new ReactiveRedisTemplate<>(
                connectionFactory,
                RedisSerializationContext.<String, Object>newSerializationContext(StringRedisSerializer.UTF_8)
                        .value(new GenericJackson2JsonRedisSerializer())
                        .hashValue(new GenericJackson2JsonRedisSerializer())
                        .hashKey(StringRedisSerializer.UTF_8)
                        .build());

        ObjectMapper objectMapper = new ObjectMapper();
        articleRepo = mock(ArticlePostgresRepository.class);
        when(articleRepo.findAllByIds(org.mockito.ArgumentMatchers.anyCollection())).thenReturn(Flux.empty());

        properties = new FeedV2Properties();

        RedisFeedSessionStore sessionStore = new RedisFeedSessionStore(stringTemplate);
        sessionStore.loadScripts();
        RedisSeenArticleStore seenStore = new RedisSeenArticleStore(stringTemplate, properties);
        seenStore.loadScripts();
        RedisCandidateAggregator aggregator = new RedisCandidateAggregator(stringTemplate);
        aggregator.loadScripts();
        RedisPostgresArticleHydrator hydrator = new RedisPostgresArticleHydrator(
                stringTemplate, articleRepo, objectMapper, properties);
        RedisUserFeedPreferences prefs = new RedisUserFeedPreferences(stringTemplate, objectMapper, properties);

        pipeline = new DefaultFeedPipeline(prefs, sessionStore, seenStore, aggregator, hydrator, properties);
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

    private void seedTopicFeed(int countryId, String topic, int countArticles, long startScore, long step) {
        String key = "feed:country:" + countryId + ":topic:" + topic;
        for (int i = 0; i < countArticles; i++) {
            long score = startScore - i * step;
            String articleId = "art-" + countryId + "-" + topic + "-" + i;
            stringTemplate.opsForZSet().add(key, articleId, score).block();
            seedArticleHash(articleId);
        }
    }

    private void seedCountryFallback(int countryId, int countArticles, long startScore, long step) {
        String key = "feed:country:" + countryId;
        for (int i = 0; i < countArticles; i++) {
            long score = startScore - i * step;
            String articleId = "fallback-" + countryId + "-" + i;
            stringTemplate.opsForZSet().add(key, articleId, score).block();
            seedArticleHash(articleId);
        }
    }

    private void seedSingleArticle(String key, String articleId, long score) {
        stringTemplate.opsForZSet().add(key, articleId, score).block();
        seedArticleHash(articleId);
    }

    private void seedArticleHash(String articleId) {
        Map<String, String> hash = new HashMap<>();
        hash.put("title", "Title " + articleId);
        hash.put("excerpt", "Excerpt for " + articleId);
        hash.put("source_name", "TestSource");
        hash.put("image_url", "http://img/" + articleId);
        hash.put("published_at", "1700000000000");
        hash.put("root_topic_label", "Test");
        stringTemplate.<String, String>opsForHash().putAll("news:" + articleId, hash).block();
    }

    private PageResult<ArticleCardDto> request(String userId, String endpoint, String topicParam,
                                               String sessionId, int limit) {
        return pipeline.build(new BuildRequest(userId, endpoint, topicParam, sessionId, limit)).block();
    }

    /* --------- tests --------- */

    @Test
    void freshUserHappyPath_returnsFullPage_andTracksSeen() {
        String userId = onboardUser(List.of(1, 2), List.of("tech", "sports", "world"));
        seedTopicFeed(1, "tech", 30, 100_000_000L, 1_000L);
        seedTopicFeed(1, "sports", 30, 100_000_000L, 1_001L);
        seedTopicFeed(2, "world", 30, 100_000_000L, 1_002L);

        PageResult<ArticleCardDto> page = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, null, 40);

        assertThat(page).isNotNull();
        assertThat(page.getData()).hasSize(40);
        assertThat(page.getSessionId()).isNotBlank();
        assertThat(page.getSource()).isEqualTo("primary");
        assertThat(page.getHasMore()).isTrue();
        Long seenCardinality = stringTemplate.opsForZSet().size("seen:" + userId).block();
        assertThat(seenCardinality).isEqualTo(40L);
        Long ttl = stringTemplate.getExpire("seen:" + userId).block().toSeconds();
        assertThat(ttl).isBetween(Duration.ofDays(13).toSeconds(), Duration.ofDays(14).toSeconds());
    }

    @Test
    void readGapAcrossSessions_isStructurallyImpossible() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        seedTopicFeed(1, "tech", 50, 200_000_000L, 1_000L);

        PageResult<ArticleCardDto> p1 = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, null, 20);
        Set<String> p1Ids = p1.getData().stream().map(ArticleCardDto::getId).collect(Collectors.toSet());

        // Simulate session expiry: delete session hash, keep seen ZSET.
        stringTemplate.delete("session:" + userId + ":" + p1.getSessionId()).block();

        // Articles arrive in the "gap": scores between served articles. (Older than session anchor.)
        seedSingleArticle("feed:country:1:topic:tech", "gap-1", 199_999_500L);
        seedSingleArticle("feed:country:1:topic:tech", "gap-2", 199_998_500L);

        PageResult<ArticleCardDto> p2 = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, null, 20);
        Set<String> p2Ids = p2.getData().stream().map(ArticleCardDto::getId).collect(Collectors.toSet());

        assertThat(p1Ids).doesNotContainAnyElementsOf(p2Ids);
        // gap-1 and gap-2 are below the new anchor, so they fall into scroll bucket — must appear.
        // They are below max score (200_000_000) so the new session's anchor = 200_000_000.
        // gap-1 < anchor → scroll; gap-2 < anchor → scroll. Both must be eligible since not seen.
        assertThat(p2Ids).contains("gap-1", "gap-2");
    }

    @Test
    void injectFloodDoesNotStarveScroll() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        // Older scroll articles seed the feed first (anchor for session start).
        seedTopicFeed(1, "tech", 80, 500L, 1L);   // scores 500..421

        // First request: establishes session anchor at 500. (no inject yet)
        PageResult<ArticleCardDto> initial = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, null, 20);
        long anchor = initial.getSessionAnchor();
        assertThat(anchor).isEqualTo(500L);
        String sid = initial.getSessionId();

        // Flood: write 100 articles with scores > anchor (i.e. score 600..501)
        for (int i = 0; i < 100; i++) {
            seedSingleArticle("feed:country:1:topic:tech", "flood-" + i, 600L - i);
        }

        // Next request: inject should be capped, scroll should keep flowing.
        PageResult<ArticleCardDto> page = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, sid, 20);
        long injectCount = page.getData().stream()
                .filter(a -> a.getId().startsWith("flood-")).count();
        long scrollCount = page.getData().size() - injectCount;
        assertThat(injectCount).isLessThanOrEqualTo(properties.getInjectPageMax());
        assertThat(scrollCount).isGreaterThan(0);
        assertThat(page.getData()).hasSizeBetween(15, 20);
    }

    @Test
    void heavyReader_seekLoopFillsPage_withExactFilter() {
        String userId = onboardUser(List.of(1), List.of("tech"));
        // 200 articles, scores 200_000..199_801
        seedTopicFeed(1, "tech", 200, 200_000L, 1L);

        // Pre-populate seen ZSET with the first 50 (indices 0..49 → highest 50 scores).
        // With scrollPerTopic=25 and seekMaxIterations=3, the loop scans up to 100 candidates
        // (4 batches × 25), so after skipping 50 seen it still has 50 unseen to fill the page.
        for (int i = 0; i < 50; i++) {
            stringTemplate.opsForZSet().add("seen:" + userId, "art-1-tech-" + i, System.currentTimeMillis()).block();
        }

        PageResult<ArticleCardDto> page = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, null, 20);

        assertThat(page.getData()).hasSize(20);
        // No served article must be in the pre-seen set.
        assertThat(page.getData().stream().map(ArticleCardDto::getId))
                .allMatch(id -> {
                    int idx = Integer.parseInt(id.substring("art-1-tech-".length()));
                    return idx >= 50;
                });
    }

    @Test
    void topicExhaustion_fallsBackToCountryFeed() {
        String userId = onboardUser(List.of(1), List.of("niche"));
        // No articles in topic feed at all → primary exhausted from the start.
        seedCountryFallback(1, 30, 80_000L, 1L);

        PageResult<ArticleCardDto> page = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, null, 20);

        assertThat(page.getData()).hasSize(20);
        assertThat(page.getSource()).isEqualTo("fallback");
        assertThat(page.getData()).allMatch(a -> a.getId().startsWith("fallback-1-"));
    }

    @Test
    void multiCountryAggregation_mergesAndDedups() {
        String userId = onboardUser(List.of(1, 2), List.of("tech"));
        // Country 1 has 15 articles, country 2 has 15 different ones — no overlap.
        seedTopicFeed(1, "tech", 15, 100_000L, 2L);   // scores 100_000, 99_998, ...
        seedTopicFeed(2, "tech", 15, 100_001L, 2L);   // scores 100_001, 99_999, ... (interleaved)

        PageResult<ArticleCardDto> page = request(userId, BuildRequest.ENDPOINT_PERSONALIZED, null, null, 20);

        List<String> ids = page.getData().stream().map(ArticleCardDto::getId).toList();
        assertThat(ids).hasSize(20);
        assertThat(ids.stream().distinct().count()).isEqualTo(20);
        assertThat(ids).anyMatch(id -> id.startsWith("art-1-tech-"));
        assertThat(ids).anyMatch(id -> id.startsWith("art-2-tech-"));
        // The two highest scores belong to country 2 (100_001) and country 1 (100_000) — both present.
        assertThat(ids.subList(0, 2)).containsExactlyInAnyOrder("art-2-tech-0", "art-1-tech-0");
    }
}
