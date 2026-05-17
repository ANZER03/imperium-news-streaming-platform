package solutions.imperium.news_api.domain.feed.v3;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v3.model.BuildFeedRequest;

/**
 * Entry point for the V3 feed-scanner pipeline. Implementations are responsible for the full
 * Phase A → B → C flow, hydration, and committing read state. Returned {@link PageResult}
 * always carries a non-null {@code sessionId}.
 */
public interface FeedScannerPipeline {

    Mono<PageResult<ArticleCardDto>> build(BuildFeedRequest request);
}
