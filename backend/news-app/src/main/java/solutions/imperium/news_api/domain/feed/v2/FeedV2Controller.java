package solutions.imperium.news_api.domain.feed.v2;

import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v2.model.BuildRequest;

@RestController
@RequestMapping("/api/v2/feed")
@RequiredArgsConstructor
public class FeedV2Controller {

    private final FeedPipeline feedPipeline;
    private final FeedV2Properties properties;

    @GetMapping
    public Mono<PageResult<ArticleCardDto>> getFeed(
            @RequestParam String userId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Integer limit) {
        return feedPipeline.build(new BuildRequest(
                userId,
                BuildRequest.ENDPOINT_PERSONALIZED,
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
        return feedPipeline.build(new BuildRequest(
                userId,
                BuildRequest.ENDPOINT_TOPIC,
                topicId,
                sessionId,
                limit == null ? properties.getPageSizeDefault() : limit));
    }

    @GetMapping("/latest")
    public Mono<PageResult<ArticleCardDto>> getLatest(
            @RequestParam String userId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Integer limit) {
        return feedPipeline.build(new BuildRequest(
                userId,
                BuildRequest.ENDPOINT_LATEST,
                null,
                sessionId,
                limit == null ? properties.getPageSizeDefault() : limit));
    }
}
