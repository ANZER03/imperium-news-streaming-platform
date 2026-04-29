package solutions.imperium.news_api.domain.country.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CountryDto {
    @JsonProperty("countryId")
    private Integer countryId;

    @JsonProperty("countryName")
    private String countryName;

    @JsonProperty("abbreviation")
    private String abbreviation;
}
