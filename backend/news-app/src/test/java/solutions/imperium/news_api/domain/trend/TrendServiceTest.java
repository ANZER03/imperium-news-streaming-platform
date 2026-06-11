package solutions.imperium.news_api.domain.trend;

import solutions.imperium.news_api.domain.trend.dto.TrendKeywordDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.ReactiveHashOperations;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.ReactiveZSetOperations;
import reactor.core.publisher.Flux;
import reactor.test.StepVerifier;

import java.util.Map;

import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class TrendServiceTest {

    @Mock
    private ReactiveStringRedisTemplate redisTemplate;

    @Mock
    private ReactiveZSetOperations<String, String> zSetOperations;

    @Mock
    private ReactiveHashOperations<String, String, String> hashOperations;

    @InjectMocks
    private TrendService trendService;

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForZSet()).thenReturn(zSetOperations);
        when(redisTemplate.<String, String>opsForHash()).thenReturn(hashOperations);
    }

    @Test
    void testGetExploreTrends_Global() {
        String zsetKey = "trend:global:5h";
        String metaKey = "trend:meta:global:global:macron";
        String term = "macron";

        when(zSetOperations.reverseRange(eq(zsetKey), eq(org.springframework.data.domain.Range.closed(0L, 49L))))
                .thenReturn(Flux.just(term));

        when(hashOperations.entries(eq(metaKey)))
                .thenReturn(Flux.just(
                        Map.entry("term", term),
                        Map.entry("score", "123.4")
                ));

        Flux<TrendKeywordDto> result = trendService.getExploreTrends(null, null);

        StepVerifier.create(result)
                .expectNextMatches(dto -> dto.getTerm().equals(term) && dto.getScore() == 123.4)
                .verifyComplete();
    }

    @Test
    void testGetExploreTrends_CountryTopic() {
        String zsetKey = "trend:country_topic:france:sports_:5h";
        String metaKey = "trend:meta:country_topic:france_sports_:olympics";
        String term = "olympics";

        when(zSetOperations.reverseRange(eq(zsetKey), eq(org.springframework.data.domain.Range.closed(0L, 49L))))
                .thenReturn(Flux.just(term));

        when(hashOperations.entries(eq(metaKey)))
                .thenReturn(Flux.just(
                        Map.entry("term", term),
                        Map.entry("score", "99.9")
                ));

        Flux<TrendKeywordDto> result = trendService.getExploreTrends("France ", "Sports!");

        StepVerifier.create(result)
                .expectNextMatches(dto -> dto.getTerm().equals(term) && dto.getScore() == 99.9)
                .verifyComplete();
    }

    @Test
    void testGetExploreTrends_GlobalTopic() {
        String zsetKey = "trend:global_topic:entertainment_culture:5h";
        String metaKey = "trend:meta:global_topic:global_entertainment_culture:cinema";
        String term = "cinema";

        when(zSetOperations.reverseRange(eq(zsetKey), eq(org.springframework.data.domain.Range.closed(0L, 49L))))
                .thenReturn(Flux.just(term));

        when(hashOperations.entries(eq(metaKey)))
                .thenReturn(Flux.just(
                        Map.entry("term", term),
                        Map.entry("score", "88.8")
                ));

        Flux<TrendKeywordDto> result = trendService.getExploreTrends(null, "entertainment_culture");

        StepVerifier.create(result)
                .expectNextMatches(dto -> dto.getTerm().equals(term) && dto.getScore() == 88.8)
                .verifyComplete();
    }
}
