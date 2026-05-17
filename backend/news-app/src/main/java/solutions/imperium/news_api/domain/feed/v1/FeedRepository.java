package solutions.imperium.news_api.domain.feed.v1;

import solutions.imperium.news_api.domain.feed.v1.FeedSession;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidate;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidateBucket;
import solutions.imperium.news_api.domain.feed.v1.FeedCandidateSource;
import solutions.imperium.news_api.domain.feed.v1.ScoredArticle;

import solutions.imperium.news_api.core.Constants;
import solutions.imperium.news_api.domain.article.Article;
import solutions.imperium.news_api.domain.article.ArticlePostgresRepository;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.ScriptOutputType;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.api.reactive.RedisReactiveCommands;
import io.lettuce.core.codec.StringCodec;
import io.lettuce.core.output.BooleanOutput;
import io.lettuce.core.output.IntegerOutput;
import io.lettuce.core.output.StatusOutput;
import io.lettuce.core.protocol.CommandArgs;
import io.lettuce.core.protocol.ProtocolKeyword;
import lombok.RequiredArgsConstructor;
import jakarta.annotation.PreDestroy;
import org.springframework.data.domain.Range;
import org.springframework.data.redis.connection.RedisZSetCommands;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveRedisTemplate;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.stereotype.Repository;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

@Repository
@RequiredArgsConstructor
public class FeedRepository {

    private static final ProtocolKeyword BF_RESERVE = keyword("BF.RESERVE");
    private static final ProtocolKeyword BF_EXISTS = keyword("BF.EXISTS");
    private static final ProtocolKeyword BF_ADD = keyword("BF.ADD");
    private static final double BLOOM_ERROR_RATE = 0.01d;
    private static final long BLOOM_CAPACITY = 20_000L;
    private static final Duration BLOOM_TTL = Duration.ofDays(12);
    private static final String PERSONALIZED_AGGREGATION_SCRIPT = """
            local anchor = tonumber(ARGV[1])
            local seekCursor = tonumber(ARGV[2])
            local injectPerTopic = tonumber(ARGV[3])
            local scrollPerTopic = tonumber(ARGV[4])
            local includeInject = tonumber(ARGV[5])
            local injectById = {}
            local scrollById = {}

            for topicOrder, key in ipairs(KEYS) do
              if includeInject == 1 then
                local injectRows = redis.call('ZREVRANGEBYSCORE', key, '+inf', '(' .. anchor, 'WITHSCORES', 'LIMIT', 0, injectPerTopic)
                for idx = 1, #injectRows, 2 do
                  local articleId = injectRows[idx]
                  local rawScore = tonumber(injectRows[idx + 1])
                  local existing = injectById[articleId]
                  if (not existing) or rawScore > existing.rawScore or (rawScore == existing.rawScore and topicOrder < existing.topicOrder) then
                    injectById[articleId] = { id = articleId, rawScore = rawScore, topicOrder = topicOrder }
                  end
                end
              end

              local scrollUpper = seekCursor
              if anchor < scrollUpper then
                scrollUpper = anchor
              end

              local scrollRows = redis.call('ZREVRANGEBYSCORE', key, '(' .. scrollUpper, '-inf', 'WITHSCORES', 'LIMIT', 0, scrollPerTopic)
              for idx = 1, #scrollRows, 2 do
                local articleId = scrollRows[idx]
                local rawScore = tonumber(scrollRows[idx + 1])
                if not injectById[articleId] then
                  local existing = scrollById[articleId]
                  if (not existing) or rawScore > existing.rawScore or (rawScore == existing.rawScore and topicOrder < existing.topicOrder) then
                    scrollById[articleId] = { id = articleId, rawScore = rawScore, topicOrder = topicOrder }
                  end
                end
              end
            end

            local injectList = {}
            for _, candidate in pairs(injectById) do
              table.insert(injectList, candidate)
            end
            table.sort(injectList, function(a, b)
              if a.rawScore ~= b.rawScore then
                return a.rawScore > b.rawScore
              end
              return a.topicOrder < b.topicOrder
            end)

            local scrollList = {}
            for _, candidate in pairs(scrollById) do
              table.insert(scrollList, candidate)
            end
            table.sort(scrollList, function(a, b)
              if a.rawScore ~= b.rawScore then
                return a.rawScore > b.rawScore
              end
              return a.topicOrder < b.topicOrder
            end)

            local out = {}
            for _, candidate in ipairs(injectList) do
              table.insert(out, 'inject')
              table.insert(out, candidate.id)
              table.insert(out, tostring(candidate.rawScore))
            end
            for _, candidate in ipairs(scrollList) do
              table.insert(out, 'scroll')
              table.insert(out, candidate.id)
              table.insert(out, tostring(candidate.rawScore))
            end
            return out
            """;

