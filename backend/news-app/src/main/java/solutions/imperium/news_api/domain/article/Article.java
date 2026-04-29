package solutions.imperium.news_api.domain.article;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Article {
    private String id;
    private String title;
    private String bodyText;
    private String reporter;
    private String url;
    private String imageUrl;
    private Long publishedAt;
    private Long crawledAt;
    private Long processedAt;
    private String sourceName;
    private String countryName;
    private String primaryTopicLabel;
}
