package solutions.imperium.news_api.domain.feed.v1;

import solutions.imperium.news_api.domain.feed.v1.FeedCandidateBucket;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidateSource;

public record FeedCandidate(
        String id,
        double rawScore,
        double adjustedScore,
        FeedCandidateBucket bucket,
        FeedCandidateSource source
) {
}
