package solutions.imperium.news_api.domain.feed.v3.model;

/**
 * Raw candidate fetched from a topic or country ZSET. {@code rawScore} is the article's
 * publication timestamp (ZSET score). {@code topic} is the topic key from which the candidate
 * was sourced ({@code null} for country-fallback candidates).
 */
public record Candidate(
        String articleId,
        long rawScore,
        int countryId,
        String topic,
        CandidateSource source
) {
}
