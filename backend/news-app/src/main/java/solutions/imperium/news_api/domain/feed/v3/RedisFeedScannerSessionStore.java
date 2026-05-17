package solutions.imperium.news_api.domain.feed.v3;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerSession;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Redis-backed implementation of {@link FeedScannerSessionStore}. Sessions are stored as
 * HASHes (one HASH per (userId, sessionId)). Buffer IDs and country IDs are CSV-encoded.
 * Lock release uses a tiny Lua script for atomic compare-and-delete.
 */
@Component
@RequiredArgsConstructor
public class RedisFeedScannerSessionStore implements FeedScannerSessionStore {

    /** Field separator within HASH values for CSV-encoded lists. */
    private static final String CSV = ",";

    /** Encoding for entries in {@code bufferIds}: original IDs are URL-form-encoded so commas
     *  and other separators stay safe. */
    private static final String CSV_ENCODE_COMMA = "%2C";
    private static final String CSV_ENCODE_PERCENT = "%25";

    private final ReactiveStringRedisTemplate redis;

    private RedisScript<Long> releaseLockScript;

    @PostConstruct
    public void loadScripts() throws IOException {
        String body = new String(
                new ClassPathResource("feed/v3/release_lock.lua").getInputStream().readAllBytes(),
                StandardCharsets.UTF_8);
        this.releaseLockScript = RedisScript.of(body, Long.class);
    }

    @Override
    public Mono<Optional<FeedScannerSession>> find(String userId, String sessionId) {
        if (sessionId == null || sessionId.isBlank()) {
            return Mono.just(Optional.empty());
        }
        String key = sessionKey(userId, sessionId);
        return redis.<String, String>opsForHash().entries(key)
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .filter(map -> !map.isEmpty())
                .map(this::mapToSession)
                .map(Optional::of)
                .defaultIfEmpty(Optional.empty());
    }

    @Override
    public Mono<FeedScannerSession> save(FeedScannerSession session, Duration ttl) {
        String key = sessionKey(session.getUserId(), session.getSessionId());
        Map<String, String> values = sessionToHash(session);
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

    /* ------------------- key helpers ------------------- */

    private String sessionKey(String userId, String sessionId) {
        return String.format(Constants.KEY_FEED_SCANNER_SESSION, userId, sessionId);
    }

    private String lockKey(String userId, String sessionId) {
        return String.format(Constants.KEY_FEED_SCANNER_LOCK, userId, sessionId);
    }

    /* ------------------- mapping ------------------- */

    private Map<String, String> sessionToHash(FeedScannerSession s) {
        Map<String, String> map = new LinkedHashMap<>();
        map.put("sessionId", s.getSessionId());
        map.put("userId", s.getUserId());
        map.put("scopeHash", s.getScopeHash());
        map.put("endpointKind", s.getEndpointKind() == null ? "" : s.getEndpointKind().name());
        map.put("topicParam", s.getTopicParam() == null ? "" : s.getTopicParam());
        map.put("countryIds", encodeIntCsv(s.getCountryIds()));
        map.put("newestCursor", Long.toString(s.getNewestCursor()));
        map.put("olderCursor", Long.toString(s.getOlderCursor()));
        map.put("pendingWindowStart", Long.toString(s.getPendingWindowStart()));
        map.put("pendingWindowEnd", Long.toString(s.getPendingWindowEnd()));
        map.put("bufferIds", encodeStringCsv(s.getBufferIds()));
        map.put("createdAt", Long.toString(s.getCreatedAt()));
        map.put("updatedAt", Long.toString(s.getUpdatedAt()));
        return map;
    }

    private FeedScannerSession mapToSession(Map<String, String> map) {
        return FeedScannerSession.builder()
                .sessionId(map.get("sessionId"))
                .userId(map.get("userId"))
                .scopeHash(map.get("scopeHash"))
                .endpointKind(parseEndpoint(map.get("endpointKind")))
                .topicParam(emptyToNull(map.get("topicParam")))
                .countryIds(decodeIntCsv(map.get("countryIds")))
                .newestCursor(parseLongOrZero(map.get("newestCursor")))
                .olderCursor(parseLongOrZero(map.get("olderCursor")))
                .pendingWindowStart(parseLongOrZero(map.get("pendingWindowStart")))
                .pendingWindowEnd(parseLongOrZero(map.get("pendingWindowEnd")))
                .bufferIds(decodeStringCsv(map.get("bufferIds")))
                .createdAt(parseLongOrZero(map.get("createdAt")))
                .updatedAt(parseLongOrZero(map.get("updatedAt")))
                .build();
    }

    /* ------------------- encoders ------------------- */

    private String encodeIntCsv(List<Integer> values) {
        if (values == null || values.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(CSV);
            sb.append(values.get(i));
        }
        return sb.toString();
    }

    private List<Integer> decodeIntCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        return Arrays.stream(csv.split(CSV))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(Integer::parseInt)
                .toList();
    }

    /** CSV with comma + percent escaped per element, so any embedded special chars survive. */
    private String encodeStringCsv(List<String> values) {
        if (values == null || values.isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < values.size(); i++) {
            if (i > 0) sb.append(CSV);
            sb.append(escapeForCsv(values.get(i)));
        }
        return sb.toString();
    }

    private List<String> decodeStringCsv(String csv) {
        if (csv == null || csv.isBlank()) return List.of();
        String[] parts = csv.split(CSV, -1);
        List<String> out = new ArrayList<>(parts.length);
        for (String p : parts) {
            out.add(unescapeFromCsv(p));
        }
        return out;
    }

    private String escapeForCsv(String value) {
        if (value == null) return "";
        return value.replace("%", CSV_ENCODE_PERCENT).replace(",", CSV_ENCODE_COMMA);
    }

    private String unescapeFromCsv(String value) {
        if (value == null) return "";
        // Order is critical: undo comma escape first, then percent.
        return value.replace(CSV_ENCODE_COMMA, ",").replace(CSV_ENCODE_PERCENT, "%");
    }

    private EndpointKind parseEndpoint(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            return EndpointKind.valueOf(value);
        } catch (IllegalArgumentException ex) {
            return null;
        }
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
