package solutions.imperium.news_api.domain.user;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.user.dto.UserOnboardReq;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Mono;

import java.util.Map;

@Repository
@RequiredArgsConstructor
public class UserRepository {

    private final ReactiveStringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    public Mono<Boolean> saveUserPreferences(String userId, UserOnboardReq req) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        try {
            Map<String, String> prefs = Map.of(
                "country_ids", objectMapper.writeValueAsString(req.getCountryIds()),
                "topics",      objectMapper.writeValueAsString(req.getTopics())
            );
            return stringRedisTemplate.opsForHash().putAll(key, prefs);
        } catch (JsonProcessingException e) {
            return Mono.error(e);
        }
    }
}
