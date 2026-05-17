package solutions.imperium.news_api.domain.feed.v3;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerSession;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;

import java.util.Collection;
import java.util.List;

/**
 * Persists the side-effects of a successfully-built page: read IDs, exhausted intervals, and
 * the updated session. Intentionally separate from the pipeline so commit ordering is
 * verifiable in unit tests.
 */
public interface FeedScannerCommitter {

    /**
     * Atomically (with respect to the held session lock) writes:
     * <ol>
     *   <li>{@code SADD} returnedIds into the exact-read SET + refresh TTL.</li>
     *   <li>For each {@code newExhaustedIntervals}: {@code GET-merge-SET} into the intervals JSON
     *       under {@code minValidTs}.</li>
     *   <li>Save the updated {@code session} HASH with TTL.</li>
     * </ol>
     * Lock acquire/release is the caller's responsibility (typically via {@code Mono.usingWhen}).
     */
    Mono<FeedScannerSession> commit(String userId,
                                    String scopeHash,
                                    Collection<String> returnedIds,
                                    List<Interval> newExhaustedIntervals,
                                    FeedScannerSession session,
                                    long minValidTs);
}
