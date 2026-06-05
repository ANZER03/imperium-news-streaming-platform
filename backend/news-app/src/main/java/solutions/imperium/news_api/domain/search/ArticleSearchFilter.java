package solutions.imperium.news_api.domain.search;

import java.time.LocalDate;
import java.time.OffsetDateTime;

public record ArticleSearchFilter(
        String query,
        String sourceName,
        String sourceDomain,
        Integer countryId,
        String countryName,
        String languageCode,
        Integer languageId,
        Integer rubricId,
        String classificationStatus,
        Boolean isVideo,
        LocalDate date,
        OffsetDateTime from,
        OffsetDateTime to,
        int page,
        int limit) {
}
