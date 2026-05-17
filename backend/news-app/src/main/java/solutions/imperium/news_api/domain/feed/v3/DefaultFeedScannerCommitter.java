package solutions.imperium.news_api.domain.feed.v3;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerSession;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;

import java.time.Duration;
import java.util.Collection;
import java.util.List;

/**
 * Default committer: write read IDs → merge any new exhausted intervals → save session HASH.
 *
 * <p>Steps run sequentially so a failure in step 2 leaves step 1 already applied — that is the
 * correct safety stance because the user has seen those IDs and we must not double-serve them.
 * Session save is last so we never persist cursors past a state we have not actually committed
 * into read state.
 */
@Component
@RequiredArgsConstructor
public class DefaultFeedScannerCommitter implements FeedScannerCommitter {

    private final FeedScannerReadStateStore readStateStore;
    private final FeedScannerSessionStore sessionStore;
    private final FeedScannerProperties properties;

    @Override
    public Mono<FeedScannerSession> commit(String userId,
                                           String scopeHash,
                                           Collection<String> returnedIds,
                                           List<Interval> newExhaustedIntervals,
                                           FeedScannerSession session,
                                           long minValidTs) {
        Mono<Void> writeIds = readStateStore.addReadIds(userId, scopeHash, returnedIds).then();
        Mono<Void> mergeIntervals = newExhaustedIntervals == null || newExhaustedIntervals.isEmpty()
                ? Mono.empty()
                : Flux.fromIterable(newExhaustedIntervals)
                .concatMap(i -> readStateStore.addExhaustedInterval(userId, scopeHash, i, minValidTs))
                .then();
        Duration sessionTtl = Duration.ofHours(properties.getSessionTtlHours());
        return writeIds
                .then(mergeIntervals)
                .then(sessionStore.save(session, sessionTtl));
    }
}
