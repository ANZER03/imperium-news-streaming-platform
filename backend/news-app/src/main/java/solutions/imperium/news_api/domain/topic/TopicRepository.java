package solutions.imperium.news_api.domain.topic;

import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.topic.dto.TopicDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;

@Slf4j
@Repository
@RequiredArgsConstructor
public class TopicRepository {

    private final ReactiveStringRedisTemplate stringRedisTemplate;
    private final DatabaseClient databaseClient;
    private final ObjectMapper objectMapper;

    /**
     * Returns all active top-level topics (topic_id + display_name).
     * Cache-aside: Redis first, Postgres fallback → write back to cache.
     */
    public Flux<TopicDto> findAllActive() {
        return readFromCache()
                .switchIfEmpty(readFromDbAndCache());
    }

    // ── Cache read ────────────────────────────────────────────────────────────

    private Flux<TopicDto> readFromCache() {
        return stringRedisTemplate.opsForValue()
                .get(Constants.KEY_TOPICS_LIST)
                .flatMapMany(json -> {
                    try {
                        List<TopicDto> topics = objectMapper.readValue(
                                json, new TypeReference<List<TopicDto>>() {});
                        log.debug("Topics served from cache");
                        return Flux.fromIterable(topics);
                    } catch (Exception e) {
                        log.warn("Cache value for topics:list is corrupt, falling back to DB: {}", e.getMessage());
                        return Flux.empty();
                    }
                });
    }

    // ── DB read + cache write ─────────────────────────────────────────────────

    private Flux<TopicDto> readFromDbAndCache() {
        return databaseClient.sql("""
                        SELECT topic_id, display_name
                        FROM imperium_topic_taxonomy
                        WHERE is_active = true
                        AND parent_topic_id IS NULL
                        ORDER BY display_name
                        """)
                .map(row -> new TopicDto(
                        row.get("topic_id", String.class),
                        row.get("display_name", String.class)))
                .all()
                .collectList()
                .flatMapMany(topics -> {
                    try {
                        String json = objectMapper.writeValueAsString(topics);
                        return stringRedisTemplate.opsForValue()
                                .set(Constants.KEY_TOPICS_LIST, json, Duration.ofHours(24))
                                .doOnSuccess(r -> log.debug("Topics cached ({})", topics.size()))
                                .thenMany(Flux.fromIterable(topics));
                    } catch (Exception e) {
                        log.error("Failed to serialize topics for cache", e);
                        return Flux.fromIterable(topics); // still return results even if cache write fails
                    }
                });
    }
}
