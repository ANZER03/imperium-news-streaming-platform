package solutions.imperium.news_api.domain.feed.v2.model;

public record BuildRequest(
        String userId,
        String endpointKind,
        String topicParam,
        String sessionId,
        int limit
) {
    public static final String ENDPOINT_PERSONALIZED = "feed";
    public static final String ENDPOINT_TOPIC = "feed-topic";
    public static final String ENDPOINT_LATEST = "feed-latest";
}
