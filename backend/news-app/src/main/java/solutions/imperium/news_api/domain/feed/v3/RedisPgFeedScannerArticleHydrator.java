package solutions.imperium.news_api.domain.feed.v3;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v2.ArticleHydrator;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Default implementation of {@link FeedScannerArticleHydrator} that delegates to the V2
 * {@link ArticleHydrator} bean (Redis {@code news:{id}} HASH → PostgreSQL fallback → re-warm).
 *
 * <p>Reusing the V2 hydrator keeps both versions warming the same Redis cache and avoids
 * duplicating the Postgres fallback logic. This wrapper exists so the pipeline can later swap
 * to a different hydrator without touching the orchestration code.
 */
@Component
@RequiredArgsConstructor
public class RedisPgFeedScannerArticleHydrator implements FeedScannerArticleHydrator {

    private final ArticleHydrator delegate;

    @Override
    public Mono<List<ArticleCardDto>> hydrate(List<String> orderedIds) {
        if (orderedIds == null || orderedIds.isEmpty()) {
            return Mono.just(List.of());
        }
        return delegate.hydrate(orderedIds)
                .map(byId -> orderInputOrder(orderedIds, byId));
    }

    private List<ArticleCardDto> orderInputOrder(List<String> orderedIds, Map<String, ArticleCardDto> byId) {
        if (byId == null || byId.isEmpty()) return List.of();
        List<ArticleCardDto> out = new ArrayList<>(orderedIds.size());
        for (String id : orderedIds) {
            ArticleCardDto dto = byId.get(id);
            if (dto != null) out.add(dto);
        }
        return out;
    }
}
