package solutions.imperium.news_api.domain.trend;

import com.fasterxml.jackson.databind.ObjectMapper;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.country.CountryRepository;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v1.FeedRepository;
import solutions.imperium.news_api.domain.trend.dto.TrendKeywordDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrendService {

    private final ReactiveStringRedisTemplate redisTemplate;
    private final FeedRepository feedRepository;
    private final CountryRepository countryRepository;
    private final ObjectMapper objectMapper;

    public Flux<TrendKeywordDto> getExploreTrends(String country, String topic) {
        String safeCountry = safeKeySegment(country);
        String safeTopic = safeKeySegment(topic);
        
        String zsetKey = buildZsetKey(safeCountry, safeTopic);
        
        return redisTemplate.opsForZSet().reverseRange(zsetKey, org.springframework.data.domain.Range.closed(0L, 49L))
                .flatMap(term -> {
                    String metaKey = buildMetaKey(safeCountry, safeTopic, safeKeySegment(term));
                    return fetchMetadata(metaKey, term);
                });
    }

    public Mono<PageResult<ArticleCardDto>> getExploreArticles(String country, String topic, String keyword, int limit) {
        String resolvedCountry = "global".equalsIgnoreCase(country) ? null : country;

        if (StringUtils.hasText(keyword)) {
            return getArticlesByKeyword(resolvedCountry, topic, keyword, limit);
        } else {
            return getArticlesByContext(resolvedCountry, topic, limit);
        }
    }

    private Mono<PageResult<ArticleCardDto>> getArticlesByKeyword(String country, String topic, String keyword, int limit) {
        String safeCountry = safeKeySegment(country);
        String safeTopic = safeKeySegment(topic);
        String safeKeyword = safeKeySegment(keyword);
        String metaKey = buildMetaKey(safeCountry, safeTopic, safeKeyword);

        return redisTemplate.opsForHash().get(metaKey, "article_ids")
                .map(String::valueOf)
                .flatMap(idsStr -> {
                    if (!StringUtils.hasText(idsStr)) {
                        return Mono.just(new PageResult<ArticleCardDto>(Collections.emptyList(), null));
                    }
                    List<String> ids = Arrays.stream(idsStr.split(","))
                            .filter(StringUtils::hasText)
                            .limit(limit * 3L)
                            .collect(Collectors.toList());

                    if (ids.isEmpty()) {
                        return Mono.just(new PageResult<ArticleCardDto>(Collections.emptyList(), null));
                    }

                    return Flux.fromIterable(ids)
                            .flatMap(id -> feedRepository.getArticleMetadataWithFallback(id)
                                    .map(map -> {
                                        ArticleCardDto dto = objectMapper.convertValue(map, ArticleCardDto.class);
                                        dto.setId(id);
                                        return dto;
                                    }))
                            .collectList()
                            .map(list -> {
                                list.sort((a, b) -> Long.compare(
                                        b.getPublishedAt() == null ? 0 : b.getPublishedAt(),
                                        a.getPublishedAt() == null ? 0 : a.getPublishedAt()
                                ));
                                List<ArticleCardDto> limitedList = list.stream().limit(limit).collect(Collectors.toList());
                                Long nextCursor = limitedList.isEmpty() ? null : limitedList.get(limitedList.size() - 1).getPublishedAt();
                                return new PageResult<>(limitedList, nextCursor);
                            });
                })
                .defaultIfEmpty(new PageResult<>(Collections.emptyList(), null));
    }

    private Mono<PageResult<ArticleCardDto>> getArticlesByContext(String country, String topic, int limit) {
        Mono<Integer> countryIdMono;
        if (StringUtils.hasText(country)) {
            countryIdMono = countryRepository.findAll()
                    .filter(c -> c.getCountryName().equalsIgnoreCase(country))
                    .map(c -> c.getCountryId())
                    .next()
                    .defaultIfEmpty(0);
        } else {
            countryIdMono = Mono.just(0);
        }

        return countryIdMono.flatMap(countryId -> {
            Flux<solutions.imperium.news_api.domain.feed.v1.ScoredArticle> articleIdsFlux;
            double cursor = Double.MAX_VALUE;

            if (countryId == 0) {
                if (StringUtils.hasText(topic)) {
                    articleIdsFlux = feedRepository.getArticleIdsByTopicWithScores(topic, cursor, limit);
                } else {
                    articleIdsFlux = feedRepository.getArticleIdsByCountryWithScores(0, cursor, limit);
                }
            } else {
                if (StringUtils.hasText(topic)) {
                    articleIdsFlux = feedRepository.getArticleIdsByCountryAndTopicWithScores(countryId, topic, cursor, limit);
                } else {
                    articleIdsFlux = feedRepository.getArticleIdsByCountryWithScores(countryId, cursor, limit);
                }
            }

            return articleIdsFlux
                    .flatMap(scoredArticle -> feedRepository.getArticleMetadataWithFallback(scoredArticle.id())
                            .map(map -> {
                                ArticleCardDto dto = objectMapper.convertValue(map, ArticleCardDto.class);
                                dto.setId(scoredArticle.id());
                                dto.setScore(scoredArticle.score());
                                return dto;
                            }))
                    .collectList()
                    .map(list -> {
                        Long nextCursor = list.isEmpty() ? null : list.get(list.size() - 1).getPublishedAt();
                        return new PageResult<>(list, nextCursor);
                    });
        });
    }

    private String buildZsetKey(String country, String topic) {
        boolean hasCountry = StringUtils.hasText(country);
        boolean hasTopic = StringUtils.hasText(topic);

        if (hasCountry && hasTopic) {
            return String.format("trend:country_topic:%s:%s:5h", country, topic);
        } else if (hasCountry) {
            return String.format("trend:country:%s:5h", country);
        } else if (hasTopic) {
            return String.format("trend:global_topic:%s:5h", topic);
        } else {
            return "trend:global:5h";
        }
    }

    public String buildMetaKey(String country, String topic, String term) {
        boolean hasCountry = StringUtils.hasText(country);
        boolean hasTopic = StringUtils.hasText(topic);

        String scopeType;
        String scopeValue;

        if (hasCountry && hasTopic) {
            scopeType = "country_topic";
            scopeValue = String.format("%s|%s", country, topic);
        } else if (hasCountry) {
            scopeType = "country";
            scopeValue = country;
        } else if (hasTopic) {
            scopeType = "global_topic";
            scopeValue = String.format("global|%s", topic);
        } else {
            scopeType = "global";
            scopeValue = "global";
        }

        return String.format("trend:meta:%s:%s:%s", safeKeySegment(scopeType), safeKeySegment(scopeValue), term);
    }

    private Mono<TrendKeywordDto> fetchMetadata(String metaKey, String term) {
        return redisTemplate.opsForHash().entries(metaKey)
                .collectMap(
                        entry -> (String) entry.getKey(),
                        entry -> (String) entry.getValue()
                )
                .map(map -> mapToDto(map, term))
                .defaultIfEmpty(TrendKeywordDto.builder().term(term).build());
    }

    private TrendKeywordDto mapToDto(Map<String, String> data, String term) {
        if (data.isEmpty()) {
            return TrendKeywordDto.builder().term(term).build();
        }

        String articleIdsStr = data.getOrDefault("article_ids", "");
        List<String> articleIds = StringUtils.hasText(articleIdsStr)
                ? Arrays.asList(articleIdsStr.split(","))
                : Collections.emptyList();

        return TrendKeywordDto.builder()
                .term(data.getOrDefault("term", term))
                .termType(data.getOrDefault("term_type", ""))
                .articleIds(articleIds)
                .currentCount(parseIntSafe(data.get("current_count")))
                .previousCount(parseIntSafe(data.get("previous_count")))
                .velocity(parseDoubleSafe(data.get("velocity")))
                .score(parseDoubleSafe(data.get("score")))
                .updatedAt(data.getOrDefault("updated_at", ""))
                .build();
    }

    private int parseIntSafe(String val) {
        if (!StringUtils.hasText(val)) return 0;
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private double parseDoubleSafe(String val) {
        if (!StringUtils.hasText(val)) return 0.0;
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    public String safeKeySegment(String value) {
        if (!StringUtils.hasText(value)) return value;
        return value.trim().toLowerCase().replaceAll("[^a-z0-9_\\-\\.\\u0600-\\u06FF\\u0750-\\u077F\\u00C0-\\u024F]", "_");
    }
}

