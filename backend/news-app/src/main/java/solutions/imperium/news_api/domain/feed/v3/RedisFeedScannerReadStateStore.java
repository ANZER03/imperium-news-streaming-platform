package solutions.imperium.news_api.domain.feed.v3;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;
import solutions.imperium.news_api.domain.feed.v3.model.ReadState;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Redis-backed implementation of {@link FeedScannerReadStateStore}. Uses the project
 * {@link ReactiveStringRedisTemplate}; intervals are stored as JSON strings and exact read IDs
 * as a Redis SET. Both keys are TTL'd to {@code feed.scanner.read-state-ttl-days}.
 */
@Component
@RequiredArgsConstructor
public class RedisFeedScannerReadStateStore implements FeedScannerReadStateStore {

    private final ReactiveStringRedisTemplate redis;
    private final ObjectMapper objectMapper;
    private final FeedScannerProperties properties;

    @Override
    public Mono<ReadState> loadReadState(String userId, String scopeHash, long minValidTs) {
        String key = intervalsKey(userId, scopeHash);
        return redis.opsForValue().get(key)
                .map(json -> ReadIntervals.deserialize(objectMapper, json))
                .map(intervals -> ReadIntervals.normalize(intervals, minValidTs))
                .map(ReadState::new)
                .defaultIfEmpty(ReadState.empty());
    }

    @Override
    public Mono<Set<String>> filterUnreadIds(String userId, String scopeHash, Collection<String> candidateIds) {
        if (candidateIds == null || candidateIds.isEmpty()) {
            return Mono.just(new LinkedHashSet<>());
        }
        List<String> ordered = new ArrayList<>(new LinkedHashSet<>(candidateIds));
        String key = readIdsKey(userId, scopeHash);
        int concurrency = Math.max(1, properties.getReadIdCheckConcurrency());

        return Flux.fromIterable(ordered)
                .flatMap(id -> redis.opsForSet().isMember(key, id)
                        .defaultIfEmpty(Boolean.FALSE)
                        .map(isMember -> new IdMembership(id, isMember)), concurrency)
                .collectList()
                .map(list -> {
                    Set<String> unread = new LinkedHashSet<>();
                    // Preserve original input order regardless of completion order.
                    java.util.Map<String, Boolean> seen = new java.util.HashMap<>(list.size() * 2);
                    for (IdMembership m : list) seen.put(m.id, m.isMember);
                    for (String id : ordered) {
                        if (Boolean.FALSE.equals(seen.get(id))) unread.add(id);
                    }
                    return unread;
                });
    }

    @Override
    public Mono<Long> addReadIds(String userId, String scopeHash, Collection<String> ids) {
        if (ids == null || ids.isEmpty()) {
            return Mono.just(0L);
        }
        Set<String> distinct = new LinkedHashSet<>(ids);
        String key = readIdsKey(userId, scopeHash);
        Duration ttl = readStateTtl();
        return redis.opsForSet().add(key, distinct.toArray(new String[0]))
                .flatMap(added -> redis.expire(key, ttl).thenReturn(added))
                .defaultIfEmpty(0L);
    }

    @Override
    public Mono<Void> addExhaustedInterval(String userId, String scopeHash, Interval interval, long minValidTs) {
        if (interval == null) return Mono.empty();
        String key = intervalsKey(userId, scopeHash);
        Duration ttl = readStateTtl();
        return redis.opsForValue().get(key)
                .map(json -> ReadIntervals.deserialize(objectMapper, json))
                .defaultIfEmpty(List.of())
                .map(existing -> {
                    List<Interval> combined = new ArrayList<>(existing.size() + 1);
                    combined.addAll(existing);
                    combined.add(interval);
                    return ReadIntervals.normalize(combined, minValidTs);
                })
                .map(normalized -> ReadIntervals.serialize(objectMapper, normalized))
                .flatMap(json -> redis.opsForValue().set(key, json, ttl))
                .then();
    }

    private String intervalsKey(String userId, String scopeHash) {
        return String.format(Constants.KEY_FEED_READ_INTERVALS, userId, scopeHash);
    }

    private String readIdsKey(String userId, String scopeHash) {
        return String.format(Constants.KEY_FEED_READ_IDS, userId, scopeHash);
    }

    private Duration readStateTtl() {
        return Duration.ofDays(properties.getReadStateTtlDays());
    }

    private record IdMembership(String id, boolean isMember) {}
}
