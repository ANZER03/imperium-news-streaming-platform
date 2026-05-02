package solutions.imperium.news_api.domain.feed;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;

import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FeedControllerTest {

    private WebTestClient webTestClient;

    @Mock
    private FeedService feedService;

    @InjectMocks
    private FeedController feedController;

    @BeforeEach
    public void setUp() {
        webTestClient = WebTestClient.bindToController(feedController).build();
    }

    @Test
    public void testGetFeed() {
        ArticleCardDto dto = new ArticleCardDto();
        dto.setId("art1");
        dto.setTitle("Test Title");
        dto.setPublishedAt(1000L);

        PageResult<ArticleCardDto> mockResult = new PageResult<>(List.of(dto), 1000L);

        when(feedService.generateFeed(anyString(), any(), any(), anyInt())).thenReturn(Mono.just(mockResult));

        webTestClient.get()
                .uri("/api/v1/feed?userId=user123&limit=10")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data[0].id").isEqualTo("art1")
                .jsonPath("$.nextCursor").isEqualTo(1000);
    }

    @Test
    public void testGetByTopic() {
        ArticleCardDto dto = new ArticleCardDto();
        dto.setId("t1");
        dto.setTitle("Topic Article");
        dto.setPublishedAt(1800L);

        when(feedService.getByTopic(anyString(), anyString(), any(), any(), anyInt()))
                .thenReturn(Mono.just(new PageResult<>(List.of(dto), 1800L)));

        webTestClient.get()
                .uri("/api/v1/feed/topic?userId=user1&topicId=business_economy&limit=10")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data[0].id").isEqualTo("t1")
                .jsonPath("$.nextCursor").isEqualTo(1800);
    }

    @Test
    public void testGetLatest() {
        ArticleCardDto dto = new ArticleCardDto();
        dto.setId("l1");
        dto.setTitle("Latest Article");
        dto.setPublishedAt(2000L);

        when(feedService.getLatest(anyString(), any(), any(), anyInt()))
                .thenReturn(Mono.just(new PageResult<>(List.of(dto), 2000L)));

        webTestClient.get()
                .uri("/api/v1/feed/latest?userId=user1&limit=10")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data[0].id").isEqualTo("l1")
                .jsonPath("$.nextCursor").isEqualTo(2000);
    }
}
