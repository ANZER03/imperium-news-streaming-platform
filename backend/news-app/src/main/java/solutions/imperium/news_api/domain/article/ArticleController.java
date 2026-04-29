package solutions.imperium.news_api.domain.article;

import solutions.imperium.news_api.domain.article.dto.ArticleDetailDto;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;

    @GetMapping("/articles/{articleId}")
    public Mono<ArticleDetailDto> getArticle(@PathVariable String articleId) {
        return articleService.getArticleDetails(articleId);
    }

    @PostMapping("/users/{userId}/bookmarks/{articleId}")
    @ResponseStatus(HttpStatus.OK)
    public Mono<Void> addBookmark(@PathVariable String userId, @PathVariable String articleId) {
        return articleService.addBookmark(userId, articleId);
    }

    @DeleteMapping("/users/{userId}/bookmarks/{articleId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public Mono<Void> removeBookmark(@PathVariable String userId, @PathVariable String articleId) {
        return articleService.removeBookmark(userId, articleId);
    }

    @GetMapping("/users/{userId}/bookmarks")
    public Flux<ArticleCardDto> getBookmarks(@PathVariable String userId) {
        return articleService.getBookmarks(userId);
    }
}
