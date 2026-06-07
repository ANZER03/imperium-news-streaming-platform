package solutions.imperium.news_api.domain.trend;

import solutions.imperium.news_api.domain.trend.dto.TrendKeywordDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class TrendController {

    private final TrendService trendService;

    @GetMapping("/trends/explore")
    public Flux<TrendKeywordDto> getExploreTrends(
            @RequestParam(required = false) String country,
            @RequestParam(required = false) String topic) {
        return trendService.getExploreTrends(country, topic);
    }
}
