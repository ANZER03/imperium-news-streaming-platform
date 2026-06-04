package solutions.imperium.news_api.domain.search;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ArticleSearchHitDto {
    String id;
    Double score;
    String title;
    String excerpt;
    String url;

    @JsonProperty("image_url")
    String imageUrl;

    @JsonProperty("source_name")
    String sourceName;

    @JsonProperty("source_domain")
    String sourceDomain;

    @JsonProperty("country_id")
    Integer countryId;

    @JsonProperty("country_name")
    String countryName;

    @JsonProperty("language_code")
    String languageCode;

    @JsonProperty("rubric_id")
    Integer rubricId;

    @JsonProperty("rubric_title")
    String rubricTitle;

    @JsonProperty("classification_status")
    String classificationStatus;

    @JsonProperty("published_at")
    Long publishedAt;

    @JsonProperty("crawled_at")
    Long crawledAt;

    @JsonProperty("processed_at")
    Long processedAt;

    @JsonProperty("is_video")
    Boolean isVideo;
}
