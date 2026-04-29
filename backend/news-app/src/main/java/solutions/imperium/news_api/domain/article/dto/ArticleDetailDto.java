package solutions.imperium.news_api.domain.article.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.AllArgsConstructor;
import solutions.imperium.news_api.core.FlexibleEpochDeserializer;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ArticleDetailDto {
    private String id;
    private String title;
    private String bodyText;
    private String author;
    private String url;
    
    @JsonProperty("image_url")
    private String imageUrl;
    
    @JsonProperty("published_at")
    @JsonDeserialize(using = FlexibleEpochDeserializer.class)
    private Long publishedAt;

    @JsonProperty("crawled_at")
    @JsonDeserialize(using = FlexibleEpochDeserializer.class)
    private Long crawledAt;

    @JsonProperty("processed_at")
    @JsonDeserialize(using = FlexibleEpochDeserializer.class)
    private Long processedAt;
    
    @JsonProperty("source_name")
    private String sourceName;
    
    @JsonProperty("country_name")
    private String countryName;
    
    private String topic;
}
