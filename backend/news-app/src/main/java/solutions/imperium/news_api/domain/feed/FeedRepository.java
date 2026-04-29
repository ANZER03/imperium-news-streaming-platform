package solutions.imperium.news_api.domain.feed;

import solutions.imperium.news_api.core.Constants;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.RedisZSetCommands;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

@Repository
@RequiredArgsConstructor
public class FeedRepository {

    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final ReactiveStringRedisTemplate stringRedisTemplate;

    public Mono<List<String>> getUserTopics(String userId) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        return redisTemplate.opsForHash().get(key, "topics")
                .map(topics -> (List<String>) topics)
                .defaultIfEmpty(List.of("world"));
    }

    public Mono<Integer> getUserCountryId(String userId) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        return redisTemplate.opsForHash().get(key, "country_id")
                .map(v -> v instanceof Number n ? n.intValue() : Integer.parseInt(v.toString()))
                .defaultIfEmpty(0);
    }

    /**
     * Fetch article IDs with scores from a topic ZSET, exclusive upper bound on cursor.
     * Range: [0, cursor)  →  ZREVRANGEBYSCORE key (cursor 0
     */
    public Flux<ScoredArticle> getArticleIdsByTopicWithScores(String topic, double cursor, int limit) {
        String key = String.format(Constants.KEY_FEED_TOPIC, topic);
        Range<Double> range = Range.rightOpen(0.0, cursor);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, range, RedisZSetCommands.Limit.limit().count(limit))
                .map(tuple -> new ScoredArticle(String.valueOf(tuple.getValue()), tuple.getScore()));
    }

    /**
     * Fetch article IDs with scores from a country ZSET (fallback when topics are exhausted).
     * Range: [0, cursor)  →  exclusive upper bound.
     */
    public Flux<ScoredArticle> getArticleIdsByCountryWithScores(int countryId, double cursor, int limit) {
        String key = String.format(Constants.KEY_FEED_COUNTRY, countryId);
        Range<Double> range = Range.rightOpen(0.0, cursor);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, range, RedisZSetCommands.Limit.limit().count(limit))
                .map(tuple -> new ScoredArticle(String.valueOf(tuple.getValue()), tuple.getScore()));
    }

    public Mono<List<String>> getAppearedArticles(String userId) {
        String key = String.format(Constants.KEY_USER_VIEWED, userId);
        return redisTemplate.opsForSet().members(key)
                .map(String::valueOf)
                .collectList();
    }

    public Mono<Map<String, String>> getArticleMetadata(String articleId) {
        String key = String.format(Constants.KEY_NEWS_HASH, articleId);
        return stringRedisTemplate.<String, String>opsForHash().entries(key)
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .filter(map -> !map.isEmpty());
    }

    public Mono<Long> markArticlesAsViewed(String userId, List<String> articleIds) {
        String key = String.format(Constants.KEY_USER_VIEWED, userId);
        return redisTemplate.opsForSet().add(key, articleIds.toArray())
                .flatMap(added -> redisTemplate.expire(key, Duration.ofDays(12)).thenReturn(added));
    }
}
