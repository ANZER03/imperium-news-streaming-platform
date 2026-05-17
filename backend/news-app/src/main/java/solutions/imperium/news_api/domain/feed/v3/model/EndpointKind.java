package solutions.imperium.news_api.domain.feed.v3.model;

/** What feed surface this request targets. Drives scope hash and stage selection. */
public enum EndpointKind {
    PERSONALIZED,
    TOPIC,
    LATEST
}
