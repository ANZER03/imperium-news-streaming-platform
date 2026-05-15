package solutions.imperium.news_api.domain.feed;

public record FeedCandidate(
        String id,
        double rawScore,
        double adjustedScore,
        FeedCandidateBucket bucket,
        FeedCandidateSource source
) {
}
