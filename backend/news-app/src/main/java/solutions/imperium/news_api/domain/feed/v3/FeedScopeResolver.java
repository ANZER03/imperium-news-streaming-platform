package solutions.imperium.news_api.domain.feed.v3;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import solutions.imperium.news_api.domain.feed.v3.model.BuildFeedRequest;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerScope;
import solutions.imperium.news_api.domain.feed.v2.model.UserPrefs;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Builds a {@link FeedScannerScope} for the request: resolves countries and the topic set
 * from V2's {@link UserPrefs}, applies endpoint-specific rules, and derives a stable
 * {@code scopeHash} (sha256, 16 hex chars). The hash is order-independent on countries and
 * topics so a re-ordered prefs snapshot does not invalidate read-state.
 */
@Component
@RequiredArgsConstructor
public class FeedScopeResolver {

    private static final int SCOPE_HASH_HEX_LEN = 16;
    private static final String SCOPE_DELIMITER = "|";

    private final FeedScannerProperties properties;

    /**
     * @param request the inbound request — endpointKind decides whether topicParam or
     *                {@code prefs.topics()} drives the scope.
     * @param prefs   the V2 prefs snapshot loaded by {@code RedisUserFeedPreferences} (read-only).
     */
    public FeedScannerScope resolve(BuildFeedRequest request, UserPrefs prefs) {
        Objects.requireNonNull(request, "request");
        Objects.requireNonNull(prefs, "prefs");

        List<Integer> countryIds = sortedDistinctCountries(prefs.countryIds());
        ResolvedTopics topics = resolveTopics(request, prefs);

        String scopeHash = computeHash(request.endpointKind(), countryIds, request.topicParam(),
                topics.canonicalTopicsCsv(), prefs.prefsVersion());

        return new FeedScannerScope(
                request.endpointKind(),
                countryIds,
                request.topicParam(),
                topics.topics(),
                prefs.prefsVersion(),
                topics.truncated(),
                scopeHash
        );
    }

    private ResolvedTopics resolveTopics(BuildFeedRequest request, UserPrefs prefs) {
        return switch (request.endpointKind()) {
            case TOPIC -> {
                String topic = request.topicParam();
                if (topic == null || topic.isBlank()) {
                    throw new IllegalArgumentException("TOPIC endpoint requires a non-blank topicParam");
                }
                yield new ResolvedTopics(List.of(topic), topic, false);
            }
            case LATEST -> new ResolvedTopics(List.of(), "", false);
            case PERSONALIZED -> {
                List<String> raw = prefs.topics() == null ? List.of() : new ArrayList<>(prefs.topics());
                List<String> distinct = new ArrayList<>(new LinkedHashSet<>(raw));
                boolean truncated = false;
                if (distinct.size() > properties.getMaxTopicsPerRequest()) {
                    distinct = distinct.subList(0, properties.getMaxTopicsPerRequest());
                    truncated = true;
                }
                List<String> sorted = new ArrayList<>(distinct);
                Collections.sort(sorted);
                String csv = String.join(",", sorted);
                yield new ResolvedTopics(distinct, csv, truncated);
            }
        };
    }

    private List<Integer> sortedDistinctCountries(List<Integer> input) {
        if (input == null || input.isEmpty()) return List.of();
        List<Integer> distinct = new ArrayList<>(new LinkedHashSet<>(input));
        Collections.sort(distinct);
        return Collections.unmodifiableList(distinct);
    }

    private String computeHash(EndpointKind kind, List<Integer> countries, String topicParam,
                               String topicsCsv, long prefsVersion) {
        StringBuilder sb = new StringBuilder(96);
        sb.append(kind.name().toLowerCase(Locale.ROOT)).append(SCOPE_DELIMITER);
        for (int i = 0; i < countries.size(); i++) {
            if (i > 0) sb.append(',');
            sb.append(countries.get(i).intValue());
        }
        sb.append(SCOPE_DELIMITER);
        // For TOPIC endpoint, the topicParam is part of the canonical topic set already; we
        // still include it explicitly so personalized-with-topics never collides with topic-feed.
        sb.append(topicParam == null ? "" : topicParam).append(SCOPE_DELIMITER);
        sb.append(topicsCsv).append(SCOPE_DELIMITER);
        sb.append(prefsVersion);

        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(sb.toString().getBytes(StandardCharsets.UTF_8));
            String hex = HexFormat.of().formatHex(digest);
            return hex.substring(0, SCOPE_HASH_HEX_LEN);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory in every JRE; this branch is only for the compiler.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private record ResolvedTopics(List<String> topics, String canonicalTopicsCsv, boolean truncated) {
    }
}
