package solutions.imperium.news_api.domain.search;

import java.util.List;

public record ArticleSearchResult(List<ArticleSearchHitDto> hits, long total) {
}
