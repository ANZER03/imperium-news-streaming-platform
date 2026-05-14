package solutions.imperium.news_api.domain.feed.v2;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;

import java.util.Collection;
import java.util.Map;

public interface ArticleHydrator {
    /**
     * Batched hydration: pipeline HGETALL for all ids, fall back to a single Postgres
     * batch query for misses, re-warm Redis hashes for any Postgres hit.
     */
    Mono<Map<String, ArticleCardDto>> hydrate(Collection<String> articleIds);
}
