package solutions.imperium.news_api.domain.feed;

import com.fasterxml.jackson.databind.ObjectMapper;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class FeedService {

    private final FeedRepository feedRepository;
    private final ObjectMapper objectMapper;

    public Mono<PageResult<ArticleCardDto>> generateFeed(String userId, Long cursor, int limit) {
        // [0] Normalize cursor to epoch-seconds (handle ms input from clients)
        long rawCursor = (cursor == null || cursor == 0) ? System.currentTimeMillis() : cursor;
        double safeCursor = rawCursor > 20_000_000_000L ? rawCursor / 1000.0 : (double) rawCursor;

        int fetchPerSource = limit * 3;

        // [1] Load user prefs in parallel
        Mono<List<String>> topicsMono = feedRepository.getUserTopics(userId);
        Mono<Integer> countryMono = feedRepository.getUserCountryId(userId);

        return Mono.zip(topicsMono, countryMono)
                .flatMap(prefs -> {
                    List<String> topics = prefs.getT1();
                    int countryId = prefs.getT2();

                    // [2] PHASE 1 — fan-out to all user topic ZSETs in parallel
                    Mono<List<ScoredArticle>> phase1 = Flux.fromIterable(topics)
                            .flatMap(topic -> feedRepository.getArticleIdsByTopicWithScores(topic, safeCursor, fetchPerSource))
                            .collectList();

                    return phase1.flatMap(topicCandidates -> {
                        Mono<List<ScoredArticle>> candidatesMono;

                        if (!topicCandidates.isEmpty()) {
                            // Phase 1 has results — use them
                            candidatesMono = Mono.just(topicCandidates);
                        } else {
                            // [3] PHASE 2 — country fallback
                            candidatesMono = feedRepository
                                    .getArticleIdsByCountryWithScores(countryId, safeCursor, limit * 4)
                                    .collectList();
                        }

                        return candidatesMono.flatMap(candidates ->
                                buildPage(userId, candidates, limit));
                    });
                });
    }

    private Mono<PageResult<ArticleCardDto>> buildPage(String userId, List<ScoredArticle> candidates, int limit) {
        if (candidates.isEmpty()) {
            return Mono.just(new PageResult<>(List.of(), null));
        }

        // [4] Dedup by id — keep highest score per id
        Map<String, Double> best = new LinkedHashMap<>();
        for (ScoredArticle sa : candidates) {
            best.merge(sa.id(), sa.score(), Math::max);
        }

        // [5] Filter viewed
        return feedRepository.getAppearedArticles(userId).flatMap(viewedIds -> {
            Set<String> viewed = new HashSet<>(viewedIds);

            // [6] Sort by score DESC, remove viewed
            List<ScoredArticle> sorted = best.entrySet().stream()
                    .filter(e -> !viewed.contains(e.getKey()))
                    .sorted(Map.Entry.<String, Double>comparingByValue().reversed())
                    .map(e -> new ScoredArticle(e.getKey(), e.getValue()))
                    .collect(Collectors.toList());

            if (sorted.isEmpty()) {
                return Mono.just(new PageResult<>(List.of(), null));
            }

            // [7] Hydrate top (limit*2) to tolerate missing hashes
            List<ScoredArticle> toHydrate = sorted.stream().limit(limit * 2L).collect(Collectors.toList());

            return Flux.fromIterable(toHydrate)
                    .flatMap(sa -> feedRepository.getArticleMetadata(sa.id())
                            .map(map -> {
                                ArticleCardDto dto = mapToDto(sa.id(), map);
                                dto.setScore(sa.score());
                                return dto;
                            }))
                    .collectList()
                    .map(hydrated -> {
                        // [8] Sort hydrated by score DESC, take limit
                        hydrated.sort(Comparator.comparingDouble(ArticleCardDto::getScore).reversed());
                        List<ArticleCardDto> page = hydrated.stream().limit(limit).collect(Collectors.toList());

                        // [9] nextCursor = min score in returned page (epoch-seconds, exclusive on next call)
                        Long nextCursor = page.isEmpty() ? null
                                : (long) page.stream()
                                        .mapToDouble(ArticleCardDto::getScore)
                                        .min()
                                        .getAsDouble();

                        return new PageResult<>(page, nextCursor);
                    });
        });
    }

    public Mono<Void> trackViews(String userId, List<String> articleIds) {
        if (articleIds == null || articleIds.isEmpty()) return Mono.empty();
        return feedRepository.markArticlesAsViewed(userId, articleIds).then();
    }

    private ArticleCardDto mapToDto(String id, Map<String, String> map) {
        ArticleCardDto dto = objectMapper.convertValue(map, ArticleCardDto.class);
        dto.setId(id);
        return dto;
    }
}
