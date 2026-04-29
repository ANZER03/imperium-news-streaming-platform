package solutions.imperium.news_api.domain.feed;

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
            @RequestParam(required = false) Long cursor,
            @RequestParam(defaultValue = "20") int limit) {
        return feedService.generateFeed(userId, cursor, limit);
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
