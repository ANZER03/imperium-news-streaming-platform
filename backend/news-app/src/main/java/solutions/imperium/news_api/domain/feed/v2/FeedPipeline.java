package solutions.imperium.news_api.domain.feed.v2;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v2.model.BuildRequest;

public interface FeedPipeline {
    Mono<PageResult<ArticleCardDto>> build(BuildRequest request);
}
