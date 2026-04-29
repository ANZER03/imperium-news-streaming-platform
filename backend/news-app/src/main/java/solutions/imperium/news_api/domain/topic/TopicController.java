package solutions.imperium.news_api.domain.topic;

import solutions.imperium.news_api.domain.topic.dto.TopicDto;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1/topics")
@RequiredArgsConstructor
public class TopicController {

    private final TopicService topicService;

    /**
     * GET /api/v1/topics
     * Returns the list of active top-level topics for the onboarding picker.
     * Response: [{ "topicId": "science_technology", "displayName": "Science & Technology" }, ...]
     */
    @GetMapping
    public Flux<TopicDto> getTopics() {
        return topicService.getActiveTopics();
    }
}
