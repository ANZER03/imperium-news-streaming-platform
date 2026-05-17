package solutions.imperium.news_api.domain.feed.v1;

import solutions.imperium.news_api.domain.feed.v1.FeedService;
import solutions.imperium.news_api.domain.feed.v1.FeedController;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.reactive.server.WebTestClient.ControllerSpec;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.exception.CustomExceptions;
import solutions.imperium.news_api.exception.GlobalExceptionHandler;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FeedControllerTest {

    private WebTestClient webTestClient;

    @Mock
    private FeedService feedService;

    @InjectMocks
    private FeedController feedController;

    @BeforeEach
    void setUp() {
        webTestClient = WebTestClient.bindToController(feedController)
                .controllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    void testGetFeed() {
        ArticleCardDto dto = new ArticleCardDto();
        dto.setId("art1");
        dto.setTitle("Test Title");
        dto.setPublishedAt(1000L);

        PageResult<ArticleCardDto> mockResult = new PageResult<>(List.of(dto), 1000L);
        mockResult.setSessionId("sess-1");

        when(feedService.generateFeed(anyString(), any(), any(), any(), anyInt())).thenReturn(Mono.just(mockResult));

        webTestClient.get()
                .uri("/api/v1/feed?userId=user123&sessionId=sess-1&limit=10")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data[0].id").isEqualTo("art1")
                .jsonPath("$.nextCursor").isEqualTo(1000)
                .jsonPath("$.sessionId").isEqualTo("sess-1");
    }

    @Test
    void testGetByTopic() {
        ArticleCardDto dto = new ArticleCardDto();
        dto.setId("t1");
        dto.setTitle("Topic Article");
        dto.setPublishedAt(1800L);

        when(feedService.getByTopic(anyString(), anyString(), any(), any(), any(), anyInt()))
                .thenReturn(Mono.just(new PageResult<>(List.of(dto), 1800L)));

        webTestClient.get()
                .uri("/api/v1/feed/topic?userId=user1&topicId=business_economy&sessionId=topic-1&limit=10")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data[0].id").isEqualTo("t1")
                .jsonPath("$.nextCursor").isEqualTo(1800);
    }

    @Test
    void testGetLatest() {
        ArticleCardDto dto = new ArticleCardDto();
        dto.setId("l1");
        dto.setTitle("Latest Article");
        dto.setPublishedAt(2000L);

        when(feedService.getLatest(anyString(), any(), any(), any(), anyInt()))
                .thenReturn(Mono.just(new PageResult<>(List.of(dto), 2000L)));

        webTestClient.get()
                .uri("/api/v1/feed/latest?userId=user1&sessionId=latest-1&limit=10")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data[0].id").isEqualTo("l1")
                .jsonPath("$.nextCursor").isEqualTo(2000);
    }

    @Test
    void testGetFeedConflict() {
        when(feedService.generateFeed(anyString(), any(), any(), any(), anyInt()))
                .thenReturn(Mono.error(new CustomExceptions.FeedRequestInProgressException("sess-1")));

        webTestClient.get()
                .uri("/api/v1/feed?userId=user123&sessionId=sess-1&limit=10")
                .exchange()
                .expectStatus().isEqualTo(409)
                .expectBody(String.class)
                .isEqualTo("Feed request already in progress for session: sess-1");
    }

    @Test
    void testGetFeedUsesDefaultLimitOfForty() {
        when(feedService.generateFeed(eq("user123"), any(), any(), any(), eq(40)))
                .thenReturn(Mono.just(new PageResult<>(List.of(), null)));

        webTestClient.get()
                .uri("/api/v1/feed?userId=user123")
                .exchange()
                .expectStatus().isOk();

        verify(feedService).generateFeed(eq("user123"), any(), any(), any(), eq(40));
    }
}
