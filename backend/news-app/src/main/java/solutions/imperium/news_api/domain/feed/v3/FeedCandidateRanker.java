package solutions.imperium.news_api.domain.feed.v3;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import solutions.imperium.news_api.domain.feed.v3.model.Candidate;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerScope;
import solutions.imperium.news_api.domain.feed.v3.model.RankedItem;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Java-side ranking. v1 score = {@code rawScore + topicWeight + freshnessBoost}. With default
 * properties (empty {@code topicWeights} and zero freshness coefficient) this reduces to pure
 * timestamp ordering with a deterministic articleId tiebreak. No diversity caps in v1.
 */
@Component
@RequiredArgsConstructor
public class FeedCandidateRanker {

    private final FeedScannerProperties properties;

    public List<RankedItem> rank(List<Candidate> candidates, FeedScannerScope scope, long nowMillis) {
        if (candidates == null || candidates.isEmpty()) return List.of();
        Map<String, Double> weights = properties.getTopicWeights();
        double freshnessCoef = properties.getFreshnessCoefficient();
        long graceMs = properties.getFreshnessGraceMs();

        List<RankedItem> ranked = new ArrayList<>(candidates.size());
        for (Candidate c : candidates) {
            double score = (double) c.rawScore();
            if (weights != null && c.topic() != null) {
                Double w = weights.get(c.topic());
                if (w != null) score += w;
            }
            if (freshnessCoef > 0d) {
                long ageMs = Math.max(0L, nowMillis - c.rawScore() - graceMs);
                score += freshnessCoef * (double) ageMs;
            }
            ranked.add(new RankedItem(c, score));
        }
        ranked.sort(Comparator
                .comparingDouble(RankedItem::finalScore).reversed()
                .thenComparing((RankedItem item) -> item.candidate().articleId()));
        return ranked;
    }
}
