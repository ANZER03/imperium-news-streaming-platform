package solutions.imperium.news_api.domain.feed;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "feed")
public class FeedProperties {
    private int injectPageMax = 5;
    private int injectPerTopic = 3;
    private int scrollPerTopic = 12;
    private int seekMaxIterations = 4;
    private int maxTopicsPerRequest = 64;
    private double scrollBatchMultiplier = 1.5d;
    private double weightScale = 0.0d;
}
