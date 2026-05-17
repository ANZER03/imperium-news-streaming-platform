package solutions.imperium.news_api.domain.feed.v3;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v3.model.BuildFeedRequest;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;

/**
 * V3 feed-scanner endpoints. Always-on alongside V2 (no feature flag). Maps to
 * {@code /api/v3/feed*} as required by the V3 PRD.
 */
@RestController
@RequestMapping("/api/v3/feed")
@RequiredArgsConstructor
public class FeedScannerController {

    private final FeedScannerPipeline pipeline;
    private final FeedScannerProperties properties;

    @GetMapping
    public Mono<PageResult<ArticleCardDto>> getFeed(
            @RequestParam String userId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Integer limit) {
        return pipeline.build(new BuildFeedRequest(
                userId,
                EndpointKind.PERSONALIZED,
                null,
                sessionId,
                limit == null ? properties.getPageSizeDefault() : limit));
    }

    @GetMapping("/topic")
    public Mono<PageResult<ArticleCardDto>> getByTopic(
            @RequestParam String userId,
            @RequestParam String topicId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Integer limit) {
        return pipeline.build(new BuildFeedRequest(
                userId,
                EndpointKind.TOPIC,
                topicId,
                sessionId,
                limit == null ? properties.getPageSizeDefault() : limit));
    }

    @GetMapping("/latest")
    public Mono<PageResult<ArticleCardDto>> getLatest(
            @RequestParam String userId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Integer limit) {
        return pipeline.build(new BuildFeedRequest(
                userId,
                EndpointKind.LATEST,
                null,
                sessionId,
                limit == null ? properties.getPageSizeDefault() : limit));
    }
}
