package solutions.imperium.news_api.domain.search;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Data
@ConfigurationProperties(prefix = "search.elasticsearch")
public class ArticleSearchProperties {
    private String baseUrl = "http://localhost:49200";
    private String index = "imperium_articles_search";
    private int defaultLimit = 20;
    private int maxLimit = 100;
}
