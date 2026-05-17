package solutions.imperium.news_api.domain.feed.v3;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

/**
 * Micrometer counters / timers / summaries for the V3 feed-scanner pipeline. Names follow the
 * V3 PRD §22 with dotted notation; Prometheus exposes them as {@code feed_scanner_*}.
 */
@Component
public class FeedScannerMetrics {

    public final Timer requestLatency;
    public final Counter newItemsInjected;
    public final Counter windowScanned;
    public final Counter windowSkipped;
    public final Counter windowExhausted;
    public final DistributionSummary intervalCount;
    public final DistributionSummary bufferSize;
    public final DistributionSummary pageFillRate;

    public FeedScannerMetrics(MeterRegistry registry) {
        this.requestLatency = Timer.builder("feed.scanner.request.latency")
                .description("End-to-end latency of a V3 feed page build")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);
        this.newItemsInjected = Counter.builder("feed.scanner.new_items.injected_count")
                .description("Items injected via Phase A above newestCursor")
                .register(registry);
        this.windowScanned = Counter.builder("feed.scanner.window.scanned_count")
                .description("Phase C windows that triggered a Redis scan")
                .register(registry);
        this.windowSkipped = Counter.builder("feed.scanner.window.skipped_count")
                .description("Phase C windows skipped via interval coverage")
                .register(registry);
        this.windowExhausted = Counter.builder("feed.scanner.window.exhausted_count")
                .description("Phase C windows that became exhausted intervals")
                .register(registry);
        this.intervalCount = DistributionSummary.builder("feed.scanner.read_state.interval_count")
                .description("Number of read intervals stored at request time")
                .register(registry);
        this.bufferSize = DistributionSummary.builder("feed.scanner.buffer.size")
                .description("Size of session bufferIds at request end")
                .register(registry);
        this.pageFillRate = DistributionSummary.builder("feed.scanner.page.fill_rate")
                .description("Ratio of returned items to requested limit (× 100)")
                .register(registry);
    }
}
