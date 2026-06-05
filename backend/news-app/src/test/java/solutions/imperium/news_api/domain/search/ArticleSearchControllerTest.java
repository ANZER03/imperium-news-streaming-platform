package solutions.imperium.news_api.domain.search;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.PageResult;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ArticleSearchControllerTest {

    private WebTestClient webTestClient;

    @Mock
    private ArticleSearchService searchService;

    @InjectMocks
    private ArticleSearchController controller;

    @BeforeEach
    void setUp() {
        webTestClient = WebTestClient.bindToController(controller).build();
    }

    @Test
    void mapsSearchParametersToFilterAndReturnsPage() {
        ArticleSearchHitDto hit = ArticleSearchHitDto.builder()
                .id("564998888")
                .title("Search result")
                .sourceName("sharjah24.ae")
                .publishedAt(1776992774827L)
                .build();
        PageResult<ArticleSearchHitDto> page = new PageResult<>(List.of(hit), 1L);
        page.setSource("elasticsearch");
        page.setHasMore(true);
        when(searchService.search(any())).thenReturn(Mono.just(page));

        webTestClient.get()
                .uri(uriBuilder -> uriBuilder.path("/api/v1/search/articles")
                        .queryParam("q", "العين")
                        .queryParam("sourceName", "sharjah24.ae")
                        .queryParam("countryId", "12")
                        .queryParam("date", "2026-04-24")
                        .queryParam("page", "2")
                        .queryParam("limit", "15")
                        .build())
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.source").isEqualTo("elasticsearch")
                .jsonPath("$.hasMore").isEqualTo(true)
                .jsonPath("$.data[0].id").isEqualTo("564998888")
                .jsonPath("$.data[0].source_name").isEqualTo("sharjah24.ae");

        ArgumentCaptor<ArticleSearchFilter> captor = ArgumentCaptor.forClass(ArticleSearchFilter.class);
        verify(searchService).search(captor.capture());
        ArticleSearchFilter filter = captor.getValue();
        assertThat(filter.query()).isEqualTo("العين");
        assertThat(filter.sourceName()).isEqualTo("sharjah24.ae");
        assertThat(filter.countryId()).isEqualTo(12);
        assertThat(filter.date()).hasToString("2026-04-24");
        assertThat(filter.page()).isEqualTo(2);
        assertThat(filter.limit()).isEqualTo(15);
    }
}
