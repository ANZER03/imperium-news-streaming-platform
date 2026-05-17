package solutions.imperium.news_api.domain.feed.v3;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.Limit;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.feed.v3.model.Candidate;
import solutions.imperium.news_api.domain.feed.v3.model.CandidateSource;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Redis-backed implementation of {@link CandidateWindowScanner}. Uses
 * {@code ZREVRANGEBYSCORE} per (country, topic) ZSET (or per country fallback ZSET) with
 * bounded concurrency, then deduplicates and sorts in Java.
 *
 * <p>No Lua. No read-state awareness. Pagination state and exact-id filtering live elsewhere.
 */
@Component
@RequiredArgsConstructor
public class RedisCandidateWindowScanner implements CandidateWindowScanner {

    private final ReactiveStringRedisTemplate redis;
    private final FeedScannerProperties properties;

    @Override
    public Mono<List<Candidate>> scan(List<Integer> countryIds,
                                      List<String> topics,
                                      boolean useFallback,
                                      long windowStart,
                                      long windowEnd,
                                      int perTopicLimit) {
        if (countryIds == null || countryIds.isEmpty()) {
            return Mono.just(List.of());
        }
        if (windowEnd < windowStart) {
            return Mono.just(List.of());
        }
        boolean fallbackOnly = useFallback || topics == null || topics.isEmpty();
        int limit = Math.max(1, perTopicLimit);

        List<Spec> specs = new ArrayList<>();
        for (Integer countryId : countryIds) {
            if (fallbackOnly) {
                specs.add(new Spec(
                        String.format(Constants.KEY_FEED_COUNTRY, countryId),
                        countryId, null, CandidateSource.FALLBACK));
            } else {
                for (String topic : topics) {
                    specs.add(new Spec(
                            String.format(Constants.KEY_FEED_COUNTRY_TOPIC, countryId, topic),
                            countryId, topic, CandidateSource.PRIMARY));
                }
            }
        }
        if (specs.isEmpty()) return Mono.just(List.of());

        int concurrency = Math.max(1, properties.getScannerConcurrency());
        Range<Double> range = Range.closed((double) windowStart, (double) windowEnd);
        Limit fetchLimit = Limit.limit().count(limit);

        return Flux.fromIterable(specs)
                .flatMap(spec -> redis.opsForZSet()
                        .reverseRangeByScoreWithScores(spec.key, range, fetchLimit)
                        .map(tuple -> tupleToCandidate(tuple, spec))
                        .collectList(), concurrency)
                .collectList()
                .map(this::mergeAndOrder);
    }

    private Candidate tupleToCandidate(org.springframework.data.redis.core.ZSetOperations.TypedTuple<String> tuple,
                                       Spec spec) {
        String articleId = tuple.getValue();
        Double score = tuple.getScore();
        long raw = score == null ? 0L : score.longValue();
        return new Candidate(articleId, raw, spec.countryId, spec.topic, spec.source);
    }

    private List<Candidate> mergeAndOrder(List<List<Candidate>> perKey) {
        Map<String, Candidate> dedup = new HashMap<>();
        for (List<Candidate> bucket : perKey) {
            for (Candidate c : bucket) {
                if (c == null || c.articleId() == null) continue;
                Candidate existing = dedup.get(c.articleId());
                if (existing == null || c.rawScore() > existing.rawScore()) {
                    dedup.put(c.articleId(), c);
                }
            }
        }
        List<Candidate> merged = new ArrayList<>(dedup.values());
        merged.sort(Comparator
                .comparingLong(Candidate::rawScore).reversed()
                .thenComparing(Candidate::articleId));
        return merged;
    }

    private record Spec(String key, int countryId, String topic, CandidateSource source) {}
}
