package solutions.imperium.news_api.domain.feed.v2.model;

import java.util.List;

public record PageBuildResult(
        List<ServedItem> items,
        FeedV2Session updatedSession,
        CandidateSource source,
        boolean hasMore,
        int newSinceLastSession,
        List<String> warnings
) {
}
