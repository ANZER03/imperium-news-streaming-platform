package solutions.imperium.news_api.domain.country;

import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.country.dto.CountryDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.r2dbc.core.DatabaseClient;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;

import java.time.Duration;
import java.util.List;

@Slf4j
@Repository
@RequiredArgsConstructor
public class CountryRepository {

    private final ReactiveStringRedisTemplate stringRedisTemplate;
    private final DatabaseClient databaseClient;
    private final ObjectMapper objectMapper;

    public Flux<CountryDto> findAll() {
        return readFromCache().switchIfEmpty(readFromDbAndCache());
    }

    private Flux<CountryDto> readFromCache() {
        return stringRedisTemplate.opsForValue()
                .get(Constants.KEY_COUNTRIES_LIST)
                .flatMapMany(json -> {
                    try {
                        List<CountryDto> countries = objectMapper.readValue(json, new TypeReference<List<CountryDto>>() {});
                        log.debug("Countries served from cache");
                        return Flux.fromIterable(countries);
                    } catch (Exception e) {
                        log.warn("Cache value for countries:list is corrupt, falling back to DB: {}", e.getMessage());
                        return Flux.empty();
                    }
                });
    }

    private Flux<CountryDto> readFromDbAndCache() {
        return databaseClient.sql("SELECT id, pays, abr FROM table_pays ORDER BY pays")
                .map(row -> new CountryDto(
                        row.get("id", Integer.class),
                        row.get("pays", String.class),
                        row.get("abr", String.class)))
                .all()
                .collectList()
                .flatMapMany(countries -> {
                    try {
                        String json = objectMapper.writeValueAsString(countries);
                        return stringRedisTemplate.opsForValue()
                                .set(Constants.KEY_COUNTRIES_LIST, json, Duration.ofHours(24))
                                .doOnSuccess(r -> log.debug("Countries cached ({})", countries.size()))
                                .thenMany(Flux.fromIterable(countries));
                    } catch (Exception e) {
                        log.error("Failed to serialize countries for cache", e);
                        return Flux.fromIterable(countries);
                    }
                });
    }
}
