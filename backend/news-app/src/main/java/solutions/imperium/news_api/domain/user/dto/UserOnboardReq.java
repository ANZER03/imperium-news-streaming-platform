package solutions.imperium.news_api.domain.user.dto;

import lombok.Data;
import java.util.List;

@Data
public class UserOnboardReq {
    private Integer countryId;
    private List<String> topics; // List of topic IDs (e.g., ["news_world", "news_tech"])
}
