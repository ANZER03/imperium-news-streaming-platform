package solutions.imperium.news_api.domain.feed.v2;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.core.Constants;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class RedisSeenArticleStore implements SeenArticleStore {

    private final ReactiveStringRedisTemplate redis;
    private final FeedV2Properties properties;

    private RedisScript<List> zmscoreScript;
    private RedisScript<Long> markScript;

    @PostConstruct
    void loadScripts() throws IOException {
        this.zmscoreScript = RedisScript.of(loadScript("feed/v2/seen_zmscore.lua"), List.class);
        this.markScript = RedisScript.of(loadScript("feed/v2/seen_mark.lua"), Long.class);
    }

    @Override
    public Mono<Set<String>> filterUnseen(String userId, Collection<String> articleIds) {
        if (articleIds == null || articleIds.isEmpty()) {
            return Mono.just(Set.of());
        }
        List<String> ordered = new ArrayList<>(new LinkedHashSet<>(articleIds));
        String key = key(userId);
        return redis.execute(zmscoreScript, List.of(key), new ArrayList<>(ordered))
                .next()
                .map(rawScores -> {
                    Set<String> unseen = new LinkedHashSet<>();
                    @SuppressWarnings("unchecked")
                    List<Object> scores = (List<Object>) rawScores;
                    for (int i = 0; i < ordered.size(); i++) {
                        Object score = i < scores.size() ? scores.get(i) : null;
                        if (score == null || score.toString().isEmpty()) {
                            unseen.add(ordered.get(i));
                        }
                    }
                    return (Set<String>) unseen;
                })
                .defaultIfEmpty(new LinkedHashSet<>(ordered));
    }

    @Override
    public Mono<Long> markServed(String userId, Collection<String> articleIds) {
        if (articleIds == null || articleIds.isEmpty()) {
            return Mono.just(0L);
        }
        Set<String> distinct = new LinkedHashSet<>(articleIds);
        long now = Instant.now().toEpochMilli();
        long ttlSeconds = Duration.ofDays(properties.getSeen().getTtlDays()).toSeconds();
        long pruneThreshold = properties.getSeen().isPruneOnWrite()
                ? now - Duration.ofDays(properties.getSeen().getTtlDays()).toMillis()
                : 0L;

        List<String> args = new ArrayList<>(2 + distinct.size() * 2);
        args.add(Long.toString(ttlSeconds));
        args.add(Long.toString(pruneThreshold));
        for (String id : distinct) {
            args.add(Long.toString(now));
            args.add(id);
        }

        return redis.execute(markScript, List.of(key(userId)), args)
                .next()
                .defaultIfEmpty(0L);
    }

    private String key(String userId) {
        return "seen:" + userId;
    }

    private String loadScript(String resource) throws IOException {
        return new String(new ClassPathResource(resource).getInputStream().readAllBytes(), StandardCharsets.UTF_8);
    }

    @SuppressWarnings("unused")
    private String prefsKey(String userId) {
        return String.format(Constants.KEY_USER_PREFS, userId);
    }
}
