package solutions.imperium.news_api.domain.feed.v2;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "feed.v2")
public class FeedV2Properties {
    private int pageSizeDefault = 40;
    private int pageSizeMin = 5;
    private int pageSizeMax = 50;
    private int injectPageMax = 5;
    private int injectPerTopic = 3;
    private int scrollPerTopic = 25;
    private int seekMaxIterations = 3;
    private int maxTopicsPerRequest = 64;
    private double weightScale = 0.0d;
    private long sessionTtlHours = 12;
    private long sessionIdleThresholdHours = 4;
    private long lockTtlMs = 1500;
    private int hydrationConcurrency = 32;
    private Seen seen = new Seen();

    @Data
    public static class Seen {
        private long ttlDays = 14;
        private boolean pruneOnWrite = true;
    }
}
