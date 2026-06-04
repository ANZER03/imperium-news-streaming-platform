package solutions.imperium.news_api.domain.search;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.function.client.WebClient;

@Configuration
@EnableConfigurationProperties(ArticleSearchProperties.class)
public class SearchModule {

    @Bean
    WebClient elasticsearchWebClient(ArticleSearchProperties properties) {
        return WebClient.builder().baseUrl(properties.getBaseUrl()).build();
    }
}
