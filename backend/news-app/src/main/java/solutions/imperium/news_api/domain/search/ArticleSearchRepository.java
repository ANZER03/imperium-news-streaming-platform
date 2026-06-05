package solutions.imperium.news_api.domain.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Repository;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

@Repository
@RequiredArgsConstructor
public class ArticleSearchRepository {

    private final WebClient elasticsearchWebClient;
    private final ObjectMapper objectMapper;
    private final ArticleSearchProperties properties;

    public Mono<ArticleSearchResult> search(ArticleSearchFilter filter) {
        ObjectNode body = buildSearchBody(filter);
        return elasticsearchWebClient.post()
                .uri("/{index}/_search", properties.getIndex())
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(body.toString())
                .retrieve()
                .bodyToMono(String.class)
                .map(this::readResponse)
                .map(this::mapResponse);
    }

    ObjectNode buildSearchBody(ArticleSearchFilter filter) {
        int limit = filter.limit();
        ObjectNode body = objectMapper.createObjectNode();
        body.put("from", filter.page() * limit);
        body.put("size", limit);
        body.set("_source", searchResultSourceFields());
        body.set("query", buildQuery(filter));
        ArrayNode sort = body.putArray("sort");
        ObjectNode scoreSort = objectMapper.createObjectNode();
        scoreSort.put("_score", "desc");
        sort.add(scoreSort);
        ObjectNode dateSort = objectMapper.createObjectNode();
        ObjectNode crawledSort = dateSort.putObject("crawled_at");
        crawledSort.put("order", "desc");
        crawledSort.put("missing", "_last");
        sort.add(dateSort);
        return body;
    }

    private ObjectNode searchResultSourceFields() {
        ObjectNode source = objectMapper.createObjectNode();
        ArrayNode includes = source.putArray("includes");
        includes.add("article_id");
        includes.add("classification_status");
        includes.add("country_id");
        includes.add("country_name");
        includes.add("crawled_at");
        includes.add("excerpt");
        includes.add("image_url");
        includes.add("is_video");
        includes.add("language_code");
        includes.add("processed_at");
        includes.add("published_at");
        includes.add("rubric_id");
        includes.add("rubric_title");
        includes.add("source_domain");
        includes.add("source_name");
        includes.add("title");
        includes.add("url");
        return source;
    }

    private ObjectNode buildQuery(ArticleSearchFilter filter) {
        ObjectNode bool = objectMapper.createObjectNode();
        ArrayNode must = bool.putArray("must");
        ArrayNode filters = bool.putArray("filter");

        if (hasText(filter.query())) {
            ObjectNode multiMatch = objectMapper.createObjectNode();
            ObjectNode spec = multiMatch.putObject("multi_match");
            spec.put("query", filter.query().trim());
            ArrayNode fields = spec.putArray("fields");
            fields.add("title^4");
            fields.add("excerpt^2");
            fields.add("body_text_clean");
            fields.add("body_text");
            spec.put("type", "best_fields");
            must.add(multiMatch);
        } else {
            must.add(objectMapper.createObjectNode().set("match_all", objectMapper.createObjectNode()));
        }

        addTerm(filters, "source_name.keyword", filter.sourceName());
        addTerm(filters, "source_domain", filter.sourceDomain());
        addTerm(filters, "country_id", filter.countryId());
        addTerm(filters, "country_name", filter.countryName());
        addTerm(filters, "language_code", filter.languageCode());
        addTerm(filters, "language_id", filter.languageId());
        addTerm(filters, "rubric_id", filter.rubricId());
        addTerm(filters, "classification_status", filter.classificationStatus());
        addTerm(filters, "is_video", filter.isVideo());
        addTerm(filters, "is_visible", true);
        addDateFilter(filters, filter.date(), filter.from(), filter.to());

        ObjectNode wrapper = objectMapper.createObjectNode();
        wrapper.set("bool", bool);
        return wrapper;
    }

    private void addDateFilter(ArrayNode filters, LocalDate date, OffsetDateTime from, OffsetDateTime to) {
        if (date == null && from == null && to == null) {
            return;
        }
        ObjectNode range = objectMapper.createObjectNode();
        ObjectNode crawledAt = range.putObject("crawled_at");
        if (date != null) {
            crawledAt.put("gte", date.atStartOfDay().atOffset(ZoneOffset.UTC).toString());
            crawledAt.put("lt", date.plusDays(1).atStartOfDay().atOffset(ZoneOffset.UTC).toString());
        } else {
            if (from != null) {
                crawledAt.put("gte", from.withOffsetSameInstant(ZoneOffset.UTC).toString());
            }
            if (to != null) {
                crawledAt.put("lte", to.withOffsetSameInstant(ZoneOffset.UTC).toString());
            }
        }
        ObjectNode rangeWrapper = objectMapper.createObjectNode();
        rangeWrapper.set("range", range);
        filters.add(rangeWrapper);
    }

    private void addTerm(ArrayNode filters, String field, Object value) {
        if (value == null) {
            return;
        }
        if (value instanceof String stringValue && !hasText(stringValue)) {
            return;
        }
        ObjectNode termWrapper = objectMapper.createObjectNode();
        ObjectNode term = termWrapper.putObject("term");
        if (value instanceof Integer intValue) {
            term.put(field, intValue);
        } else if (value instanceof Boolean boolValue) {
            term.put(field, boolValue);
        } else {
            term.put(field, value.toString().trim());
        }
        filters.add(termWrapper);
    }

    private ArticleSearchResult mapResponse(JsonNode response) {
        JsonNode hitsNode = response.path("hits");
        long total = hitsNode.path("total").path("value").asLong(0);
        List<ArticleSearchHitDto> hits = new ArrayList<>();
        for (JsonNode hit : hitsNode.path("hits")) {
            JsonNode source = hit.path("_source");
            hits.add(ArticleSearchHitDto.builder()
                    .id(source.path("article_id").asText(hit.path("_id").asText()))
                    .score(hit.path("_score").isNumber() ? hit.path("_score").asDouble() : null)
                    .title(text(source, "title"))
                    .excerpt(text(source, "excerpt"))
                    .url(text(source, "url"))
                    .imageUrl(text(source, "image_url"))
                    .sourceName(text(source, "source_name"))
                    .sourceDomain(text(source, "source_domain"))
                    .countryId(integer(source, "country_id"))
                    .countryName(text(source, "country_name"))
                    .languageCode(text(source, "language_code"))
                    .rubricId(integer(source, "rubric_id"))
                    .rubricTitle(text(source, "rubric_title"))
                    .classificationStatus(text(source, "classification_status"))
                    .publishedAt(longValue(source, "published_at"))
                    .crawledAt(longValue(source, "crawled_at"))
                    .processedAt(longValue(source, "processed_at"))
                    .isVideo(booleanValue(source, "is_video"))
                    .build());
        }
        return new ArticleSearchResult(hits, total);
    }

    private JsonNode readResponse(String response) {
        try {
            return objectMapper.readTree(response);
        } catch (Exception exc) {
            throw new IllegalStateException("Failed to parse Elasticsearch search response", exc);
        }
    }

    private String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private Integer integer(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isInt() ? value.asInt() : null;
    }

    private Long longValue(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isNumber() ? value.asLong() : null;
    }

    private Boolean booleanValue(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isBoolean() ? value.asBoolean() : null;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
