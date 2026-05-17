package solutions.imperium.news_api.domain.feed.v3.model;

/**
 * Inbound request to the feed-scanner pipeline. {@code topicParam} is required for
 * {@link EndpointKind#TOPIC} and ignored for the other endpoints.
 */
public record BuildFeedRequest(
        String userId,
        EndpointKind endpointKind,
        String topicParam,
        String sessionId,
        int limit
) {
}
