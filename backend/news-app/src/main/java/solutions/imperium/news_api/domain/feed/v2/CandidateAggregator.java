package solutions.imperium.news_api.domain.feed.v2;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v2.model.AggregationRequest;
import solutions.imperium.news_api.domain.feed.v2.model.Candidate;

import java.util.List;

public interface CandidateAggregator {
    Mono<List<Candidate>> aggregate(AggregationRequest request);

    /**
     * Top raw score across the requested scope, used to seed the session anchor.
     */
    Mono<Long> topScoreForScope(List<Integer> countryIds, List<String> topics, boolean useFallback);
}
