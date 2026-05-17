package solutions.imperium.news_api.domain.feed.v3.model;

/**
 * Inclusive timestamp window the scanner intends to read from Redis. Distinct from
 * {@link Interval} (read-state) so the type system enforces the difference.
 */
public record Window(long startTs, long endTs) {

    public Window {
        if (endTs < startTs) {
            throw new IllegalArgumentException("Window endTs must be >= startTs: [" + startTs + "," + endTs + "]");
        }
    }

    public long span() {
        return endTs - startTs;
    }
}
