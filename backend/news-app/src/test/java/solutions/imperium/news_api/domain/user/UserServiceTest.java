package solutions.imperium.news_api.domain.user;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import solutions.imperium.news_api.domain.user.dto.UserOnboardReq;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private UserService userService;

    @Test
    public void testOnboardUser() {
        UserOnboardReq req = new UserOnboardReq();
        req.setCountryId(1);
        req.setTopics(List.of("tech", "business"));

        when(userRepository.saveUserPreferences(anyString(), eq(req))).thenReturn(Mono.just(true));

        Mono<String> result = userService.onboardUser(req);

        StepVerifier.create(result)
                .expectNextMatches(uuid -> uuid != null && !uuid.isEmpty())
                .verifyComplete();
    }
}
