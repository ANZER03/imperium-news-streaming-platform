package solutions.imperium.news_api.domain.feed.v3;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.utility.DockerImageName;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;
import solutions.imperium.news_api.domain.feed.v3.model.ReadState;

import java.time.Duration;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class RedisFeedScannerReadStateStoreIT {

    @SuppressWarnings("resource")
    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static ReactiveStringRedisTemplate stringTemplate;
    private static FeedScannerProperties properties;
    private static RedisFeedScannerReadStateStore store;

    private static final String USER = "user-x";
    private static final String SCOPE = "scope-abc";

    @BeforeAll
    static void startContainer() {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        stringTemplate = new ReactiveStringRedisTemplate(connectionFactory);
        properties = new FeedScannerProperties();
        store = new RedisFeedScannerReadStateStore(stringTemplate, new ObjectMapper(), properties);
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

    @Test
    void loadReadState_emptyByDefault() {
        ReadState state = store.loadReadState(USER, SCOPE, 0L).block();
        assertThat(state).isNotNull();
        assertThat(state.intervals()).isEmpty();
    }

    @Test
    void addExhaustedInterval_persistsAndNormalizesOnLoad() {
        store.addExhaustedInterval(USER, SCOPE, new Interval(100, 200), 0L).block();
        store.addExhaustedInterval(USER, SCOPE, new Interval(150, 300), 0L).block();
        store.addExhaustedInterval(USER, SCOPE, new Interval(500, 600), 0L).block();

        ReadState state = store.loadReadState(USER, SCOPE, 0L).block();
        assertThat(state).isNotNull();
        assertThat(state.intervals()).containsExactly(
                new Interval(100, 300),
                new Interval(500, 600)
        );

        Long ttl = stringTemplate.getExpire("feed:read:intervals:" + USER + ":" + SCOPE).block().toSeconds();
        assertThat(ttl).isBetween(
                Duration.ofDays(properties.getReadStateTtlDays() - 1).toSeconds(),
                Duration.ofDays(properties.getReadStateTtlDays()).toSeconds() + 60);
    }

    @Test
    void loadReadState_dropsExpiredOnLoad() {
        store.addExhaustedInterval(USER, SCOPE, new Interval(100, 200), 0L).block();
        store.addExhaustedInterval(USER, SCOPE, new Interval(900, 1000), 0L).block();

        ReadState state = store.loadReadState(USER, SCOPE, 500L).block();
        assertThat(state).isNotNull();
        assertThat(state.intervals()).containsExactly(new Interval(900, 1000));
    }

    @Test
    void filterUnreadIds_returnsAllOnEmptyKey() {
        Set<String> unread = store.filterUnreadIds(USER, SCOPE, List.of("a", "b", "c")).block();
        assertThat(unread).containsExactly("a", "b", "c");
    }

    @Test
    void filterUnreadIds_skipsAlreadyReadAndPreservesOrder() {
        store.addReadIds(USER, SCOPE, List.of("b", "d")).block();

        Set<String> unread = store.filterUnreadIds(USER, SCOPE, List.of("a", "b", "c", "d", "e")).block();
        assertThat(unread).containsExactly("a", "c", "e");
    }

    @Test
    void addReadIds_setsTtl() {
        store.addReadIds(USER, SCOPE, List.of("x", "y")).block();
        Long ttl = stringTemplate.getExpire("feed:read:ids:" + USER + ":" + SCOPE).block().toSeconds();
        assertThat(ttl).isBetween(
                Duration.ofDays(properties.getReadStateTtlDays() - 1).toSeconds(),
                Duration.ofDays(properties.getReadStateTtlDays()).toSeconds() + 60);
    }

    @Test
    void addReadIds_emptyInput_isNoOp() {
        Long added = store.addReadIds(USER, SCOPE, List.of()).block();
        assertThat(added).isEqualTo(0L);
    }

    @Test
    void filterUnreadIds_emptyInput_returnsEmpty() {
        Set<String> unread = store.filterUnreadIds(USER, SCOPE, List.of()).block();
        assertThat(unread).isEmpty();
    }
}
