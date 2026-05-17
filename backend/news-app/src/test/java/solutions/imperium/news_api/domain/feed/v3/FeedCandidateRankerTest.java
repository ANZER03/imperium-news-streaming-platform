package solutions.imperium.news_api.domain.feed.v3;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import solutions.imperium.news_api.domain.feed.v3.model.Candidate;
import solutions.imperium.news_api.domain.feed.v3.model.CandidateSource;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerScope;
import solutions.imperium.news_api.domain.feed.v3.model.RankedItem;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class FeedCandidateRankerTest {

    private FeedScannerProperties properties;
    private FeedCandidateRanker ranker;

    @BeforeEach
    void setUp() {
        properties = new FeedScannerProperties();
        ranker = new FeedCandidateRanker(properties);
    }

    private Candidate c(String id, long score, String topic) {
        return new Candidate(id, score, 0, topic, CandidateSource.PRIMARY);
    }

    private FeedScannerScope scope() {
        return new FeedScannerScope(EndpointKind.PERSONALIZED, List.of(0), null,
                List.of("tech", "sports"), 1L, false, "h");
    }

    @Test
    void defaultWeights_pureTimeOrdering_articleIdTiebreak() {
        List<RankedItem> ranked = ranker.rank(List.of(
                c("b", 100, "tech"),
                c("a", 100, "tech"),
                c("c", 200, "sports")
        ), scope(), 0L);
        assertThat(ranked).extracting(r -> r.candidate().articleId()).containsExactly("c", "a", "b");
    }

    @Test
    void topicWeights_promoteCandidatesWithHigherWeight() {
        properties.setTopicWeights(Map.of("tech", 1000d));
        List<RankedItem> ranked = ranker.rank(List.of(
                c("a", 100, "tech"),
                c("b", 500, "sports")
        ), scope(), 0L);
        assertThat(ranked).extracting(r -> r.candidate().articleId()).containsExactly("a", "b");
    }

    @Test
    void freshnessBoost_addsAgeBasedScore_whenCoefficientPositive() {
        properties.setFreshnessCoefficient(0.001d);
        List<RankedItem> ranked = ranker.rank(List.of(
                c("old", 100, "tech"),
                c("new", 1_000_000, "tech")
        ), scope(), 1_000_000L);
        // The "new" article has age 0 so no boost; "old" has age 999900 * 0.001 = 999.9, which still
        // can't catch up to a 999900 raw-score gap. New stays first.
        assertThat(ranked).extracting(r -> r.candidate().articleId()).containsExactly("new", "old");
    }

    @Test
    void emptyInput_returnsEmpty() {
        assertThat(ranker.rank(List.of(), scope(), 0L)).isEmpty();
        assertThat(ranker.rank(null, scope(), 0L)).isEmpty();
    }

    @Test
    void unknownTopic_doesNotApplyWeight() {
        properties.setTopicWeights(Map.of("tech", 50d));
        List<RankedItem> ranked = ranker.rank(List.of(
                c("a", 100, "tech"),    // 100 + 50 = 150
                c("b", 120, "unknown")  // 120 + 0  = 120
        ), scope(), 0L);
        assertThat(ranked).extracting(r -> r.candidate().articleId()).containsExactly("a", "b");
    }
}
