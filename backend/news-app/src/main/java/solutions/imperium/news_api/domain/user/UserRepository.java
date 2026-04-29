package solutions.imperium.news_api.domain.user;

import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.user.dto.UserOnboardReq;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.util.Map;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final ReactiveRedisTemplate<String, Object> redisTemplate;

    public Mono<Boolean> saveUserPreferences(String userId, UserOnboardReq req) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        
        // Store country_id and topics array in a Redis Hash
        Map<String, Object> prefs = Map.of(
            "country_id", req.getCountryId(),
            "topics", req.getTopics() // Jackson handles List serialization automatically
        );

        return redisTemplate.opsForHash().putAll(key, prefs);
    }
}
