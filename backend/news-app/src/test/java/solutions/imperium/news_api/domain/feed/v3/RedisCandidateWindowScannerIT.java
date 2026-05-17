package solutions.imperium.news_api.domain.feed.v3;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;
import solutions.imperium.news_api.domain.feed.v3.model.Candidate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RedisCandidateWindowScannerIT {

    @SuppressWarnings("resource")
    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static ReactiveStringRedisTemplate stringTemplate;
    private static FeedScannerProperties properties;
    private static RedisCandidateWindowScanner scanner;

    @BeforeAll
    static void startContainer() {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        stringTemplate = new ReactiveStringRedisTemplate(connectionFactory);
        properties = new FeedScannerProperties();
        scanner = new RedisCandidateWindowScanner(stringTemplate, properties);
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

    private void seed(String key, String articleId, long score) {
        stringTemplate.opsForZSet().add(key, articleId, score).block();
    }

    @Test
    void primaryScan_mergesAcrossTopicsAndOrdersByScoreDesc() {
        seed("feed:country:1:topic:tech", "tech-1", 1000);
        seed("feed:country:1:topic:tech", "tech-2", 800);
        seed("feed:country:1:topic:sports", "sports-1", 900);
        seed("feed:country:1:topic:sports", "sports-2", 500);

        List<Candidate> result = scanner.scan(List.of(1), List.of("tech", "sports"),
                false, 0L, 5000L, 50).block();

        assertThat(result).extracting(Candidate::articleId)
                .containsExactly("tech-1", "sports-1", "tech-2", "sports-2");
    }

    @Test
    void primaryScan_capsPerTopicLimit() {
        for (int i = 0; i < 10; i++) {
            seed("feed:country:1:topic:tech", "tech-" + i, 1000 - i);
        }
        List<Candidate> result = scanner.scan(List.of(1), List.of("tech"),
                false, 0L, 5000L, 3).block();
        assertThat(result).hasSize(3);
        assertThat(result).extracting(Candidate::articleId).containsExactly("tech-0", "tech-1", "tech-2");
    }

    @Test
    void fallbackScan_readsCountryZsetOnly() {
        seed("feed:country:1:topic:tech", "ignored", 9999);
        seed("feed:country:1", "country-1", 100);
        seed("feed:country:1", "country-2", 200);

        List<Candidate> result = scanner.scan(List.of(1), List.of("tech"),
                true, 0L, 5000L, 50).block();
        assertThat(result).extracting(Candidate::articleId)
                .containsExactly("country-2", "country-1");
    }

    @Test
    void emptyTopics_fallsBackImplicitly() {
        seed("feed:country:1", "country-only", 42);
        List<Candidate> result = scanner.scan(List.of(1), List.of(), false, 0L, 5000L, 50).block();
        assertThat(result).extracting(Candidate::articleId).containsExactly("country-only");
    }

    @Test
    void deduplicates_acrossCountriesByArticleId_keepingHighestScore() {
        seed("feed:country:1:topic:tech", "shared", 500);
        seed("feed:country:2:topic:tech", "shared", 800);

        List<Candidate> result = scanner.scan(List.of(1, 2), List.of("tech"),
                false, 0L, 5000L, 50).block();
        assertThat(result).hasSize(1);
        assertThat(result.get(0).articleId()).isEqualTo("shared");
        assertThat(result.get(0).rawScore()).isEqualTo(800L);
    }

    @Test
    void emptyCountries_returnsEmpty() {
        List<Candidate> result = scanner.scan(List.of(), List.of("tech"), false, 0L, 5000L, 50).block();
        assertThat(result).isEmpty();
    }

    @Test
    void invertedWindow_returnsEmpty() {
        seed("feed:country:1:topic:tech", "tech-1", 1000);
        List<Candidate> result = scanner.scan(List.of(1), List.of("tech"), false, 5000L, 0L, 50).block();
        assertThat(result).isEmpty();
    }

    @Test
    void respectsScoreWindow() {
        seed("feed:country:1:topic:tech", "below", 50);
        seed("feed:country:1:topic:tech", "inside", 150);
        seed("feed:country:1:topic:tech", "above", 250);

        List<Candidate> result = scanner.scan(List.of(1), List.of("tech"), false, 100L, 200L, 50).block();
        assertThat(result).extracting(Candidate::articleId).containsExactly("inside");
    }
}
