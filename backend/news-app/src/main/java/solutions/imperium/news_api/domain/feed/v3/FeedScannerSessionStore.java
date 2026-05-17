package solutions.imperium.news_api.domain.feed.v3;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerSession;

import java.time.Duration;
import java.util.Optional;

/**
 * Persistence + locking for {@link FeedScannerSession}. Sessions live under
 * {@code feed:session:{userId}:{sessionId}} as a HASH; per-session locks live under
 * {@code feed:lock:{userId}:{sessionId}} as a STRING with token + TTL.
 */
public interface FeedScannerSessionStore {

    Mono<Optional<FeedScannerSession>> find(String userId, String sessionId);

    Mono<FeedScannerSession> save(FeedScannerSession session, Duration ttl);

    Mono<Boolean> acquireLock(String userId, String sessionId, String token, Duration ttl);

    Mono<Boolean> releaseLock(String userId, String sessionId, String token);
}
