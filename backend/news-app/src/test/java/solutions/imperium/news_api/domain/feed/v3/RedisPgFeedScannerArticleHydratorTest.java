package solutions.imperium.news_api.domain.feed.v3;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v2.ArticleHydrator;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RedisPgFeedScannerArticleHydratorTest {

    private ArticleHydrator delegate;
    private RedisPgFeedScannerArticleHydrator hydrator;

    @BeforeEach
    void setUp() {
        delegate = mock(ArticleHydrator.class);
        hydrator = new RedisPgFeedScannerArticleHydrator(delegate);
    }

    private ArticleCardDto dto(String id) {
        ArticleCardDto d = new ArticleCardDto();
        d.setId(id);
        d.setTitle("title-" + id);
        return d;
    }

    @Test
    void preservesInputOrderAndDropsMissingIds() {
        when(delegate.hydrate(anyCollection())).thenReturn(Mono.just(Map.of(
                "b", dto("b"),
                "a", dto("a")
        )));

        List<ArticleCardDto> out = hydrator.hydrate(List.of("a", "b", "c")).block();
        assertThat(out).extracting(ArticleCardDto::getId).containsExactly("a", "b");
    }

    @Test
    void emptyInput_returnsEmpty_withoutCallingDelegate() {
        List<ArticleCardDto> out = hydrator.hydrate(List.of()).block();
        assertThat(out).isEmpty();
    }
}
