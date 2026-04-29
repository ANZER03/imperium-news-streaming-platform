package solutions.imperium.news_api.domain.country;

import solutions.imperium.news_api.domain.country.dto.CountryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1/countries")
@RequiredArgsConstructor
public class CountryController {

    private final CountryService countryService;

    @GetMapping
    public Flux<CountryDto> getCountries() {
        return countryService.getAllCountries();
    }
}
