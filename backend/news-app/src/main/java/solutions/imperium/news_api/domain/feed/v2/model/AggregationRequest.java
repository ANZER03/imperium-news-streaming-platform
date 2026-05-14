package solutions.imperium.news_api.domain.feed.v2.model;

import java.util.List;

public record AggregationRequest(
        List<Integer> countryIds,
        List<String> topics,
        long sessionAnchor,
        long seekCursor,
        int injectPerTopic,
        int scrollPerTopic,
        boolean includeInject,
        boolean useFallback,
        double weightScale
) {
}
