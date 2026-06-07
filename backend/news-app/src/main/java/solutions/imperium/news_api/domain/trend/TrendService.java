package solutions.imperium.news_api.domain.trend;

import solutions.imperium.news_api.domain.trend.dto.TrendKeywordDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrendService {

    private final ReactiveStringRedisTemplate redisTemplate;

    public Flux<TrendKeywordDto> getExploreTrends(String country, String topic) {
        String safeCountry = safeKeySegment(country);
        String safeTopic = safeKeySegment(topic);
        
        String zsetKey = buildZsetKey(safeCountry, safeTopic);
        
        return redisTemplate.opsForZSet().reverseRange(zsetKey, org.springframework.data.domain.Range.closed(0L, 49L))
                .flatMap(term -> {
                    String metaKey = buildMetaKey(safeCountry, safeTopic, safeKeySegment(term));
                    return fetchMetadata(metaKey, term);
                });
    }

    private String buildZsetKey(String country, String topic) {
        boolean hasCountry = StringUtils.hasText(country);
        boolean hasTopic = StringUtils.hasText(topic);

        if (hasCountry && hasTopic) {
            return String.format("trend:country_topic:%s:%s:5h", country, topic);
        } else if (hasCountry) {
            return String.format("trend:country:%s:5h", country);
        } else if (hasTopic) {
            return String.format("trend:global_topic:global:%s:5h", topic);
        } else {
            return "trend:global:5h";
        }
    }

    private String buildMetaKey(String country, String topic, String term) {
        boolean hasCountry = StringUtils.hasText(country);
        boolean hasTopic = StringUtils.hasText(topic);

        String scopeType;
        String scopeValue;

        if (hasCountry && hasTopic) {
            scopeType = "country_topic";
            scopeValue = String.format("%s|%s", country, topic);
        } else if (hasCountry) {
            scopeType = "country";
            scopeValue = country;
        } else if (hasTopic) {
            scopeType = "global_topic";
            scopeValue = String.format("global|%s", topic);
        } else {
            scopeType = "global";
            scopeValue = "global";
        }

        return String.format("trend:meta:%s:%s:%s", scopeType, scopeValue, term);
    }

    private Mono<TrendKeywordDto> fetchMetadata(String metaKey, String term) {
        return redisTemplate.opsForHash().entries(metaKey)
                .collectMap(
                        entry -> (String) entry.getKey(),
                        entry -> (String) entry.getValue()
                )
                .map(map -> mapToDto(map, term))
                // If the map is empty (e.g. metadata expired before zset), just return the term with defaults
                .defaultIfEmpty(TrendKeywordDto.builder().term(term).build());
    }

    private TrendKeywordDto mapToDto(Map<String, String> data, String term) {
        if (data.isEmpty()) {
            return TrendKeywordDto.builder().term(term).build();
        }

        String articleIdsStr = data.getOrDefault("article_ids", "");
        List<String> articleIds = StringUtils.hasText(articleIdsStr)
                ? Arrays.asList(articleIdsStr.split(","))
                : Collections.emptyList();

        return TrendKeywordDto.builder()
                .term(data.getOrDefault("term", term))
                .termType(data.getOrDefault("term_type", ""))
                .articleIds(articleIds)
                .currentCount(parseIntSafe(data.get("current_count")))
                .previousCount(parseIntSafe(data.get("previous_count")))
                .velocity(parseDoubleSafe(data.get("velocity")))
                .score(parseDoubleSafe(data.get("score")))
                .updatedAt(data.getOrDefault("updated_at", ""))
                .build();
    }

    private int parseIntSafe(String val) {
        if (!StringUtils.hasText(val)) return 0;
        try {
            return Integer.parseInt(val);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private double parseDoubleSafe(String val) {
        if (!StringUtils.hasText(val)) return 0.0;
        try {
            return Double.parseDouble(val);
        } catch (NumberFormatException e) {
            return 0.0;
        }
    }

    private String safeKeySegment(String value) {
        if (!StringUtils.hasText(value)) return value;
        return value.trim().toLowerCase().replaceAll("[^a-z0-9_\\-\\.]", "_");
    }
}
