package solutions.imperium.news_api.domain.article;

import com.fasterxml.jackson.databind.ObjectMapper;
import solutions.imperium.news_api.domain.article.dto.ArticleDetailDto;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.exception.CustomExceptions;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class ArticleService {

    private final ArticlePostgresRepository articlePostgresRepository;
    private final ArticleRepository articleRepository;
    private final ObjectMapper objectMapper;

    public Mono<ArticleDetailDto> getArticleDetails(String articleId) {
        return articleRepository.getCachedArticle(articleId)
                .switchIfEmpty(Mono.defer(() ->
                    articlePostgresRepository.findById(articleId)
                        .map(this::mapToDetailDto)
                        .flatMap(dto -> articleRepository.cacheArticle(dto).thenReturn(dto))
                ))
                .switchIfEmpty(Mono.defer(() -> Mono.error(new CustomExceptions.ArticleNotFoundException(articleId))));
    }

    public Mono<Void> addBookmark(String userId, String articleId) {
        return articleRepository.addBookmark(userId, articleId).then();
    }

    public Mono<Void> removeBookmark(String userId, String articleId) {
        return articleRepository.removeBookmark(userId, articleId).then();
    }

    public Flux<ArticleCardDto> getBookmarks(String userId) {
        return articleRepository.getBookmarkedIds(userId)
                .flatMap(id -> articleRepository.getArticleMetadata(id)
                        .map(map -> mapToCardDto(id, map))
                );
    }

    private ArticleDetailDto mapToDetailDto(Article article) {
        return ArticleDetailDto.builder()
                .id(article.getId())
                .title(article.getTitle())
                .bodyText(article.getBodyText())
                .author(article.getReporter())
                .url(article.getUrl())
                .imageUrl(article.getImageUrl())
                .publishedAt(article.getPublishedAt())
                .crawledAt(article.getCrawledAt())
                .processedAt(article.getProcessedAt())
                .sourceName(article.getSourceName())
                .countryName(article.getCountryName())
                .topic(article.getPrimaryTopicLabel())
                .build();
    }

    private ArticleCardDto mapToCardDto(String id, Map<String, String> map) {
        ArticleCardDto dto = objectMapper.convertValue(map, ArticleCardDto.class);
        dto.setId(id);
        return dto;
    }
}
