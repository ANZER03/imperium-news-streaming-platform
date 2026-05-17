package solutions.imperium.news_api.domain.user.dto;

import lombok.Data;
import java.util.List;

@Data
public class UserOnboardReq {
    private List<Integer> countryIds;
    private List<String> topics;
}
