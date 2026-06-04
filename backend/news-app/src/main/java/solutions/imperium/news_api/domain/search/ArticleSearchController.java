package solutions.imperium.news_api.domain.search;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;

import java.time.LocalDate;
import java.time.OffsetDateTime;

@RestController
@RequestMapping("/api/v1/search")
@RequiredArgsConstructor
public class ArticleSearchController {

    private final ArticleSearchService searchService;

    @GetMapping("/articles")
    public Mono<PageResult<ArticleSearchHitDto>> searchArticles(
            @RequestParam(name = "q", required = false) String query,
            @RequestParam(required = false) String sourceName,
            @RequestParam(required = false) String sourceDomain,
            @RequestParam(required = false) Integer countryId,
            @RequestParam(required = false) String countryName,
            @RequestParam(required = false) String languageCode,
            @RequestParam(required = false) Integer languageId,
            @RequestParam(required = false) Integer rubricId,
            @RequestParam(required = false) String classificationStatus,
            @RequestParam(required = false) Boolean isVideo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) OffsetDateTime to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int limit) {
        return searchService.search(new ArticleSearchFilter(
                query,
                sourceName,
                sourceDomain,
                countryId,
                countryName,
                languageCode,
                languageId,
                rubricId,
                classificationStatus,
                isVideo,
                date,
                from,
                to,
                page,
                limit));
    }
}
