package solutions.imperium.news_api.domain.feed.v2;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v2.model.UserPrefs;

public interface UserFeedPreferences {
    Mono<UserPrefs> load(String userId);
}
