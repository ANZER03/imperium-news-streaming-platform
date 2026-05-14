package solutions.imperium.news_api.domain.feed.v2.model;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

public record FeedScope(
        String endpointKind,
        List<Integer> countryIds,
        String topicParam,
        long prefsVersion,
        int weightConfigVersion
) {
    public String fingerprint() {
        String countries = countryIds.stream()
                .sorted()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
        String raw = endpointKind + "|" + countries + "|" + topicParam + "|" + prefsVersion + "|" + weightConfigVersion;
        return UUID.nameUUIDFromBytes(raw.getBytes(StandardCharsets.UTF_8)).toString();
    }
}
