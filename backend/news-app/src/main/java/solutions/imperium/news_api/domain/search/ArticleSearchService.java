package solutions.imperium.news_api.domain.search;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;

@Service
@RequiredArgsConstructor
public class ArticleSearchService {

    private final ArticleSearchRepository repository;
    private final ArticleSearchProperties properties;

    public Mono<PageResult<ArticleSearchHitDto>> search(ArticleSearchFilter filter) {
        int limit = sanitizeLimit(filter.limit());
        int page = Math.max(filter.page(), 0);
        ArticleSearchFilter sanitized = new ArticleSearchFilter(
                filter.query(),
                filter.sourceName(),
                filter.sourceDomain(),
                filter.countryId(),
                filter.countryName(),
                filter.languageCode(),
                filter.languageId(),
                filter.rubricId(),
                filter.classificationStatus(),
                filter.isVideo(),
                filter.date(),
                filter.from(),
                filter.to(),
                page,
                limit);

        return repository.search(sanitized)
                .map(result -> {
                    PageResult<ArticleSearchHitDto> pageResult = new PageResult<>(result.hits(), null);
                    pageResult.setSource("elasticsearch");
                    pageResult.setHasMore((long) (page + 1) * limit < result.total());
                    pageResult.setNextCursor(pageResult.getHasMore() ? (long) page + 1 : null);
                    return pageResult;
                });
    }

    private int sanitizeLimit(int requested) {
        if (requested <= 0) {
            return properties.getDefaultLimit();
        }
        return Math.min(requested, properties.getMaxLimit());
    }
}
