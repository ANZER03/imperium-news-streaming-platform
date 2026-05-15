package solutions.imperium.news_api.domain.feed.v2;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.RedisZSetCommands;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.feed.v2.model.AggregationRequest;
import solutions.imperium.news_api.domain.feed.v2.model.Candidate;
import solutions.imperium.news_api.domain.feed.v2.model.CandidateBucket;
import solutions.imperium.news_api.domain.feed.v2.model.CandidateSource;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class RedisCandidateAggregator implements CandidateAggregator {

    private final ReactiveStringRedisTemplate redis;

    private RedisScript<List> aggregateScript;

    @PostConstruct
    void loadScripts() throws IOException {
        String body = new String(new ClassPathResource("feed/v2/aggregate.lua")
                .getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        this.aggregateScript = RedisScript.of(body, List.class);
    }

    @Override
    public Mono<List<Candidate>> aggregate(AggregationRequest request) {
        if (request.countryIds() == null || request.countryIds().isEmpty()) {
            return Mono.just(List.of());
        }

        CandidateSource source = request.useFallback() ? CandidateSource.FALLBACK : CandidateSource.PRIMARY;

        return Flux.fromIterable(request.countryIds())
                .flatMap(countryId -> aggregateForCountry(countryId, request, source))
                .collectList()
                .map(perCountry -> mergeAcrossCountries(perCountry));
    }

    @Override
    public Mono<Long> topScoreForScope(List<Integer> countryIds, List<String> topics, boolean useFallback) {
        if (countryIds == null || countryIds.isEmpty()) {
            return Mono.just(0L);
        }
        return Flux.fromIterable(countryIds)
                .flatMap(countryId -> {
                    List<String> keys = keysForScope(countryId, topics, useFallback);
                    return Flux.fromIterable(keys)
                            .flatMap(key -> redis.opsForZSet()
                                    .reverseRangeByScoreWithScores(key, Range.unbounded(), RedisZSetCommands.Limit.limit().count(1))
                                    .next()
                                    .map(tuple -> tuple.getScore() == null ? 0.0 : tuple.getScore())
                                    .defaultIfEmpty(0.0));
                })
                .reduce(0.0, Math::max)
                .map(Double::longValue);
    }

    private Mono<List<Candidate>> aggregateForCountry(int countryId, AggregationRequest request, CandidateSource source) {
        List<String> keys = keysForScope(countryId, request.topics(), request.useFallback());
        if (keys.isEmpty()) {
            return Mono.just(List.of());
        }

        List<String> args = new ArrayList<>();
        args.add(Long.toString(request.sessionAnchor()));
        args.add(Long.toString(request.seekCursor()));
        args.add(Integer.toString(request.injectPerTopic()));
        args.add(Integer.toString(request.scrollPerTopic()));
        args.add(request.includeInject() ? "1" : "0");
        args.add(Double.toString(request.weightScale()));
        for (int i = 0; i < keys.size(); i++) {
            args.add("1.0");
        }

        return redis.execute(aggregateScript, keys, args)
                .next()
                .map(raw -> parseScriptOutput(raw, countryId, source))
                .defaultIfEmpty(List.of());
    }

    @SuppressWarnings("unchecked")
    private List<Candidate> parseScriptOutput(Object raw, int countryId, CandidateSource source) {
        List<Object> flat;
        if (raw instanceof List<?> list) {
            if (list.size() == 1 && list.get(0) instanceof List<?> inner) {
                flat = (List<Object>) inner;
            } else {
                flat = (List<Object>) list;
            }
        } else {
            return List.of();
        }
        List<Candidate> out = new ArrayList<>(flat.size() / 4);
        for (int i = 0; i + 3 < flat.size(); i += 4) {
            String bucketStr = String.valueOf(flat.get(i));
            String articleId = String.valueOf(flat.get(i + 1));
            long rawScore = parseLong(flat.get(i + 2));
            double adjusted = parseDouble(flat.get(i + 3));
            CandidateBucket bucket = "inject".equalsIgnoreCase(bucketStr)
                    ? CandidateBucket.INJECT
                    : CandidateBucket.SCROLL;
            out.add(new Candidate(articleId, rawScore, adjusted, countryId, bucket, source));
        }
        return out;
    }

    private List<Candidate> mergeAcrossCountries(List<List<Candidate>> perCountry) {
        Map<String, Candidate> deduped = new HashMap<>();
        for (List<Candidate> bucket : perCountry) {
            for (Candidate candidate : bucket) {
                Candidate existing = deduped.get(candidate.articleId());
                if (existing == null
                        || candidate.rawScore() > existing.rawScore()
                        || (candidate.rawScore() == existing.rawScore() && candidate.adjustedScore() > existing.adjustedScore())) {
                    deduped.put(candidate.articleId(), candidate);
                }
            }
        }
        List<Candidate> merged = new ArrayList<>(deduped.values());
        merged.sort(Comparator
                .comparingLong(Candidate::rawScore).reversed()
                .thenComparing(Comparator.comparingDouble(Candidate::adjustedScore).reversed())
                .thenComparing(Candidate::articleId));
        return merged;
    }

    private List<String> keysForScope(int countryId, List<String> topics, boolean useFallback) {
        if (useFallback || topics == null || topics.isEmpty()) {
            return List.of(String.format(Constants.KEY_FEED_COUNTRY, countryId));
        }
        List<String> out = new ArrayList<>(topics.size());
        for (String topic : topics) {
            out.add(String.format(Constants.KEY_FEED_COUNTRY_TOPIC, countryId, topic));
        }
        return out;
    }

    private long parseLong(Object value) {
        if (value == null) return 0L;
        if (value instanceof Number n) return n.longValue();
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return 0L;
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException ex) {
            return (long) Double.parseDouble(text);
        }
    }

    private double parseDouble(Object value) {
        if (value == null) return 0.0;
        if (value instanceof Number n) return n.doubleValue();
        String text = String.valueOf(value).trim();
        if (text.isEmpty()) return 0.0;
        return Double.parseDouble(text);
    }
}
