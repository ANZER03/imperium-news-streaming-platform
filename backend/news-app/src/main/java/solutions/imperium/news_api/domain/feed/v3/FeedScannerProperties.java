package solutions.imperium.news_api.domain.feed.v3;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tunables for the V3 feed-scanner pipeline. Bound to {@code feed.scanner.*} in
 * {@code application.yml}. Defaults match the V3 PRD.
 */
@Data
@Component
@ConfigurationProperties(prefix = "feed.scanner")
public class FeedScannerProperties {

    /** Default page size when the client does not specify {@code limit}. */
    private int pageSizeDefault = 40;
    private int pageSizeMin = 5;
    private int pageSizeMax = 50;

    /** Step size (in seconds) of the older-window scan in Phase C. Default = 4 hours. */
    private long windowMillis = 4L * 60L * 60L; // 4 hours in seconds

    /** Per-(country, topic) ZSET fetch cap inside one window scan. */
    private int perTopicLimit = 50;

    /** Hard cap on followed topics fanned out per request. */
    private int maxTopicsPerRequest = 100;

    /** Hard cap on Phase C iterations. */
    private int maxWindowsPerRequest = 12;

    /** Concurrency when scanning topic ZSETs in a window. */
    private int scannerConcurrency = 16;

    /** Concurrency when SISMEMBER-checking candidate IDs against the read-id set. */
    private int readIdCheckConcurrency = 16;

    /** Hard cap on session.bufferIds size. */
    private int maxBufferSize = 400;

    /** Hard cap on stored intervals before compaction is forced. */
    private int maxIntervals = 128;

    /** Session HASH TTL. */
    private long sessionTtlHours = 4;

    /** A session older than this is treated as new (forces re-create). */
    private long sessionIdleThresholdHours = 4;

    /** Read-state TTL (intervals + read-ids SET). */
    private int readStateTtlDays = 12;

    /** Per-session lock TTL, in milliseconds. */
    private long lockTtlMs = 1500;

    /** Optional per-topic weights (added to score when ranking). Default empty → time-sort. */
    private Map<String, Double> topicWeights = new LinkedHashMap<>();

    /** Freshness boost coefficient: bonus = max(0, freshnessCoefficient * (now - rawScore - freshnessGraceMs)) — disabled by default. */
    private double freshnessCoefficient = 0.0d;
    private long freshnessGraceMs = 0L;
}
