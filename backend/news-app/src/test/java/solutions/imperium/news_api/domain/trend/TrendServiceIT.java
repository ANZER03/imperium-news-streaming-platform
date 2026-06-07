package solutions.imperium.news_api.domain.trend;

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
import solutions.imperium.news_api.domain.trend.dto.TrendKeywordDto;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

public class TrendServiceIT {

    @SuppressWarnings("resource")
    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static ReactiveStringRedisTemplate stringTemplate;
    private static TrendService trendService;

    @BeforeAll
    static void startContainer() {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        stringTemplate = new ReactiveStringRedisTemplate(connectionFactory);

        trendService = new TrendService(stringTemplate, null, null, null);
    }

    @AfterAll
    static void stopContainer() {
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
        REDIS.stop();
    }

    @BeforeEach
    void flush() {
        stringTemplate.execute(conn -> conn.serverCommands().flushAll()).blockLast();
    }

    @Test
    void testGetExploreTrends_Global() {
        // Setup data
        String zsetKey = "trend:global:5h";
        String term = "global_macron";
        stringTemplate.opsForZSet().add(zsetKey, term, 150.5).block();

        String metaKey = "trend:meta:global:global:" + term;
        Map<String, String> meta = new HashMap<>();
        meta.put("term", term);
        meta.put("score", "150.5");
        meta.put("term_type", "person");
        meta.put("current_count", "100");
        stringTemplate.<String, String>opsForHash().putAll(metaKey, meta).block();

        // Execution
        Flux<TrendKeywordDto> results = trendService.getExploreTrends(null, null);

        // Verification
        java.util.List<TrendKeywordDto> dtoList = results.collectList().block();
        assertThat(dtoList).isNotNull();
        assertThat(dtoList).hasSize(1);
        assertThat(dtoList.get(0).getTerm()).isEqualTo(term);
        assertThat(dtoList.get(0).getScore()).isEqualTo(150.5);
        assertThat(dtoList.get(0).getTermType()).isEqualTo("person");
        assertThat(dtoList.get(0).getCurrentCount()).isEqualTo(100);
    }

    @Test
    void testGetExploreTrends_CountryTopic() {
        // Setup data
        String zsetKey = "trend:country_topic:france:sports_:5h";
        String term = "olympics";
        stringTemplate.opsForZSet().add(zsetKey, term, 99.9).block();

        String metaKey = "trend:meta:country_topic:france_sports_:olympics";
        Map<String, String> meta = new HashMap<>();
        meta.put("term", term);
        meta.put("score", "99.9");
        meta.put("term_type", "event");
        stringTemplate.<String, String>opsForHash().putAll(metaKey, meta).block();

        // Execution
        Flux<TrendKeywordDto> results = trendService.getExploreTrends("France", "Sports!");

        // Verification
        java.util.List<TrendKeywordDto> dtoList = results.collectList().block();
        assertThat(dtoList).isNotNull();
        assertThat(dtoList).hasSize(1);
        assertThat(dtoList.get(0).getTerm()).isEqualTo(term);
        assertThat(dtoList.get(0).getScore()).isEqualTo(99.9);
        assertThat(dtoList.get(0).getTermType()).isEqualTo("event");
    }

    @Test
    void testGetExploreTrends_GlobalTopic() {
        String zsetKey = "trend:global_topic:entertainment_culture:5h";
        String term = "cinema";
        stringTemplate.opsForZSet().add(zsetKey, term, 88.8).block();

        String metaKey = "trend:meta:global_topic:global_entertainment_culture:cinema";
        Map<String, String> meta = new HashMap<>();
        meta.put("term", term);
        meta.put("score", "88.8");
        meta.put("term_type", "keyword");
        stringTemplate.<String, String>opsForHash().putAll(metaKey, meta).block();

        Flux<TrendKeywordDto> results = trendService.getExploreTrends(null, "entertainment_culture");

        java.util.List<TrendKeywordDto> dtoList = results.collectList().block();
        assertThat(dtoList).isNotNull();
        assertThat(dtoList).hasSize(1);
        assertThat(dtoList.get(0).getTerm()).isEqualTo(term);
        assertThat(dtoList.get(0).getScore()).isEqualTo(88.8);
        assertThat(dtoList.get(0).getTermType()).isEqualTo("keyword");
    }
}
