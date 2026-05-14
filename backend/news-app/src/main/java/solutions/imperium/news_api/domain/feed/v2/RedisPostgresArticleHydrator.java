package solutions.imperium.news_api.domain.feed.v2;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.article.Article;
import solutions.imperium.news_api.domain.article.ArticlePostgresRepository;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class RedisPostgresArticleHydrator implements ArticleHydrator {

    private static final Duration NEWS_HASH_TTL = Duration.ofDays(10);

    private final ReactiveStringRedisTemplate redis;
    private final ArticlePostgresRepository articlePostgresRepository;
    private final ObjectMapper objectMapper;
    private final FeedV2Properties properties;

    @Override
    public Mono<Map<String, ArticleCardDto>> hydrate(Collection<String> articleIds) {
        if (articleIds == null || articleIds.isEmpty()) {
            return Mono.just(Map.of());
        }
        List<String> distinct = new ArrayList<>(new LinkedHashSet<>(articleIds));
        int concurrency = Math.max(1, properties.getHydrationConcurrency());

        return Flux.fromIterable(distinct)
                .flatMap(id -> redis.<String, String>opsForHash().entries(newsKey(id))
                        .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                        .filter(map -> !map.isEmpty())
                        .map(map -> Map.entry(id, map))
                        .defaultIfEmpty(Map.entry(id, Map.<String, String>of())), concurrency)
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .flatMap(redisHits -> {
                    Map<String, ArticleCardDto> result = new HashMap<>(distinct.size());
                    List<String> misses = new ArrayList<>();
                    for (String id : distinct) {
                        Map<String, String> values = redisHits.get(id);
                        if (values == null || values.isEmpty()) {
                            misses.add(id);
                        } else {
                            result.put(id, mapToDto(id, values));
                        }
                    }
                    if (misses.isEmpty()) {
                        return Mono.just(result);
                    }
                    return hydrateFromPostgres(misses)
                            .doOnNext(found -> result.putAll(found))
                            .thenReturn(result);
                });
    }

    private Mono<Map<String, ArticleCardDto>> hydrateFromPostgres(List<String> missing) {
        return articlePostgresRepository.findAllByIds(missing)
                .collectList()
                .flatMap(articles -> {
                    if (articles.isEmpty()) {
                        return Mono.just(Map.of());
                    }
                    Map<String, ArticleCardDto> dtos = new LinkedHashMap<>();
                    return Flux.fromIterable(articles)
                            .flatMap(article -> {
                                Map<String, String> hash = articleToHash(article);
                                ArticleCardDto dto = mapToDto(article.getId(), hash);
                                dtos.put(article.getId(), dto);
                                String key = newsKey(article.getId());
                                return redis.<String, String>opsForHash().putAll(key, hash)
                                        .then(redis.expire(key, NEWS_HASH_TTL))
                                        .thenReturn(article);
                            })
                            .then(Mono.just((Map<String, ArticleCardDto>) dtos));
                });
    }

    private ArticleCardDto mapToDto(String id, Map<String, String> values) {
        ArticleCardDto dto = objectMapper.convertValue(values, ArticleCardDto.class);
        dto.setId(id);
        return dto;
    }

    private Map<String, String> articleToHash(Article article) {
        Map<String, String> hash = new LinkedHashMap<>();
        putIfPresent(hash, "title", article.getTitle());
        putIfPresent(hash, "excerpt", excerpt(article.getBodyText()));
        putIfPresent(hash, "image_url", article.getImageUrl());
        putIfPresent(hash, "source_name", article.getSourceName());
        putIfPresent(hash, "published_at", article.getPublishedAt());
        putIfPresent(hash, "crawled_at", article.getCrawledAt());
        putIfPresent(hash, "processed_at", article.getProcessedAt());
        putIfPresent(hash, "root_topic_label", article.getPrimaryTopicLabel());
        return hash;
    }

    private void putIfPresent(Map<String, String> hash, String key, Object value) {
        if (value != null) hash.put(key, String.valueOf(value));
    }

    private String excerpt(String body) {
        if (body == null || body.isBlank()) return null;
        String trimmed = body.trim();
        return trimmed.length() <= 160 ? trimmed : trimmed.substring(0, 160);
    }

    private String newsKey(String articleId) {
        return String.format(Constants.KEY_NEWS_HASH, articleId);
    }
}
