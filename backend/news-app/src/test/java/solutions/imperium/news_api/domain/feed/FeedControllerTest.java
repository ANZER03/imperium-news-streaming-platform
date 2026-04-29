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

        when(feedService.generateFeed(anyString(), any(), anyInt())).thenReturn(Mono.just(mockResult));

        webTestClient.get()
                .uri("/api/v1/feed?userId=user123&limit=10")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.data[0].id").isEqualTo("art1")
                .jsonPath("$.nextCursor").isEqualTo(1000);
    }
}
