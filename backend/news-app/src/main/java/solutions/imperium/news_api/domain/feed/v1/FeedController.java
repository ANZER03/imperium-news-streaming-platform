package solutions.imperium.news_api.domain.feed.v1;

import solutions.imperium.news_api.domain.feed.v1.FeedService;

import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.List;

@RestController
@RequestMapping("/api/v1/feed")
@RequiredArgsConstructor
public class FeedController {

    private final FeedService feedService;

    // Fetch the feed
    @GetMapping
    public Mono<PageResult<ArticleCardDto>> getFeed(
            @RequestParam String userId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Long sessionCursor,
            @RequestParam(defaultValue = "40") int limit) {
        return feedService.generateFeed(userId, sessionId, cursor, sessionCursor, limit);
    }

    // Articles filtered by country+topic (header topic click)
    @GetMapping("/topic")
    public Mono<PageResult<ArticleCardDto>> getByTopic(
            @RequestParam String userId,
            @RequestParam String topicId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Long sessionCursor,
            @RequestParam(defaultValue = "40") int limit) {
        return feedService.getByTopic(userId, topicId, sessionId, cursor, sessionCursor, limit);
    }

    // Latest articles from user's country (Latest tab)
    @GetMapping("/latest")
    public Mono<PageResult<ArticleCardDto>> getLatest(
            @RequestParam String userId,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) Long cursor,
            @RequestParam(required = false) Long sessionCursor,
            @RequestParam(defaultValue = "40") int limit) {
        return feedService.getLatest(userId, sessionId, cursor, sessionCursor, limit);
    }

    // Track views (Called by frontend when user scrolls past cards)
    @PostMapping("/views")
    public Mono<Void> trackViews(@RequestBody ViewTrackingReq req) {
        return feedService.trackViews(req.getUserId(), req.getArticleIds());
    }
}

@Data
class ViewTrackingReq {
    private String userId;
    private List<String> articleIds;
}
