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
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerSession;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

class RedisFeedScannerSessionStoreIT {

    @SuppressWarnings("resource")
    private static final GenericContainer<?> REDIS =
            new GenericContainer<>(DockerImageName.parse("redis:7-alpine")).withExposedPorts(6379);

    private static LettuceConnectionFactory connectionFactory;
    private static ReactiveStringRedisTemplate stringTemplate;
    private static RedisFeedScannerSessionStore store;

    @BeforeAll
    static void startContainer() throws Exception {
        REDIS.start();
        connectionFactory = new LettuceConnectionFactory(
                new RedisStandaloneConfiguration(REDIS.getHost(), REDIS.getMappedPort(6379)));
        connectionFactory.afterPropertiesSet();
        stringTemplate = new ReactiveStringRedisTemplate(connectionFactory);
        store = new RedisFeedScannerSessionStore(stringTemplate);
        store.loadScripts();
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

    private FeedScannerSession sample() {
        return FeedScannerSession.builder()
                .sessionId("sess-1")
                .userId("user-1")
                .scopeHash("scope-hash-abcdef0123")
                .endpointKind(EndpointKind.PERSONALIZED)
                .topicParam(null)
                .countryIds(List.of(1, 2))
                .newestCursor(123_000_000L)
                .olderCursor(100_000_000L)
                .pendingWindowStart(95_000_000L)
                .pendingWindowEnd(99_000_000L)
                .bufferIds(List.of("art-1", "art,with,commas", "art-3"))
                .createdAt(1_700_000_000L)
                .updatedAt(1_700_000_500L)
                .build();
    }

    @Test
    void find_missingSession_returnsEmpty() {
        Optional<FeedScannerSession> found = store.find("nope", "nope").block();
        assertThat(found).isEmpty();
    }

    @Test
    void saveAndFind_roundTripsAllFieldsIncludingBufferIdsWithCommas() {
        FeedScannerSession s = sample();
        store.save(s, Duration.ofHours(4)).block();

        Optional<FeedScannerSession> reloaded = store.find(s.getUserId(), s.getSessionId()).block();
        assertThat(reloaded).isPresent();
        assertThat(reloaded.get()).usingRecursiveComparison().isEqualTo(s);
    }

    @Test
    void save_appliesTtl() {
        FeedScannerSession s = sample();
        store.save(s, Duration.ofHours(4)).block();
        Long ttl = stringTemplate.getExpire("feed:session:user-1:sess-1").block().toSeconds();
        assertThat(ttl).isBetween(Duration.ofHours(3).toSeconds(), Duration.ofHours(4).toSeconds() + 60);
    }

    @Test
    void acquireLock_succeedsOnceThenFails() {
        Boolean first = store.acquireLock("u", "s", "tok-1", Duration.ofSeconds(5)).block();
        Boolean second = store.acquireLock("u", "s", "tok-2", Duration.ofSeconds(5)).block();
        assertThat(first).isTrue();
        assertThat(second).isFalse();
    }

    @Test
    void releaseLock_releasesOnlyWithMatchingToken() {
        store.acquireLock("u", "s", "tok-1", Duration.ofSeconds(5)).block();
        Boolean wrongToken = store.releaseLock("u", "s", "tok-other").block();
        assertThat(wrongToken).isFalse();
        // Lock still held — second acquirer cannot pass.
        assertThat(store.acquireLock("u", "s", "tok-2", Duration.ofSeconds(5)).block()).isFalse();

        Boolean ok = store.releaseLock("u", "s", "tok-1").block();
        assertThat(ok).isTrue();
        // After release a new acquirer gets the lock.
        assertThat(store.acquireLock("u", "s", "tok-2", Duration.ofSeconds(5)).block()).isTrue();
    }
}
