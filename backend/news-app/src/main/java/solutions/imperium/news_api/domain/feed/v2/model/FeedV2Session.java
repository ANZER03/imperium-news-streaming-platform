package solutions.imperium.news_api.domain.feed.v2.model;

import lombok.Builder;
import lombok.Value;
import lombok.With;

import java.util.List;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Value
@Builder(toBuilder = true)
@With
public class FeedV2Session {
    String sessionId;
    String userId;
    String scopeFingerprint;
    String endpointKind;
    String topicParam;
    List<Integer> countryIds;
    long sessionAnchor;
    long scrollCursor;
    long createdAt;
    long lastAccessAt;

    public String countryIdsCsv() {
        return countryIds.stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    public static List<Integer> parseCountryCsv(String csv) {
        if (csv == null || csv.isBlank()) {
            return List.of();
        }
        return Stream.of(csv.split(","))
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .map(Integer::parseInt)
                .toList();
    }
}
