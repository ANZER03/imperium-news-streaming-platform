package solutions.imperium.news_api.domain.article;

import com.fasterxml.jackson.databind.ObjectMapper;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.article.dto.ArticleDetailDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Map;

@Slf4j
@Repository
@RequiredArgsConstructor
public class ArticleRepository {

    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final ReactiveStringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public Mono<ArticleDetailDto> getCachedArticle(String articleId) {
        String key = String.format(Constants.KEY_ARTICLE_CACHE, articleId);
        return stringRedisTemplate.opsForValue().get(key)
                .flatMap(json -> {
                    try {
                        return Mono.just(objectMapper.readValue(json, ArticleDetailDto.class));
                    } catch (Exception e) {
                        log.warn("Failed to deserialize cached article {}: {}", articleId, e.getMessage());
                        return Mono.empty();
                    }
                });
    }

    public Mono<Boolean> cacheArticle(ArticleDetailDto dto) {
        String key = String.format(Constants.KEY_ARTICLE_CACHE, dto.getId());
        try {
            String json = objectMapper.writeValueAsString(dto);
            return stringRedisTemplate.opsForValue().set(key, json, Duration.ofHours(24));
        } catch (Exception e) {
            log.error("Failed to serialize article {} for cache", dto.getId(), e);
            return Mono.just(false);
        }
    }

    public Mono<Long> addBookmark(String userId, String articleId) {
        String key = String.format(Constants.KEY_USER_SAVED, userId);
        return redisTemplate.opsForSet().add(key, articleId);
    }

    public Mono<Long> removeBookmark(String userId, String articleId) {
        String key = String.format(Constants.KEY_USER_SAVED, userId);
        return redisTemplate.opsForSet().remove(key, articleId);
    }

    public Flux<String> getBookmarkedIds(String userId) {
        String key = String.format(Constants.KEY_USER_SAVED, userId);
        return redisTemplate.opsForSet().members(key)
                .map(String::valueOf);
    }

    public Mono<Map<String, String>> getArticleMetadata(String articleId) {
        String key = String.format(Constants.KEY_NEWS_HASH, articleId);
        return stringRedisTemplate.<String, String>opsForHash().entries(key)
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .filter(map -> !map.isEmpty());
    }
}
