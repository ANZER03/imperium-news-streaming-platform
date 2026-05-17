package solutions.imperium.news_api.domain.feed.v3.model;

import java.util.List;

/**
 * Resolved feed scope for one request. The {@code scopeHash} is sha256-derived and stable across
 * requests with equivalent inputs (country/topic order independent). Scope rotates whenever the
 * user changes followed topics, country, or any other parameter feeding the hash.
 */
public record FeedScannerScope(
        EndpointKind endpointKind,
        List<Integer> countryIds,
        String topicParam,
        List<String> topics,
        long prefsVersion,
        boolean topicsTruncated,
        String scopeHash
) {

    /** Whether this scope should fall back to the country ZSET (no topics). */
    public boolean isFallbackOnly() {
        return endpointKind == EndpointKind.LATEST || (topics == null || topics.isEmpty());
    }
}
