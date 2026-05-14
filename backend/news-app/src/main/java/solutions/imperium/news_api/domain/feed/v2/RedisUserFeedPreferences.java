package solutions.imperium.news_api.domain.feed.v2;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.feed.v2.model.UserPrefs;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.stream.Stream;

@Component
@RequiredArgsConstructor
public class RedisUserFeedPreferences implements UserFeedPreferences {

    private static final TypeReference<List<String>> STRING_LIST = new TypeReference<>() {};
    private static final List<String> DEFAULT_TOPICS = List.of("world");
    private static final List<Integer> DEFAULT_COUNTRIES = List.of(0);

    private final ReactiveStringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;
    private final FeedV2Properties properties;

    @Override
    public Mono<UserPrefs> load(String userId) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        List<String> hashKeys = List.of("country_ids", "country_id", "topics", "topic_prefs_version");
        return redisTemplate.<String, String>opsForHash().multiGet(key, hashKeys)
                .map(values -> mapPrefs(new ArrayList<>(values), hashKeys));
    }

    private UserPrefs mapPrefs(List<?> values, List<String> hashKeys) {
        Object countryIdsRaw = values.size() > 0 ? values.get(0) : null;
        Object countryIdRaw = values.size() > 1 ? values.get(1) : null;
        Object topicsRaw = values.size() > 2 ? values.get(2) : null;
        Object versionRaw = values.size() > 3 ? values.get(3) : null;

        List<Integer> countryIds = parseCountryIds(countryIdsRaw, countryIdRaw);
        List<String> topics = parseTopics(topicsRaw);
        long version = parseLong(versionRaw, 0L);

        boolean truncated = false;
        if (topics.size() > properties.getMaxTopicsPerRequest()) {
            topics = topics.subList(0, properties.getMaxTopicsPerRequest());
            truncated = true;
        }

        return new UserPrefs(countryIds, topics, version, truncated);
    }

    private List<Integer> parseCountryIds(Object countryIdsRaw, Object countryIdRaw) {
        List<Integer> ids = new ArrayList<>();
        if (countryIdsRaw != null) {
            String text = String.valueOf(countryIdsRaw).trim();
            if (text.startsWith("[")) {
                try {
                    List<Object> raw = objectMapper.readValue(text, new TypeReference<>() {});
                    raw.forEach(v -> ids.add(toInt(v)));
                } catch (Exception ignored) {
                    Stream.of(text.replace("[", "").replace("]", "").split(","))
                            .map(String::trim)
                            .filter(s -> !s.isBlank())
                            .map(this::toInt)
                            .forEach(ids::add);
                }
            } else if (!text.isBlank()) {
                Arrays.stream(text.split(","))
                        .map(String::trim)
                        .filter(s -> !s.isBlank())
                        .map(this::toInt)
                        .forEach(ids::add);
            }
        }
        if (ids.isEmpty() && countryIdRaw != null) {
            ids.add(toInt(countryIdRaw));
        }
        if (ids.isEmpty()) {
            return DEFAULT_COUNTRIES;
        }
        return new ArrayList<>(new LinkedHashSet<>(ids));
    }

    private List<String> parseTopics(Object raw) {
        if (raw == null) return DEFAULT_TOPICS;
        if (raw instanceof List<?> list) {
            return list.stream().filter(java.util.Objects::nonNull).map(String::valueOf).toList();
        }
        String text = String.valueOf(raw).trim();
        if (text.isBlank()) return DEFAULT_TOPICS;
        if (text.startsWith("[")) {
            try {
                return objectMapper.readValue(text, STRING_LIST);
            } catch (Exception ignored) {
                // fall through
            }
        }
        return Arrays.stream(text.split(",")).map(String::trim).filter(s -> !s.isBlank()).toList();
    }

    private int toInt(Object value) {
        if (value instanceof Number n) return n.intValue();
        return Integer.parseInt(String.valueOf(value).trim());
    }

    private long parseLong(Object value, long fallback) {
        if (value == null) return fallback;
        if (value instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(String.valueOf(value).trim());
        } catch (NumberFormatException ex) {
            return fallback;
        }
    }
}
