package solutions.imperium.news_api.domain.topic;

import solutions.imperium.news_api.domain.topic.dto.TopicDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;

@Service
@RequiredArgsConstructor
public class TopicService {

    private final TopicRepository topicRepository;

    public Flux<TopicDto> getActiveTopics() {
        return topicRepository.findAllActive();
    }
}
