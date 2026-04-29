package solutions.imperium.news_api.domain.article;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.article.dto.ArticleDetailDto;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.exception.CustomExceptions;
import solutions.imperium.news_api.exception.GlobalExceptionHandler;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class ArticleControllerTest {

    private WebTestClient webTestClient;

    @Mock
    private ArticleService articleService;

    @InjectMocks
    private ArticleController articleController;

    @BeforeEach
    public void setUp() {
        webTestClient = WebTestClient.bindToController(articleController)
                .controllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    public void testGetArticle() {
        ArticleDetailDto dto = ArticleDetailDto.builder()
                .id("art1")
                .title("Test Article")
                .build();

        when(articleService.getArticleDetails("art1")).thenReturn(Mono.just(dto));

        webTestClient.get()
                .uri("/api/v1/articles/art1")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.id").isEqualTo("art1")
                .jsonPath("$.title").isEqualTo("Test Article");
    }

    @Test
    public void testGetArticle_NotFound() {
        when(articleService.getArticleDetails("art1"))
                .thenReturn(Mono.error(new CustomExceptions.ArticleNotFoundException("art1")));

        webTestClient.get()
                .uri("/api/v1/articles/art1")
                .exchange()
                .expectStatus().isNotFound();
    }

    @Test
    public void testAddBookmark() {
        when(articleService.addBookmark(anyString(), anyString())).thenReturn(Mono.empty());

        webTestClient.post()
                .uri("/api/v1/users/user1/bookmarks/art1")
                .exchange()
                .expectStatus().isOk();
    }

    @Test
    public void testRemoveBookmark() {
        when(articleService.removeBookmark(anyString(), anyString())).thenReturn(Mono.empty());

        webTestClient.delete()
                .uri("/api/v1/users/user1/bookmarks/art1")
                .exchange()
                .expectStatus().isNoContent();
    }

    @Test
    public void testGetBookmarks() {
        ArticleCardDto card = new ArticleCardDto();
        card.setId("art1");
        card.setTitle("Saved Article");

        when(articleService.getBookmarks("user1")).thenReturn(Flux.just(card));

        webTestClient.get()
                .uri("/api/v1/users/user1/bookmarks")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$[0].id").isEqualTo("art1")
                .jsonPath("$[0].title").isEqualTo("Saved Article");
    }
}
