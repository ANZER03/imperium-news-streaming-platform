package solutions.imperium.news_api.domain.feed.v3.model;

/** Source of a candidate during ranking — primary topic ZSETs vs country fallback ZSET. */
public enum CandidateSource {
    PRIMARY,
    FALLBACK
}
