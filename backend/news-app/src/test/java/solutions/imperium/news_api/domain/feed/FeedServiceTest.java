package solutions.imperium.news_api.domain.feed;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;

import java.util.List;
import java.util.Map;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FeedServiceTest {

    @Mock
    private FeedRepository feedRepository;

    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    @InjectMocks
    private FeedService feedService;

    @Test
    public void testGenerateFeed_FilteringViewed() {
        String userId = "user123";
        Long cursor = 2000L;
        int limit = 2;

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("tech")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));

        // Phase 1 now uses country+topic ZSET
        when(feedRepository.getArticleIdsByCountryAndTopicWithScores(eq(1), eq("tech"), anyDouble(), anyInt()))
                .thenReturn(Flux.just(
                        new ScoredArticle("art1", 1500.0),
                        new ScoredArticle("art2", 1200.0),
                        new ScoredArticle("art3", 1000.0)));

        // art1 is viewed — should be filtered out
        when(feedRepository.getAppearedArticles(userId)).thenReturn(Mono.just(List.of("art1")));

        when(feedRepository.getArticleMetadata("art2")).thenReturn(Mono.just(Map.of("title", "Title 2", "published_at", "1200")));
        when(feedRepository.getArticleMetadata("art3")).thenReturn(Mono.just(Map.of("title", "Title 3", "published_at", "1000")));

        StepVerifier.create(feedService.generateFeed(userId, cursor, null, limit))
                .expectNextMatches(page -> {
                    boolean correctSize = page.getData().size() == 2;
                    boolean filteredArt1 = page.getData().stream().noneMatch(a -> a.getId().equals("art1"));
                    boolean sortedDesc = page.getData().get(0).getId().equals("art2");
                    boolean cursorSet = page.getNextCursor() == 1000L;
                    return correctSize && filteredArt1 && sortedDesc && cursorSet;
                })
                .verifyComplete();
    }

    @Test
    public void testGenerateFeed_CountryFallback_WhenTopicsEmpty() {
        String userId = "user456";
        int limit = 2;

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("rare_topic")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));

        // Country+topic ZSET is empty → triggers country fallback
        when(feedRepository.getArticleIdsByCountryAndTopicWithScores(eq(1), eq("rare_topic"), anyDouble(), anyInt()))
                .thenReturn(Flux.empty());

        when(feedRepository.getArticleIdsByCountryWithScores(eq(1), anyDouble(), anyInt()))
                .thenReturn(Flux.just(
                        new ScoredArticle("c1", 900.0),
                        new ScoredArticle("c2", 800.0)));

        when(feedRepository.getAppearedArticles(userId)).thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleMetadata("c1")).thenReturn(Mono.just(Map.of("title", "Country 1", "published_at", "900")));
        when(feedRepository.getArticleMetadata("c2")).thenReturn(Mono.just(Map.of("title", "Country 2", "published_at", "800")));

        StepVerifier.create(feedService.generateFeed(userId, 1000L, null, limit))
                .expectNextMatches(page -> {
                    boolean twoArticles = page.getData().size() == 2;
                    boolean fromCountry = page.getData().get(0).getId().equals("c1");
                    boolean cursorSet = page.getNextCursor() == 800L;
                    return twoArticles && fromCountry && cursorSet;
                })
                .verifyComplete();
    }

    @Test
    public void testGenerateFeed_EmptyFeed_ReturnsNullCursor() {
        String userId = "user789";

        when(feedRepository.getUserTopics(userId)).thenReturn(Mono.just(List.of("topic_x")));
        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getArticleIdsByCountryAndTopicWithScores(anyInt(), anyString(), anyDouble(), anyInt())).thenReturn(Flux.empty());
        when(feedRepository.getArticleIdsByCountryWithScores(anyInt(), anyDouble(), anyInt())).thenReturn(Flux.empty());

        StepVerifier.create(feedService.generateFeed(userId, 1000L, null, 10))
                .expectNextMatches(page -> page.getData().isEmpty() && page.getNextCursor() == null)
                .verifyComplete();
    }

    @Test
    public void testGetByTopic_ReturnsArticlesFromCountryTopicZSet() {
        String userId = "user1";
        String topicId = "business_economy";

        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(2));
        when(feedRepository.getArticleIdsByCountryAndTopicWithScores(eq(2), eq(topicId), anyDouble(), anyInt()))
                .thenReturn(Flux.just(new ScoredArticle("b1", 1800.0), new ScoredArticle("b2", 1700.0)));
        when(feedRepository.getAppearedArticles(userId)).thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleMetadata("b1")).thenReturn(Mono.just(Map.of("title", "Business 1", "published_at", "1800")));
        when(feedRepository.getArticleMetadata("b2")).thenReturn(Mono.just(Map.of("title", "Business 2", "published_at", "1700")));

        StepVerifier.create(feedService.getByTopic(userId, topicId, 2000L, null, 5))
                .expectNextMatches(page ->
                        page.getData().size() == 2 &&
                        page.getData().get(0).getId().equals("b1") &&
                        page.getNextCursor() == 1700L)
                .verifyComplete();
    }

    @Test
    public void testGetLatest_ReturnsArticlesFromCountryZSet() {
        String userId = "user2";

        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(3));
        when(feedRepository.getArticleIdsByCountryWithScores(eq(3), anyDouble(), anyInt()))
                .thenReturn(Flux.just(new ScoredArticle("l1", 2000.0), new ScoredArticle("l2", 1900.0)));
        when(feedRepository.getAppearedArticles(userId)).thenReturn(Mono.just(List.of()));
        when(feedRepository.getArticleMetadata("l1")).thenReturn(Mono.just(Map.of("title", "Latest 1", "published_at", "2000")));
        when(feedRepository.getArticleMetadata("l2")).thenReturn(Mono.just(Map.of("title", "Latest 2", "published_at", "1900")));

        StepVerifier.create(feedService.getLatest(userId, 3000L, null, 5))
                .expectNextMatches(page ->
                        page.getData().size() == 2 &&
                        page.getData().get(0).getId().equals("l1") &&
                        page.getNextCursor() == 1900L)
                .verifyComplete();
    }

    @Test
    public void testGetByTopic_EmptyZSet_ReturnsNullCursor() {
        String userId = "user3";

        when(feedRepository.getUserCountryId(userId)).thenReturn(Mono.just(1));
        when(feedRepository.getArticleIdsByCountryAndTopicWithScores(anyInt(), anyString(), anyDouble(), anyInt()))
                .thenReturn(Flux.empty());

        StepVerifier.create(feedService.getByTopic(userId, "sports", 2000L, null, 10))
                .expectNextMatches(page -> page.getData().isEmpty() && page.getNextCursor() == null)
                .verifyComplete();
    }
}
