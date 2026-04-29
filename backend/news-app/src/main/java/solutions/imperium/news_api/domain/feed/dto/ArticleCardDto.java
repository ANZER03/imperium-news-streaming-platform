package solutions.imperium.news_api.domain.feed.dto;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import lombok.Data;
import solutions.imperium.news_api.core.FlexibleEpochDeserializer;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ArticleCardDto {

    @JsonIgnore
    private double score;
    private String id;
    private String title;
    private String excerpt;
    
    @JsonProperty("image_url")
    private String imageUrl;
    
    @JsonProperty("source_name")
    private String sourceName;
    
    @JsonProperty("published_at")
    @JsonDeserialize(using = FlexibleEpochDeserializer.class)
    private Long publishedAt;

    @JsonProperty("crawled_at")
    @JsonDeserialize(using = FlexibleEpochDeserializer.class)
    private Long crawledAt;

    @JsonProperty("processed_at")
    @JsonDeserialize(using = FlexibleEpochDeserializer.class)
    private Long processedAt;
    
    @JsonProperty("root_topic_label")
    private String rootTopicLabel;
}
