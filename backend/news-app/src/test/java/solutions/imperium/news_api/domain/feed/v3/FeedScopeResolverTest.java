package solutions.imperium.news_api.domain.feed.v3;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import solutions.imperium.news_api.domain.feed.v3.model.BuildFeedRequest;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerScope;
import solutions.imperium.news_api.domain.feed.v2.model.UserPrefs;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FeedScopeResolverTest {

    private FeedScannerProperties properties;
    private FeedScopeResolver resolver;

    @BeforeEach
    void setUp() {
        properties = new FeedScannerProperties();
        resolver = new FeedScopeResolver(properties);
    }

    private BuildFeedRequest req(EndpointKind kind, String topic) {
        return new BuildFeedRequest("user-1", kind, topic, null, 40);
    }

    private UserPrefs prefs(List<Integer> countries, List<String> topics, long version) {
        return new UserPrefs(countries, topics, version, false);
    }

    @Test
    void personalizedScope_isOrderIndependentOnCountriesAndTopics() {
        FeedScannerScope a = resolver.resolve(
                req(EndpointKind.PERSONALIZED, null),
                prefs(List.of(2, 1), List.of("sports", "tech"), 7));
        FeedScannerScope b = resolver.resolve(
                req(EndpointKind.PERSONALIZED, null),
                prefs(List.of(1, 2), List.of("tech", "sports"), 7));
        assertThat(a.scopeHash()).isEqualTo(b.scopeHash());
        assertThat(a.countryIds()).containsExactly(1, 2);
    }

    @Test
    void differentEndpoints_neverShareHash_evenWithSameTopics() {
        UserPrefs p = prefs(List.of(0), List.of("tech"), 1);
        FeedScannerScope personalized = resolver.resolve(req(EndpointKind.PERSONALIZED, null), p);
        FeedScannerScope topic = resolver.resolve(req(EndpointKind.TOPIC, "tech"), p);
        FeedScannerScope latest = resolver.resolve(req(EndpointKind.LATEST, null), p);
        assertThat(personalized.scopeHash()).isNotEqualTo(topic.scopeHash());
        assertThat(personalized.scopeHash()).isNotEqualTo(latest.scopeHash());
        assertThat(topic.scopeHash()).isNotEqualTo(latest.scopeHash());
    }

    @Test
    void prefsVersionChange_rotatesHash() {
        FeedScannerScope a = resolver.resolve(
                req(EndpointKind.PERSONALIZED, null),
                prefs(List.of(0), List.of("tech"), 1));
        FeedScannerScope b = resolver.resolve(
                req(EndpointKind.PERSONALIZED, null),
                prefs(List.of(0), List.of("tech"), 2));
        assertThat(a.scopeHash()).isNotEqualTo(b.scopeHash());
    }

    @Test
    void hashIsHexAndExpectedLength() {
        FeedScannerScope scope = resolver.resolve(
                req(EndpointKind.PERSONALIZED, null),
                prefs(List.of(0), List.of("tech"), 1));
        assertThat(scope.scopeHash()).hasSize(16).matches("[0-9a-f]{16}");
    }

    @Test
    void truncatesTopicsBeyondMaxAndFlagsTruncated() {
        properties.setMaxTopicsPerRequest(3);
        UserPrefs p = prefs(List.of(0), List.of("a", "b", "c", "d", "e"), 1);
        FeedScannerScope scope = resolver.resolve(req(EndpointKind.PERSONALIZED, null), p);
        assertThat(scope.topicsTruncated()).isTrue();
        assertThat(scope.topics()).hasSize(3);
    }

    @Test
    void topicEndpoint_requiresNonBlankTopicParam() {
        UserPrefs p = prefs(List.of(0), List.of("tech"), 1);
        assertThatThrownBy(() -> resolver.resolve(req(EndpointKind.TOPIC, null), p))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> resolver.resolve(req(EndpointKind.TOPIC, " "), p))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void latestEndpoint_hasEmptyTopics_andDoesNotDependOnFollowedTopics() {
        FeedScannerScope a = resolver.resolve(
                req(EndpointKind.LATEST, null),
                prefs(List.of(0), List.of("tech"), 1));
        FeedScannerScope b = resolver.resolve(
                req(EndpointKind.LATEST, null),
                prefs(List.of(0), List.of("sports", "world"), 1));
        assertThat(a.topics()).isEmpty();
        assertThat(b.topics()).isEmpty();
        assertThat(a.scopeHash()).isEqualTo(b.scopeHash());
    }

    @Test
    void topicEndpoint_isInsensitiveToOtherFollowedTopics() {
        UserPrefs withMore = prefs(List.of(0), List.of("tech", "sports", "world"), 1);
        UserPrefs withLess = prefs(List.of(0), List.of("tech"), 1);
        FeedScannerScope a = resolver.resolve(req(EndpointKind.TOPIC, "tech"), withMore);
        FeedScannerScope b = resolver.resolve(req(EndpointKind.TOPIC, "tech"), withLess);
        assertThat(a.scopeHash()).isEqualTo(b.scopeHash());
    }
}
