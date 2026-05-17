package solutions.imperium.news_api.domain.feed.v3.model;

import lombok.Builder;
import lombok.Value;
import lombok.With;

import java.util.List;

/**
 * Short-lived per-(user, sessionId) state used by the scanner to avoid rescanning dense
 * windows. {@code newestCursor} caps Phase A's lower bound; {@code olderCursor} drives
 * Phase C's downward stepping. {@code pendingWindowStart/End} together with
 * {@code bufferIds} carry leftover candidates from the previous request's last window.
 */
@Value
@Builder(toBuilder = true)
@With
public class FeedScannerSession {
    String sessionId;
    String userId;
    String scopeHash;
    EndpointKind endpointKind;
    String topicParam;
    List<Integer> countryIds;
    long newestCursor;
    long olderCursor;
    long pendingWindowStart;
    long pendingWindowEnd;
    List<String> bufferIds;
    long createdAt;
    long updatedAt;
}
