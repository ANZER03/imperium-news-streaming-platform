package solutions.imperium.news_api.domain.user;

import solutions.imperium.news_api.domain.user.dto.UserOnboardReq;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Mono;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @PostMapping("/onboard")
    public Mono<Map<String, String>> onboard(@RequestBody UserOnboardReq request) {
        return userService.onboardUser(request)
                .map(userId -> Map.of("userId", userId));
    }
}
