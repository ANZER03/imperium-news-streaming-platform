package solutions.imperium.news_api.domain.feed.v2;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.feed.v2.model.FeedV2Session;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class RedisFeedSessionStore implements FeedSessionStore {

    private final ReactiveStringRedisTemplate redis;

    private RedisScript<Long> releaseLockScript;

    @PostConstruct
    void loadScripts() throws IOException {
        String body = new String(new ClassPathResource("feed/v2/release_lock.lua")
                .getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        this.releaseLockScript = RedisScript.of(body, Long.class);
    }

    @Override
    public Mono<Optional<FeedV2Session>> find(String userId, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Mono.just(Optional.empty());
        }
        String key = sessionKey(userId, sessionId);
        return redis.<String, String>opsForHash().entries(key)
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .map(this::mapSession)
                .map(Optional::of)
                .defaultIfEmpty(Optional.empty());
    }

    @Override
    public Mono<FeedV2Session> save(FeedV2Session session, Duration ttl) {
        String key = sessionKey(session.getUserId(), session.getSessionId());
        Map<String, String> values = new LinkedHashMap<>();
        values.put("sessionId", session.getSessionId());
        values.put("userId", session.getUserId());
        values.put("scopeFingerprint", session.getScopeFingerprint());
        values.put("endpointKind", session.getEndpointKind());
        values.put("topicParam", session.getTopicParam() == null ? "" : session.getTopicParam());
        values.put("countryIds", session.countryIdsCsv());
        values.put("sessionAnchor", Long.toString(session.getSessionAnchor()));
        values.put("scrollCursor", Long.toString(session.getScrollCursor()));
        values.put("createdAt", Long.toString(session.getCreatedAt()));
        values.put("lastAccessAt", Long.toString(session.getLastAccessAt()));

        return redis.<String, String>opsForHash().putAll(key, values)
                .then(redis.expire(key, ttl))
                .thenReturn(session);
    }

    @Override
    public Mono<Boolean> acquireLock(String userId, String sessionId, String token, Duration ttl) {
        String key = lockKey(userId, sessionId);
        return redis.opsForValue().setIfAbsent(key, token, ttl).defaultIfEmpty(false);
    }

    @Override
    public Mono<Boolean> releaseLock(String userId, String sessionId, String token) {
        String key = lockKey(userId, sessionId);
        return redis.execute(releaseLockScript, List.of(key), List.of(token))
                .next()
                .map(result -> result != null && result > 0)
                .defaultIfEmpty(false);
    }

    private String sessionKey(String userId, String sessionId) {
        return String.format(Constants.KEY_FEED_SESSION, userId, sessionId);
    }

    private String lockKey(String userId, String sessionId) {
        return String.format(Constants.KEY_FEED_SESSION_LOCK, userId, sessionId);
    }

    private FeedV2Session mapSession(Map<String, String> values) {
        return FeedV2Session.builder()
                .sessionId(values.get("sessionId"))
                .userId(values.get("userId"))
                .scopeFingerprint(values.get("scopeFingerprint"))
                .endpointKind(values.get("endpointKind"))
                .topicParam(emptyToNull(values.get("topicParam")))
                .countryIds(FeedV2Session.parseCountryCsv(values.get("countryIds")))
                .sessionAnchor(parseLongOrZero(values.get("sessionAnchor")))
                .scrollCursor(parseLongOrZero(values.get("scrollCursor")))
                .createdAt(parseLongOrZero(values.get("createdAt")))
                .lastAccessAt(parseLongOrZero(values.get("lastAccessAt")))
                .build();
    }

    private String emptyToNull(String value) {
        return value == null || value.isEmpty() ? null : value;
    }

    private long parseLongOrZero(String value) {
        if (value == null || value.isBlank()) return 0L;
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException ex) {
            return 0L;
        }
    }
}
