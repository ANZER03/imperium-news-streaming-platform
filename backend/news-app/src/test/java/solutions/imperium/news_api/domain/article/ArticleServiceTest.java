package solutions.imperium.news_api.domain.article;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import solutions.imperium.news_api.domain.article.dto.ArticleDetailDto;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.exception.CustomExceptions;

import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ArticleServiceTest {

    @Mock
    private ArticlePostgresRepository articlePostgresRepository;

    @Mock
    private ArticleRepository articleRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private ArticleService articleService;

    private ArticleDetailDto sampleDto;
    private Article sampleArticle;

    @BeforeEach
    void setUp() {
        sampleDto = ArticleDetailDto.builder()
                .id("art1")
                .title("Sample Title")
                .bodyText("Full text content")
                .author("Reporter Name")
                .build();

        sampleArticle = Article.builder()
                .id("art1")
                .title("Sample Title")
                .bodyText("Full text content")
                .reporter("Reporter Name")
                .build();
    }

    @Test
    void testGetArticleDetails_CacheHit() {
        when(articleRepository.getCachedArticle("art1")).thenReturn(Mono.just(sampleDto));

        StepVerifier.create(articleService.getArticleDetails("art1"))
                .expectNext(sampleDto)
                .verifyComplete();

        verifyNoInteractions(articlePostgresRepository);
    }

    @Test
    void testGetArticleDetails_CacheMiss_DbHit() {
        when(articleRepository.getCachedArticle("art1")).thenReturn(Mono.empty());
        when(articlePostgresRepository.findById("art1")).thenReturn(Mono.just(sampleArticle));
        when(articleRepository.cacheArticle(any(ArticleDetailDto.class))).thenReturn(Mono.just(true));

        StepVerifier.create(articleService.getArticleDetails("art1"))
                .expectNextMatches(dto -> dto.getId().equals("art1") && dto.getTitle().equals("Sample Title"))
                .verifyComplete();

        verify(articleRepository).cacheArticle(any());
    }

    @Test
    void testGetArticleDetails_NotFound() {
        when(articleRepository.getCachedArticle("art1")).thenReturn(Mono.empty());
        when(articlePostgresRepository.findById("art1")).thenReturn(Mono.empty());

        StepVerifier.create(articleService.getArticleDetails("art1"))
                .expectError(CustomExceptions.ArticleNotFoundException.class)
                .verify();
    }

    @Test
    void testAddBookmark() {
        when(articleRepository.addBookmark("user1", "art1")).thenReturn(Mono.just(1L));

        StepVerifier.create(articleService.addBookmark("user1", "art1"))
                .verifyComplete();

        verify(articleRepository).addBookmark("user1", "art1");
    }

    @Test
    void testGetBookmarks_Hydration() {
        when(articleRepository.getBookmarkedIds("user1")).thenReturn(Flux.just("art1"));
        when(articleRepository.getArticleMetadata("art1")).thenReturn(Mono.just(Map.of("title", "Hydrated Title")));

        StepVerifier.create(articleService.getBookmarks("user1"))
                .expectNextMatches(card -> card.getId().equals("art1") && card.getTitle().equals("Hydrated Title"))
                .verifyComplete();
    }
}