    private final ReactiveRedisTemplate<String, Object> redisTemplate;
    private final ReactiveStringRedisTemplate stringRedisTemplate;
    private final LettuceConnectionFactory lettuceConnectionFactory;
    private final ArticlePostgresRepository articlePostgresRepository;
    private final AtomicReference<RedisClient> bloomClientRef = new AtomicReference<>();
    private final AtomicReference<StatefulRedisConnection<String, String>> bloomConnectionRef = new AtomicReference<>();
    private final AtomicReference<String> personalizedAggregationShaRef = new AtomicReference<>();

    public Mono<List<String>> getUserTopics(String userId) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        return redisTemplate.opsForHash().get(key, "topics")
                .map(topics -> (List<String>) topics)
                .defaultIfEmpty(List.of("world"));
    }

    public Mono<Integer> getUserCountryId(String userId) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        return redisTemplate.opsForHash().get(key, "country_id")
                .map(v -> v instanceof Number n ? n.intValue() : Integer.parseInt(v.toString()))
                .defaultIfEmpty(0);
    }

    public Mono<Long> getUserTopicPrefsVersion(String userId) {
        String key = String.format(Constants.KEY_USER_PREFS, userId);
        return redisTemplate.opsForHash().get(key, "topic_prefs_version")
                .map(v -> v instanceof Number n ? n.longValue() : Long.parseLong(v.toString()))
                .defaultIfEmpty(0L);
    }

    public Mono<FeedSession> findFeedSession(String userId, String sessionId) {
        String key = String.format(Constants.KEY_FEED_SESSION, userId, sessionId);
        return redisTemplate.opsForHash().entries(key)
                .collectMap(entry -> String.valueOf(entry.getKey()), Map.Entry::getValue)
                .filter(map -> !map.isEmpty())
                .map(this::mapToFeedSession);
    }

    public Mono<FeedSession> saveFeedSession(FeedSession session) {
        String key = String.format(Constants.KEY_FEED_SESSION, session.getUserId(), session.getSessionId());
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("sessionId", session.getSessionId());
        values.put("userId", session.getUserId());
        values.put("scopeFingerprint", session.getScopeFingerprint());
        values.put("endpointKind", session.getEndpointKind());
        values.put("countryId", session.getCountryId());
        values.put("topicParam", session.getTopicParam());
        values.put("sessionAnchor", session.getSessionAnchor());
        values.put("scrollCursor", session.getScrollCursor());
        values.put("createdAt", session.getCreatedAt());
        values.put("lastAccessAt", session.getLastAccessAt());

        return redisTemplate.opsForHash().putAll(key, values)
                .then(redisTemplate.expire(key, Duration.ofHours(12)))
                .thenReturn(session);
    }

    public Mono<Boolean> acquireFeedBuildLock(String userId, String sessionId, String token, Duration ttl) {
        String key = String.format(Constants.KEY_FEED_SESSION_LOCK, userId, sessionId);
        return stringRedisTemplate.opsForValue().setIfAbsent(key, token, ttl)
                .defaultIfEmpty(false);
    }

    public Mono<Boolean> releaseFeedBuildLock(String userId, String sessionId, String token) {
        String key = String.format(Constants.KEY_FEED_SESSION_LOCK, userId, sessionId);
        return stringRedisTemplate.opsForValue().get(key)
                .flatMap(currentToken -> {
                    if (!Objects.equals(currentToken, token)) {
                        return Mono.just(false);
                    }
                    return stringRedisTemplate.delete(key).map(deleted -> deleted > 0);
                })
                .defaultIfEmpty(false);
    }

    public Mono<Double> getTopScoreByCountryWithScores(int countryId) {
        String key = String.format(Constants.KEY_FEED_COUNTRY, countryId);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, Range.unbounded(), RedisZSetCommands.Limit.limit().count(1))
                .next()
                .map(tuple -> tuple.getScore())
                .defaultIfEmpty(0.0);
    }

    public Mono<Double> getTopScoreByCountryAndTopicWithScores(int countryId, String topicId) {
        String key = String.format(Constants.KEY_FEED_COUNTRY_TOPIC, countryId, topicId);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, Range.unbounded(), RedisZSetCommands.Limit.limit().count(1))
                .next()
                .map(tuple -> tuple.getScore())
                .defaultIfEmpty(0.0);
    }

    public Mono<List<FeedCandidate>> aggregatePersonalizedCandidates(
            int countryId,
            List<String> topics,
            long sessionAnchor,
            long seekCursor,
            int injectPerTopic,
            int scrollPerTopic,
            boolean includeInject
    ) {
        if (topics == null || topics.isEmpty()) {
            return Mono.just(List.of());
        }

        String[] keys = topics.stream()
                .map(topic -> String.format(Constants.KEY_FEED_COUNTRY_TOPIC, countryId, topic))
                .toArray(String[]::new);
        String[] values = {
                String.valueOf(sessionAnchor),
                String.valueOf(seekCursor),
                String.valueOf(injectPerTopic),
                String.valueOf(scrollPerTopic),
                includeInject ? "1" : "0"
        };

        return evalPersonalizedAggregation(keys, values)
                .collectList()
                .map(this::mapPersonalizedAggregationResult);
    }

    /**
     * Fetch article IDs with scores from a topic ZSET, exclusive upper bound on cursor.
     * Range: [0, cursor)  →  ZREVRANGEBYSCORE key (cursor 0
     */
    public Flux<ScoredArticle> getArticleIdsByTopicWithScores(String topic, double cursor, int limit) {
        String key = String.format(Constants.KEY_FEED_TOPIC, topic);
        Range<Double> range = Range.rightOpen(0.0, cursor);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, range, RedisZSetCommands.Limit.limit().count(limit))
                .map(tuple -> new ScoredArticle(String.valueOf(tuple.getValue()), tuple.getScore()));
    }

    /**
     * Fetch article IDs with scores from a country ZSET (fallback when topics are exhausted).
     * Range: [0, cursor)  →  exclusive upper bound.
     */
    public Flux<ScoredArticle> getArticleIdsByCountryWithScores(int countryId, double cursor, int limit) {
        String key = String.format(Constants.KEY_FEED_COUNTRY, countryId);
        Range<Double> range = Range.rightOpen(0.0, cursor);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, range, RedisZSetCommands.Limit.limit().count(limit))
                .map(tuple -> new ScoredArticle(String.valueOf(tuple.getValue()), tuple.getScore()));
    }

    /**
     * Fetch article IDs with scores from a country+topic ZSET (feed:country:{countryId}:topic:{topicId}).
     */
    public Flux<ScoredArticle> getArticleIdsByCountryAndTopicWithScores(int countryId, String topicId, double cursor, int limit) {
        String key = String.format(Constants.KEY_FEED_COUNTRY_TOPIC, countryId, topicId);
        Range<Double> range = Range.rightOpen(0.0, cursor);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, range, RedisZSetCommands.Limit.limit().count(limit))
                .map(tuple -> new ScoredArticle(String.valueOf(tuple.getValue()), tuple.getScore()));
    }

    public Flux<ScoredArticle> getNewArticlesByCountryAndTopic(int countryId, String topicId, double sessionCursor, int limit) {
        String key = String.format(Constants.KEY_FEED_COUNTRY_TOPIC, countryId, topicId);
        double now = System.currentTimeMillis() / 1000.0;
        Range<Double> range = Range.leftOpen(sessionCursor, now);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, range, RedisZSetCommands.Limit.limit().count(limit))
                .map(tuple -> new ScoredArticle(String.valueOf(tuple.getValue()), tuple.getScore()));
    }

    public Flux<ScoredArticle> getNewArticlesByCountry(int countryId, double sessionCursor, int limit) {
        String key = String.format(Constants.KEY_FEED_COUNTRY, countryId);
        double now = System.currentTimeMillis() / 1000.0;
        Range<Double> range = Range.leftOpen(sessionCursor, now);
        return redisTemplate.opsForZSet()
                .reverseRangeByScoreWithScores(key, range, RedisZSetCommands.Limit.limit().count(limit))
                .map(tuple -> new ScoredArticle(String.valueOf(tuple.getValue()), tuple.getScore()));
    }

    public Mono<List<String>> getUnseenArticleIds(String userId, List<String> articleIds) {
        if (articleIds.isEmpty()) {
            return Mono.just(List.of());
        }

        String key = String.format(Constants.KEY_USER_VIEWED_BLOOM, userId);
        return stringRedisTemplate.hasKey(key).flatMap(exists -> {
            if (!Boolean.TRUE.equals(exists)) {
                return Mono.just(articleIds);
            }

            return Flux.fromIterable(articleIds)
                    .concatMap(articleId -> bloomExists(key, articleId)
                            .filter(seen -> !seen)
                            .map(ignored -> articleId))
                    .collectList();
        });
    }

    public Mono<Map<String, String>> getArticleMetadata(String articleId) {
        String key = String.format(Constants.KEY_NEWS_HASH, articleId);
        return stringRedisTemplate.<String, String>opsForHash().entries(key)
                .collectMap(Map.Entry::getKey, Map.Entry::getValue)
                .filter(map -> !map.isEmpty());
    }

    public Mono<Map<String, String>> getArticleMetadataWithFallback(String articleId) {
        return getArticleMetadata(articleId)
                .switchIfEmpty(articlePostgresRepository.findById(articleId)
                        .flatMap(article -> {
                            Map<String, String> rewarmed = articleToMetadataMap(article);
                            return stringRedisTemplate.opsForHash().putAll(String.format(Constants.KEY_NEWS_HASH, articleId), rewarmed)
                                    .then(stringRedisTemplate.expire(String.format(Constants.KEY_NEWS_HASH, articleId), Duration.ofDays(10)))
                                    .thenReturn(rewarmed);
                        }));
    }

    public Mono<Long> markArticlesAsViewed(String userId, List<String> articleIds) {
        List<String> distinctIds = articleIds.stream().distinct().collect(Collectors.toList());
        if (distinctIds.isEmpty()) {
            return Mono.just(0L);
        }

        String key = String.format(Constants.KEY_USER_VIEWED_BLOOM, userId);
        return ensureBloomFilter(key)
                .thenMany(Flux.fromIterable(distinctIds).concatMap(articleId -> bloomAdd(key, articleId)))
                .count()
                .flatMap(count -> stringRedisTemplate.expire(key, BLOOM_TTL).thenReturn(count));
    }

    @PreDestroy
    void closeBloomClient() {
        StatefulRedisConnection<String, String> connection = bloomConnectionRef.getAndSet(null);
        if (connection != null) {
            connection.close();
        }

        RedisClient client = bloomClientRef.getAndSet(null);
        if (client != null) {
            client.shutdown();
        }
    }

    private FeedSession mapToFeedSession(Map<String, Object> values) {
        return FeedSession.builder()
                .sessionId(asString(values.get("sessionId")))
                .userId(asString(values.get("userId")))
                .scopeFingerprint(asString(values.get("scopeFingerprint")))
                .endpointKind(asString(values.get("endpointKind")))
                .countryId(asInteger(values.get("countryId")))
                .topicParam(asString(values.get("topicParam")))
                .sessionAnchor(asLong(values.get("sessionAnchor")))
                .scrollCursor(asLong(values.get("scrollCursor")))
                .createdAt(asLong(values.get("createdAt")))
                .lastAccessAt(asLong(values.get("lastAccessAt")))
                .build();
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value);
        return Objects.equals("null", text) ? null : text;
    }

    private Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.longValue();
        }
        return Long.parseLong(String.valueOf(value));
    }

    private Integer asInteger(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }

    private Mono<Void> ensureBloomFilter(String key) {
        return stringRedisTemplate.hasKey(key).flatMap(exists -> {
            if (Boolean.TRUE.equals(exists)) {
                return stringRedisTemplate.expire(key, BLOOM_TTL).then();
            }

            return dispatchStatus(BF_RESERVE, args -> args.add(key).add(BLOOM_ERROR_RATE).add(BLOOM_CAPACITY))
                    .onErrorResume(error -> isAlreadyExistsError(error) ? Mono.empty() : Mono.error(error))
                    .then(stringRedisTemplate.expire(key, BLOOM_TTL))
                    .then();
        });
    }

    private Mono<Boolean> bloomExists(String key, String articleId) {
        return dispatchBoolean(BF_EXISTS, args -> args.add(key).add(articleId))
                .defaultIfEmpty(false);
    }

    private Mono<Long> bloomAdd(String key, String articleId) {
        return dispatchBoolean(BF_ADD, args -> args.add(key).add(articleId))
                .map(result -> Boolean.TRUE.equals(result) ? 1L : 0L)
                .defaultIfEmpty(0L);
    }

    private Mono<String> dispatchStatus(ProtocolKeyword keyword, java.util.function.Consumer<CommandArgs<String, String>> argBuilder) {
        CommandArgs<String, String> args = new CommandArgs<>(StringCodec.UTF8);
        argBuilder.accept(args);
        return bloomCommands().<String>dispatch(keyword, new StatusOutput<>(StringCodec.UTF8), args).next();
    }

    private Mono<Long> dispatchInteger(ProtocolKeyword keyword, java.util.function.Consumer<CommandArgs<String, String>> argBuilder) {
        CommandArgs<String, String> args = new CommandArgs<>(StringCodec.UTF8);
        argBuilder.accept(args);
        return bloomCommands().<Long>dispatch(keyword, new IntegerOutput<>(StringCodec.UTF8), args).next();
    }

    private Mono<Boolean> dispatchBoolean(ProtocolKeyword keyword, java.util.function.Consumer<CommandArgs<String, String>> argBuilder) {
        CommandArgs<String, String> args = new CommandArgs<>(StringCodec.UTF8);
        argBuilder.accept(args);
        return bloomCommands().<Boolean>dispatch(keyword, new BooleanOutput<>(StringCodec.UTF8), args).next();
    }

    private RedisReactiveCommands<String, String> bloomCommands() {
        StatefulRedisConnection<String, String> existingConnection = bloomConnectionRef.get();
        if (existingConnection != null && existingConnection.isOpen()) {
            return existingConnection.reactive();
        }

        synchronized (bloomConnectionRef) {
            StatefulRedisConnection<String, String> current = bloomConnectionRef.get();
            if (current != null && current.isOpen()) {
                return current.reactive();
            }

            RedisClient client = bloomClientRef.updateAndGet(existing -> existing != null ? existing : RedisClient.create(redisUri()));
            StatefulRedisConnection<String, String> connection = client.connect(StringCodec.UTF8);
            bloomConnectionRef.set(connection);
            return connection.reactive();
        }
    }

    private RedisURI redisUri() {
        RedisURI.Builder builder = RedisURI.Builder.redis(lettuceConnectionFactory.getHostName(), lettuceConnectionFactory.getPort())
                .withDatabase(lettuceConnectionFactory.getDatabase());

        String password = lettuceConnectionFactory.getPassword();
        if (password != null && !password.isBlank()) {
            builder.withPassword(password.toCharArray());
        }

        return builder.build();
    }

    private Flux<Object> evalPersonalizedAggregation(String[] keys, String[] values) {
        return scriptSha()
                .flatMapMany(sha -> bloomCommands().<Object>evalsha(sha, ScriptOutputType.MULTI, keys, values)
                        .onErrorResume(error -> {
                            if (!isNoScriptError(error)) {
                                return Flux.error(error);
                            }
                            personalizedAggregationShaRef.set(null);
                            return loadPersonalizedAggregationScript()
                                    .flatMapMany(reloadedSha -> bloomCommands().<Object>evalsha(reloadedSha, ScriptOutputType.MULTI, keys, values));
                        }));
    }

    private Mono<String> scriptSha() {
        String existing = personalizedAggregationShaRef.get();
        if (existing != null && !existing.isBlank()) {
            return Mono.just(existing);
        }
        return loadPersonalizedAggregationScript();
    }

    private Mono<String> loadPersonalizedAggregationScript() {
        return bloomCommands().scriptLoad(PERSONALIZED_AGGREGATION_SCRIPT)
                .doOnNext(personalizedAggregationShaRef::set);
    }

    private List<FeedCandidate> mapPersonalizedAggregationResult(List<Object> rawValues) {
        if (rawValues.isEmpty()) {
            return List.of();
        }

        List<?> flattened = rawValues.size() == 1 && rawValues.getFirst() instanceof List<?> nested
                ? nested
                : rawValues;
        List<FeedCandidate> candidates = new ArrayList<>();
        for (int index = 0; index + 2 < flattened.size(); index += 3) {
            FeedCandidateBucket bucket = "inject".equalsIgnoreCase(String.valueOf(flattened.get(index)))
                    ? FeedCandidateBucket.INJECT
                    : FeedCandidateBucket.SCROLL;
            String articleId = String.valueOf(flattened.get(index + 1));
            double rawScore = Double.parseDouble(String.valueOf(flattened.get(index + 2)));
            candidates.add(new FeedCandidate(articleId, rawScore, rawScore, bucket, FeedCandidateSource.PRIMARY));
        }
        return candidates;
    }

    private boolean isAlreadyExistsError(Throwable error) {
        String message = error.getMessage();
        return message != null && message.toLowerCase().contains("exists");
    }

    private boolean isNoScriptError(Throwable error) {
        String message = error.getMessage();
        return message != null && message.toUpperCase().contains("NOSCRIPT");
    }

    private static ProtocolKeyword keyword(String value) {
        byte[] bytes = value.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return new ProtocolKeyword() {
            @Override
            public byte[] getBytes() {
                return bytes;
            }

            @Override
            public String toString() {
                return value;
            }
        };
    }

    private Map<String, String> articleToMetadataMap(Article article) {
        Map<String, String> metadata = new LinkedHashMap<>();
        putIfPresent(metadata, "title", article.getTitle());
        putIfPresent(metadata, "excerpt", excerpt(article.getBodyText()));
        putIfPresent(metadata, "image_url", article.getImageUrl());
        putIfPresent(metadata, "source_name", article.getSourceName());
        putIfPresent(metadata, "published_at", article.getPublishedAt());
        putIfPresent(metadata, "crawled_at", article.getCrawledAt());
        putIfPresent(metadata, "processed_at", article.getProcessedAt());
        putIfPresent(metadata, "root_topic_label", article.getPrimaryTopicLabel());
        return metadata;
    }

    private void putIfPresent(Map<String, String> target, String key, Object value) {
        if (value != null) {
            target.put(key, String.valueOf(value));
        }
    }

    private String excerpt(String bodyText) {
        if (bodyText == null || bodyText.isBlank()) {
            return null;
        }

        String trimmed = bodyText.trim();
        return trimmed.length() <= 160 ? trimmed : trimmed.substring(0, 160);
    }
}
