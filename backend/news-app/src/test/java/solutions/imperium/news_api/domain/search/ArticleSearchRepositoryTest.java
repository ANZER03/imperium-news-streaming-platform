package solutions.imperium.news_api.domain.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.LocalDate;
import java.time.OffsetDateTime;

import static org.assertj.core.api.Assertions.assertThat;

class ArticleSearchRepositoryTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final ArticleSearchProperties properties = new ArticleSearchProperties();
    private final ArticleSearchRepository repository = new ArticleSearchRepository(
            WebClient.builder().baseUrl("http://localhost:9200").build(),
            objectMapper,
            properties);

    @Test
    void buildsFullTextQueryWithFilterTermsAndDateRange() {
        ArticleSearchFilter filter = new ArticleSearchFilter(
                "renewable energy",
                "Example Source",
                "news.example",
                504,
                null,
                "EN",
                6,
                3,
                "enriched",
                false,
                null,
                OffsetDateTime.parse("2026-04-01T00:00:00Z"),
                OffsetDateTime.parse("2026-04-30T23:59:59Z"),
                1,
                25);

        ObjectNode body = repository.buildSearchBody(filter);

        assertThat(body.path("from").asInt()).isEqualTo(25);
        assertThat(body.path("size").asInt()).isEqualTo(25);
        JsonNode bool = body.path("query").path("bool");
        assertThat(bool.path("must").get(0).path("multi_match").path("query").asText()).isEqualTo("renewable energy");
        assertThat(bool.path("must").get(0).path("multi_match").path("fields").toString())
                .contains("title^4", "body_text_clean");
        assertThat(bool.path("filter").toString())
                .contains("\"source_name.keyword\":\"Example Source\"")
                .contains("\"source_domain\":\"news.example\"")
                .contains("\"country_id\":504")
                .contains("\"language_code\":\"EN\"")
                .contains("\"classification_status\":\"enriched\"")
                .contains("\"is_video\":false")
                .contains("\"is_visible\":true")
                .contains("\"gte\":\"2026-04-01T00:00Z\"")
                .contains("\"lte\":\"2026-04-30T23:59:59Z\"");
    }

    @Test
    void dateFilterExpandsSingleDateToUtcDayRange() {
        ArticleSearchFilter filter = new ArticleSearchFilter(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                LocalDate.parse("2026-04-24"),
                null,
                null,
                0,
                20);

        ObjectNode body = repository.buildSearchBody(filter);

        String filters = body.path("query").path("bool").path("filter").toString();
        assertThat(filters)
                .contains("\"gte\":\"2026-04-24T00:00Z\"")
                .contains("\"lt\":\"2026-04-25T00:00Z\"");
        assertThat(body.path("query").path("bool").path("must").get(0).has("match_all")).isTrue();
    }
}
