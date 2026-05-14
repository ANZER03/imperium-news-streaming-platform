package solutions.imperium.news_api.domain.article;

import io.r2dbc.spi.Readable;
import lombok.RequiredArgsConstructor;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Collection;

@Repository
@RequiredArgsConstructor
public class ArticlePostgresRepository {

    private static final String SELECT_COLUMNS = """
            SELECT article_id, title, body_text, reporter, url, image_url,
                   published_at, crawled_at, processed_at, source_name, country_name, primary_topic_label
            """;

    private final DatabaseClient databaseClient;

    public Mono<Article> findById(String articleId) {
        return databaseClient.sql(SELECT_COLUMNS + " FROM imperium_news_articles WHERE article_id = :id")
                .bind("id", articleId)
                .map((java.util.function.Function<Readable, Article>) ArticlePostgresRepository::mapRow)
                .one();
    }

    public Flux<Article> findAllByIds(Collection<String> articleIds) {
        if (articleIds == null || articleIds.isEmpty()) {
            return Flux.empty();
        }
        return databaseClient.sql(SELECT_COLUMNS + " FROM imperium_news_articles WHERE article_id IN (:ids)")
                .bind("ids", articleIds)
                .map((java.util.function.Function<Readable, Article>) ArticlePostgresRepository::mapRow)
                .all();
    }

    private static Article mapRow(Readable row) {
        return Article.builder()
                .id(row.get("article_id", String.class))
                .title(row.get("title", String.class))
                .bodyText(row.get("body_text", String.class))
                .reporter(row.get("reporter", String.class))
                .url(row.get("url", String.class))
                .imageUrl(row.get("image_url", String.class))
                .publishedAt(row.get("published_at", Long.class))
                .crawledAt(row.get("crawled_at", Long.class))
                .processedAt(row.get("processed_at", Long.class))
                .sourceName(row.get("source_name", String.class))
                .countryName(row.get("country_name", String.class))
                .primaryTopicLabel(row.get("primary_topic_label", String.class))
                .build();
    }
}
