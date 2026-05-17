package solutions.imperium.news_api.domain.feed.v3.model;

import java.util.List;

/**
 * Snapshot of read-state for one (userId, scopeHash). Intervals are normalized
 * (sorted, merged, expired-dropped). The exact-id check is intentionally lazy and
 * delegated to the store via {@code FeedScannerReadStateStore.filterUnreadIds} so we
 * never load the entire read-id set into memory.
 */
public record ReadState(List<Interval> intervals) {

    public static ReadState empty() {
        return new ReadState(List.of());
    }
}
