package solutions.imperium.news_api.domain.feed.v2.model;

import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;

public record ServedItem(Candidate candidate, ArticleCardDto dto) {
}
