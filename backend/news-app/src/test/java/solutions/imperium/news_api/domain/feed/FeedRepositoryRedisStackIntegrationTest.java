package solutions.imperium.news_api.domain.feed;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;

import java.net.InetSocketAddress;
import java.net.Socket;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;

@SpringBootTest
@EnabledIf("redisStackReachable")
class FeedRepositoryRedisStackIntegrationTest {

    private static final int COUNTRY_ID = 999001;
    private static final String TOPIC_ONE = "business_economy";
    private static final String TOPIC_TWO = "world";
    private static final String KEY_ONE = "feed:country:" + COUNTRY_ID + ":topic:" + TOPIC_ONE;
    private static final String KEY_TWO = "feed:country:" + COUNTRY_ID + ":topic:" + TOPIC_TWO;

    @Autowired
    private FeedRepository feedRepository;

    @Autowired
    private ReactiveStringRedisTemplate stringRedisTemplate;

    @AfterEach
    void cleanup() {
        stringRedisTemplate.delete(KEY_ONE, KEY_TWO).block();
    }

    @Test
    void aggregatePersonalizedCandidates_parsesLuaMultiResultAndDedupsAcrossTopics() {
        stringRedisTemplate.delete(KEY_ONE, KEY_TWO)
                .thenMany(stringRedisTemplate.opsForZSet().add(KEY_ONE, "inject-1", 2000.0))
                .thenMany(stringRedisTemplate.opsForZSet().add(KEY_ONE, "shared-scroll", 1800.0))
                .thenMany(stringRedisTemplate.opsForZSet().add(KEY_ONE, "scroll-1", 1700.0))
                .thenMany(stringRedisTemplate.opsForZSet().add(KEY_TWO, "shared-scroll", 1750.0))
                .thenMany(stringRedisTemplate.opsForZSet().add(KEY_TWO, "scroll-2", 1600.0))
                .then()
                .block();

        List<FeedCandidate> candidates = feedRepository.aggregatePersonalizedCandidates(
                        COUNTRY_ID,
                        List.of(TOPIC_ONE, TOPIC_TWO),
                        1900L,
                        Long.MAX_VALUE,
                        3,
                        12,
                        true)
                .block();

        assertEquals(4, candidates.size());
        assertEquals(new FeedCandidate("inject-1", 2000.0, 2000.0, FeedCandidateBucket.INJECT, FeedCandidateSource.PRIMARY), candidates.get(0));
        assertIterableEquals(
                List.of("shared-scroll", "scroll-1", "scroll-2"),
                candidates.stream()
                        .filter(candidate -> candidate.bucket() == FeedCandidateBucket.SCROLL)
                        .map(FeedCandidate::id)
                        .toList());
        assertEquals(1800.0, candidates.get(1).rawScore());
    }

    static boolean redisStackReachable() {
        try (Socket socket = new Socket()) {
            socket.connect(new InetSocketAddress("127.0.0.1", 46379), 500);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }
}
