package solutions.imperium.news_api.domain.feed.v3.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

/**
 * Inclusive timestamp interval representing a fully-exhausted feed window for a (user, scope).
 * {@code startTs} must be {@code <= endTs}. Serialized as a JSON tuple {@code [startTs, endTs]}
 * per V3 PRD §6.1, e.g. {@code [[1000,5000],[8000,12000]]}.
 */
@JsonFormat(shape = JsonFormat.Shape.ARRAY)
@JsonPropertyOrder({"startTs", "endTs"})
public record Interval(long startTs, long endTs) {

    @JsonCreator
    public Interval(@JsonProperty("startTs") long startTs, @JsonProperty("endTs") long endTs) {
        if (endTs < startTs) {
            throw new IllegalArgumentException("Interval endTs must be >= startTs: [" + startTs + "," + endTs + "]");
        }
        this.startTs = startTs;
        this.endTs = endTs;
    }

    public boolean contains(long ts) {
        return ts >= startTs && ts <= endTs;
    }
}
