package solutions.imperium.news_api.domain.feed.v3;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;
import solutions.imperium.news_api.domain.feed.v3.model.ReadState;

import java.util.Collection;
import java.util.Set;

/**
 * Stores the V3 read-state for a (userId, scopeHash):
 * <ul>
 *     <li>{@code feed:read:intervals:{userId}:{scopeHash}} — JSON STRING of normalized intervals.</li>
 *     <li>{@code feed:read:ids:{userId}:{scopeHash}} — Redis SET of recent exact-read IDs.</li>
 * </ul>
 *
 * <p>All write paths refresh TTLs to keep state cleanup automatic.
 */
public interface FeedScannerReadStateStore {

    /**
     * Loads and normalizes the interval list for the given scope. Intervals older than
     * {@code minValidTs} are dropped on load.
     */
    Mono<ReadState> loadReadState(String userId, String scopeHash, long minValidTs);

    /**
     * Returns the subset of {@code candidateIds} that is NOT in the user's exact-read SET. The
     * input order is preserved in the returned set's iteration order.
     */
    Mono<Set<String>> filterUnreadIds(String userId, String scopeHash, Collection<String> candidateIds);

    /** Adds the given {@code ids} to the exact-read SET and refreshes TTL. Returns added count. */
    Mono<Long> addReadIds(String userId, String scopeHash, Collection<String> ids);

    /**
     * Merges {@code interval} into the stored interval list under {@code minValidTs} and writes
     * back the normalized result with TTL.
     */
    Mono<Void> addExhaustedInterval(String userId, String scopeHash, Interval interval, long minValidTs);
}
