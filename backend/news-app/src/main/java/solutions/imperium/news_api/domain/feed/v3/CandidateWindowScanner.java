package solutions.imperium.news_api.domain.feed.v3;

import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.feed.v3.model.Candidate;

import java.util.List;

/**
 * Reads raw candidates from the topic / country ZSETs in a single timestamp window. No
 * read-state filtering happens here — the scanner is purely an index reader. Java-side merge,
 * dedupe, and ordering happen inside the implementation; all caller has to do is provide
 * the (countries, topics, useFallback, window) tuple.
 */
public interface CandidateWindowScanner {

    /**
     * @param countryIds       country IDs the user is scoped to. Must be non-empty.
     * @param topics           followed topics; ignored when {@code useFallback} is true.
     * @param useFallback      when true, scan {@code feed:country:{c}} only.
     * @param windowStart      inclusive minimum score (timestamp).
     * @param windowEnd        inclusive maximum score (timestamp).
     * @param perTopicLimit    cap on candidates fetched per (country, topic) ZSET in this window.
     * @return merged + deduped candidates sorted by descending {@code rawScore}, articleId tiebreak.
     */
    Mono<List<Candidate>> scan(List<Integer> countryIds,
                               List<String> topics,
                               boolean useFallback,
                               long windowStart,
                               long windowEnd,
                               int perTopicLimit);
}
