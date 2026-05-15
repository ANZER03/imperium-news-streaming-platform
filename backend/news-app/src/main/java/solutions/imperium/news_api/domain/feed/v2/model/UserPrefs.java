package solutions.imperium.news_api.domain.feed.v2.model;

import java.util.List;

public record UserPrefs(
        List<Integer> countryIds,
        List<String> topics,
        long prefsVersion,
        boolean topicsTruncated
) {
}
