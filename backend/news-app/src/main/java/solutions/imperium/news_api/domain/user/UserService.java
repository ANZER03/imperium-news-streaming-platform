package solutions.imperium.news_api.domain.user;

import solutions.imperium.news_api.domain.user.dto.UserOnboardReq;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Mono;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;

    public Mono<String> onboardUser(UserOnboardReq request) {
        // Generate a new anonymous unique ID
        String newUserId = UUID.randomUUID().toString();
        
        // Save to Redis and return the ID
        return userRepository.saveUserPreferences(newUserId, request)
                .thenReturn(newUserId);
    }
}
