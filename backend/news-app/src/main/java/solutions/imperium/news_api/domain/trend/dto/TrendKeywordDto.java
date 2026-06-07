package solutions.imperium.news_api.domain.trend.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TrendKeywordDto {
    private String term;
    private String termType;
    private List<String> articleIds;
    private int currentCount;
    private int previousCount;
    private double velocity;
    private double score;
    private String updatedAt;
}
