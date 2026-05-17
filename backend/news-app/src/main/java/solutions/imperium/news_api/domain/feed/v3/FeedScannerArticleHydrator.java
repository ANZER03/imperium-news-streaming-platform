package solutions.imperium.news_api.domain.feed.v3;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;

import java.util.List;

/**
 * Hydrates ordered article IDs into {@link ArticleCardDto}s, preserving the input order and
 * silently dropping IDs that cannot be resolved.
 */
public interface FeedScannerArticleHydrator {

    Mono<List<ArticleCardDto>> hydrate(List<String> orderedIds);
}
