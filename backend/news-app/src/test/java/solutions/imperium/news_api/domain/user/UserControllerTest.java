package solutions.imperium.news_api.domain.user;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;
import reactor.core.publisher.Mono;
import solutions.imperium.news_api.domain.user.dto.UserOnboardReq;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class UserControllerTest {

    private WebTestClient webTestClient;

    @Mock
    private UserService userService;

    @InjectMocks
    private UserController userController;

    @BeforeEach
    public void setUp() {
        webTestClient = WebTestClient.bindToController(userController).build();
    }

    @Test
    public void testOnboardUser() {
        String mockUserId = UUID.randomUUID().toString();
        when(userService.onboardUser(any(UserOnboardReq.class))).thenReturn(Mono.just(mockUserId));

        UserOnboardReq req = new UserOnboardReq();
        req.setCountryId(1);
        req.setTopics(List.of("tech", "business"));

        webTestClient.post()
                .uri("/api/v1/users/onboard")
                .contentType(MediaType.APPLICATION_JSON)
                .bodyValue(req)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.userId").isEqualTo(mockUserId);
    }
}
