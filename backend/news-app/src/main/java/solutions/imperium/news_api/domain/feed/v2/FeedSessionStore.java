package solutions.imperium.news_api.domain.feed.v2;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v2.model.FeedV2Session;

import java.time.Duration;
import java.util.Optional;

public interface FeedSessionStore {
    Mono<Optional<FeedV2Session>> find(String userId, String sessionId);

    Mono<FeedV2Session> save(FeedV2Session session, Duration ttl);

    Mono<Boolean> acquireLock(String userId, String sessionId, String token, Duration ttl);

    Mono<Boolean> releaseLock(String userId, String sessionId, String token);
}
