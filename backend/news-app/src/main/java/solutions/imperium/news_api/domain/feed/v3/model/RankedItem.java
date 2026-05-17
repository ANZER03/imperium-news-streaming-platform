package solutions.imperium.news_api.domain.feed.v3.model;

/** A {@link Candidate} after ranking, carrying the computed final score. */
public record RankedItem(Candidate candidate, double finalScore) {
}
