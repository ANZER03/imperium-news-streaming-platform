package solutions.imperium.news_api.domain.trend;

import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.trend.dto.TrendKeywordDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1/trends")
@RequiredArgsConstructor
public class TrendController {

    private final TrendService trendService;

    @GetMapping("/explore")
    public Flux<TrendKeywordDto> getExploreTrends(
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String topic) {
        String resolvedCountry = "global".equalsIgnoreCase(country) ? null : country;
        return trendService.getExploreTrends(resolvedCountry, topic);
    }

    @GetMapping("/explore/articles")
    public Mono<PageResult<ArticleCardDto>> getExploreArticles(
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String topic,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "40") int limit) {
        return trendService.getExploreArticles(country, topic, keyword, limit);
    }
}
