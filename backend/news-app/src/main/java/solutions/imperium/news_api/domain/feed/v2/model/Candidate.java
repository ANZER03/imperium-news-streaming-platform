package solutions.imperium.news_api.domain.feed.v2.model;

public record Candidate(
        String articleId,
        long rawScore,
        double adjustedScore,
        int countryId,
        CandidateBucket bucket,
        CandidateSource source
) {
}
