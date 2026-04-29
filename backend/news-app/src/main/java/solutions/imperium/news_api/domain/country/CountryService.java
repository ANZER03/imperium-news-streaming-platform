package solutions.imperium.news_api.domain.country;

import solutions.imperium.news_api.domain.country.dto.CountryDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

@Service
@RequiredArgsConstructor
public class CountryService {

    private final CountryRepository countryRepository;

    public Flux<CountryDto> getAllCountries() {
        return countryRepository.findAll();
    }
}
