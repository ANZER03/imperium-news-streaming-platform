package solutions.imperium.news_api.domain.feed;

import lombok.Builder;
import lombok.Value;

@Value
@Builder(toBuilder = true)
public class FeedSession {
    String sessionId;
    String userId;
    String scopeFingerprint;
    String endpointKind;
    Integer countryId;
    String topicParam;
    Long sessionAnchor;
    Long scrollCursor;
    Long createdAt;
    Long lastAccessAt;
}
