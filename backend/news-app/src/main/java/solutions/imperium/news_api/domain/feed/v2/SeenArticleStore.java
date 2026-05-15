package solutions.imperium.news_api.domain.feed.v2;

import reactor.core.publisher.Mono;

import java.util.Collection;
import java.util.Set;

public interface SeenArticleStore {
    /**
     * @return the subset of {@code articleIds} not present in the user's seen set.
     */
    Mono<Set<String>> filterUnseen(String userId, Collection<String> articleIds);

    /**
     * Batched mark-as-seen with TTL refresh and opportunistic prune in a single round-trip.
     */
    Mono<Long> markServed(String userId, Collection<String> articleIds);
}
