package solutions.imperium.news_api.domain.feed.v3;

import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;
import solutions.imperium.news_api.core.PageResult;
import solutions.imperium.news_api.domain.feed.dto.ArticleCardDto;
import solutions.imperium.news_api.domain.feed.v3.model.BuildFeedRequest;
import solutions.imperium.news_api.domain.feed.v3.model.Candidate;
import solutions.imperium.news_api.domain.feed.v3.model.CandidateSource;
import solutions.imperium.news_api.domain.feed.v3.model.EndpointKind;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerScope;
import solutions.imperium.news_api.domain.feed.v3.model.FeedScannerSession;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;
import solutions.imperium.news_api.domain.feed.v3.model.ReadState;
import solutions.imperium.news_api.domain.feed.v2.UserFeedPreferences;
import solutions.imperium.news_api.domain.feed.v2.model.UserPrefs;
import solutions.imperium.news_api.exception.CustomExceptions;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class DefaultFeedScannerPipelineUnitTest {

    private UserFeedPreferences prefsLoader;
    private FeedScopeResolver scopeResolver;
    private FeedScannerSessionStore sessionStore;
    private FeedScannerReadStateStore readStateStore;
    private CandidateWindowScanner scanner;
    private FeedCandidateRanker ranker;
    private FeedScannerArticleHydrator hydrator;
    private FeedScannerCommitter committer;
    private FeedScannerProperties properties;

    private DefaultFeedScannerPipeline pipeline;

    @BeforeEach
    void setUp() {
        prefsLoader = mock(UserFeedPreferences.class);
        scopeResolver = mock(FeedScopeResolver.class);
        sessionStore = mock(FeedScannerSessionStore.class);
        readStateStore = mock(FeedScannerReadStateStore.class);
        scanner = mock(CandidateWindowScanner.class);
        hydrator = mock(FeedScannerArticleHydrator.class);
        committer = mock(FeedScannerCommitter.class);
        properties = new FeedScannerProperties();
        properties.setMaxWindowsPerRequest(8);
        properties.setPageSizeMin(1);
        properties.setPageSizeMax(50);
        properties.setPageSizeDefault(5);
        ranker = new FeedCandidateRanker(properties);

        MeterRegistry registry = new SimpleMeterRegistry();
        FeedScannerMetrics scannerMetrics = new FeedScannerMetrics(registry);

        pipeline = new DefaultFeedScannerPipeline(prefsLoader, scopeResolver, sessionStore,
                readStateStore, scanner, ranker, hydrator, committer, properties, scannerMetrics);

        when(scopeResolver.resolve(any(), any())).thenAnswer(inv -> {
            BuildFeedRequest req = inv.getArgument(0);
            UserPrefs p = inv.getArgument(1);
            return new FeedScannerScope(req.endpointKind(), p.countryIds(),
                    req.topicParam(), p.topics(), p.prefsVersion(), false, "scope-hash");
        });
        when(prefsLoader.load(anyString()))
                .thenReturn(Mono.just(new UserPrefs(List.of(0), List.of("tech"), 1L, false)));
        // Default: lock acquired, released; no existing session.
        when(sessionStore.find(anyString(), any()))
                .thenReturn(Mono.just(java.util.Optional.empty()));
        when(sessionStore.acquireLock(anyString(), anyString(), anyString(), any(Duration.class)))
                .thenReturn(Mono.just(true));
        when(sessionStore.releaseLock(anyString(), anyString(), anyString()))
                .thenReturn(Mono.just(true));
        // Default committer: returns the session it was given.
        when(committer.commit(anyString(), anyString(), anyCollection(), any(), any(FeedScannerSession.class), anyLong()))
                .thenAnswer(inv -> Mono.just((FeedScannerSession) inv.getArgument(4)));
        // Default hydrator: returns DTO per id, preserving order.
        when(hydrator.hydrate(any())).thenAnswer(inv -> {
            List<String> ids = inv.getArgument(0);
            List<ArticleCardDto> out = new ArrayList<>();
            for (String id : ids) {
                ArticleCardDto d = new ArticleCardDto();
                d.setId(id);
                d.setTitle("t-" + id);
                out.add(d);
            }
            return Mono.just(out);
        });
        // Default read-state: empty intervals, all candidates unread.
        when(readStateStore.loadReadState(anyString(), anyString(), anyLong()))
                .thenReturn(Mono.just(ReadState.empty()));
        when(readStateStore.filterUnreadIds(anyString(), anyString(), anyCollection()))
                .thenAnswer(inv -> Mono.just(new LinkedHashSet<>(inv.getArgument(2, java.util.Collection.class))));
    }

    private BuildFeedRequest req(String userId, String sessionId, EndpointKind kind, int limit) {
        return new BuildFeedRequest(userId, kind, null, sessionId, limit);
    }

    private Candidate candidate(String id, long score) {
        return new Candidate(id, score, 0, "tech", CandidateSource.PRIMARY);
    }

    /** Phase A returns new items above newestCursor. */
    @Test
    void phaseA_injectsNewItems_aboveNewestCursor() {
        // Existing session: newestCursor in the recent past.
        long now = java.time.Instant.now().getEpochSecond();
        FeedScannerSession existing = FeedScannerSession.builder()
                .sessionId("s-1").userId("u-1").scopeHash("scope-hash")
                .endpointKind(EndpointKind.PERSONALIZED).countryIds(List.of(0))
                .newestCursor(now - 10_000).olderCursor(now - 10_000)
                .pendingWindowStart(0L).pendingWindowEnd(0L).bufferIds(List.of())
                .createdAt(now - 60_000).updatedAt(now - 5_000)
                .build();
        when(sessionStore.find(eq("u-1"), eq("s-1"))).thenReturn(Mono.just(java.util.Optional.of(existing)));

        // Phase A scan returns 2 candidates above newestCursor.
        when(scanner.scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt()))
                .thenReturn(Mono.just(List.of(candidate("new-1", now - 100), candidate("new-2", now - 200))))
                .thenReturn(Mono.just(List.of())); // Phase C window empty
        // Phase C will keep scanning until maxWindows; default each Phase C call returns empty.
        when(scanner.scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt()))
                .thenAnswer(inv -> Mono.just(List.<Candidate>of()));
        // Phase A: scan was first called for the (newestCursor+1, now] window - return new items there.
        // We model this by checking the `windowStart` argument: above (now - 10_000) → return items.
        when(scanner.scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt()))
                .thenAnswer(inv -> {
                    long wStart = inv.getArgument(3);
                    if (wStart > existing.getNewestCursor()) {
                        return Mono.just(List.of(candidate("new-1", now - 100), candidate("new-2", now - 200)));
                    }
                    return Mono.just(List.<Candidate>of());
                });

        PageResult<ArticleCardDto> result = pipeline.build(req("u-1", "s-1", EndpointKind.PERSONALIZED, 5)).block();
        assertThat(result).isNotNull();
        assertThat(result.getData()).extracting(ArticleCardDto::getId).contains("new-1", "new-2");
        assertThat(result.getNewSinceLastSession()).isEqualTo(2);
        // Lock was acquired and released.
        verify(sessionStore).acquireLock(eq("u-1"), eq("s-1"), anyString(), any(Duration.class));
        verify(sessionStore).releaseLock(eq("u-1"), eq("s-1"), anyString());
    }

    /** Phase B drains buffer before Phase C scanner is called. */
    @Test
    void phaseB_drainsBufferBeforePhaseC() {
        long now = java.time.Instant.now().getEpochSecond();
        FeedScannerSession existing = FeedScannerSession.builder()
                .sessionId("s-2").userId("u-1").scopeHash("scope-hash")
                .endpointKind(EndpointKind.PERSONALIZED).countryIds(List.of(0))
                .newestCursor(now - 10).olderCursor(now - 1_000_000)
                .pendingWindowStart(now - 2_000_000).pendingWindowEnd(now - 1_000_001)
                .bufferIds(List.of("buf-1", "buf-2", "buf-3"))
                .createdAt(now - 60).updatedAt(now - 1)
                .build();
        when(sessionStore.find(eq("u-1"), eq("s-2"))).thenReturn(Mono.just(java.util.Optional.of(existing)));
        // Phase A scan returns nothing; Phase C scanner should NOT be called because buffer fills the page.
        when(scanner.scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt()))
                .thenReturn(Mono.just(List.of()));

        PageResult<ArticleCardDto> result = pipeline.build(req("u-1", "s-2", EndpointKind.PERSONALIZED, 3)).block();
        assertThat(result).isNotNull();
        assertThat(result.getData()).extracting(ArticleCardDto::getId).containsExactly("buf-1", "buf-2", "buf-3");

        // Phase A calls scanner once (for the (newestCursor, now] window).
        // Phase B drained buffer; Phase C did not run because page was already full.
        verify(scanner, times(1)).scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt());

        // Buffer fully drained → pendingWindow promoted to read interval at commit.
        ArgumentCaptor<List<Interval>> intervals = ArgumentCaptor.forClass(List.class);
        verify(committer).commit(anyString(), anyString(), anyCollection(), intervals.capture(),
                any(FeedScannerSession.class), anyLong());
        assertThat(intervals.getValue()).hasSize(1);
        assertThat(intervals.getValue().get(0).startTs()).isEqualTo(existing.getPendingWindowStart());
        assertThat(intervals.getValue().get(0).endTs()).isEqualTo(existing.getPendingWindowEnd());
    }

    /** Phase C interval-skip: covered windows are jumped over without any Redis scan. */
    @Test
    void phaseC_skipsWindowsCoveredByIntervals() {
        long now = java.time.Instant.now().getEpochSecond();
        long windowMs = properties.getWindowMillis();
        FeedScannerSession existing = FeedScannerSession.builder()
                .sessionId("s-3").userId("u-1").scopeHash("scope-hash")
                .endpointKind(EndpointKind.PERSONALIZED).countryIds(List.of(0))
                .newestCursor(now).olderCursor(now)
                .pendingWindowStart(0L).pendingWindowEnd(0L).bufferIds(List.of())
                .createdAt(now - 60_000).updatedAt(now - 1_000)
                .build();
        when(sessionStore.find(eq("u-1"), eq("s-3"))).thenReturn(Mono.just(java.util.Optional.of(existing)));

        // Cover the most-recent 7 windows with one interval.
        long coveringStart = now - 7 * windowMs + 1;
        long coveringEnd = now;
        List<Interval> existingIntervals = List.of(new Interval(coveringStart, coveringEnd));
        when(readStateStore.loadReadState(anyString(), anyString(), anyLong()))
                .thenReturn(Mono.just(new ReadState(existingIntervals)));

        AtomicReference<List<Long>> scanStarts = new AtomicReference<>(new ArrayList<>());
        when(scanner.scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt()))
                .thenAnswer(inv -> {
                    long wStart = inv.getArgument(3);
                    scanStarts.get().add(wStart);
                    return Mono.just(List.of(candidate("found-" + wStart, wStart + 100)));
                });

        PageResult<ArticleCardDto> result = pipeline.build(req("u-1", "s-3", EndpointKind.PERSONALIZED, 5)).block();
        assertThat(result).isNotNull();
        // At least one ranked item came from below the covered range.
        assertThat(result.getData()).isNotEmpty();
        // The scanner was never called with a window that falls INSIDE the covered range.
        // Phase A may legitimately scan above {@code coveringEnd} (looking for new items); Phase C
        // skips the entire interval in O(1) and only scans below {@code coveringStart}. So every
        // scan start must be either {@code > coveringEnd} (Phase A) or {@code < coveringStart}
        // (Phase C below the jump).
        for (long start : scanStarts.get()) {
            assertThat(start < coveringStart || start > coveringEnd)
                    .withFailMessage("scanner was called inside the covered interval at wStart=%d", start)
                    .isTrue();
        }
    }

    /** Dense window: Phase C fills the page mid-window → leftovers stored as bufferIds. */
    @Test
    void phaseC_denseWindow_storesPendingWindowAndBuffer() {
        long now = java.time.Instant.now().getEpochSecond();
        FeedScannerSession existing = FeedScannerSession.builder()
                .sessionId("s-4").userId("u-1").scopeHash("scope-hash")
                .endpointKind(EndpointKind.PERSONALIZED).countryIds(List.of(0))
                .newestCursor(now).olderCursor(now)
                .pendingWindowStart(0L).pendingWindowEnd(0L).bufferIds(List.of())
                .createdAt(now - 60_000).updatedAt(now - 1_000)
                .build();
        when(sessionStore.find(eq("u-1"), eq("s-4"))).thenReturn(Mono.just(java.util.Optional.of(existing)));

        when(scanner.scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt()))
                .thenAnswer(inv -> {
                    long wStart = inv.getArgument(3);
                    if (wStart > now) {
                        // Phase A: nothing new.
                        return Mono.just(List.of());
                    }
                    // First Phase C window: 8 candidates (dense).
                    List<Candidate> cands = new ArrayList<>();
                    for (int i = 0; i < 8; i++) {
                        cands.add(candidate("c-" + i, wStart + 1000 - i));
                    }
                    return Mono.just(cands);
                });

        PageResult<ArticleCardDto> result = pipeline.build(req("u-1", "s-4", EndpointKind.PERSONALIZED, 3)).block();
        assertThat(result).isNotNull();
        assertThat(result.getData()).extracting(ArticleCardDto::getId).containsExactly("c-0", "c-1", "c-2");

        // Saved session has bufferIds = leftover and a non-zero pendingWindow.
        ArgumentCaptor<FeedScannerSession> sessionCaptor = ArgumentCaptor.forClass(FeedScannerSession.class);
        verify(committer).commit(anyString(), anyString(), anyCollection(), any(), sessionCaptor.capture(), anyLong());
        FeedScannerSession saved = sessionCaptor.getValue();
        assertThat(saved.getBufferIds()).containsExactly("c-3", "c-4", "c-5", "c-6", "c-7");
        assertThat(saved.getPendingWindowEnd()).isGreaterThan(0L);
        assertThat(saved.getPendingWindowEnd()).isGreaterThanOrEqualTo(saved.getPendingWindowStart());
    }

    /** Lock contention surfaces FeedRequestInProgressException. */
    @Test
    void lockContention_surfacesException() {
        long now = java.time.Instant.now().getEpochSecond();
        FeedScannerSession existing = FeedScannerSession.builder()
                .sessionId("s-x").userId("u-1").scopeHash("scope-hash")
                .endpointKind(EndpointKind.PERSONALIZED).countryIds(List.of(0))
                .newestCursor(now).olderCursor(now).bufferIds(List.of())
                .createdAt(now).updatedAt(now)
                .build();
        when(sessionStore.find(eq("u-1"), eq("s-x"))).thenReturn(Mono.just(java.util.Optional.of(existing)));
        when(sessionStore.acquireLock(anyString(), anyString(), anyString(), any(Duration.class)))
                .thenReturn(Mono.just(false));

        StepVerifier.create(pipeline.build(req("u-1", "s-x", EndpointKind.PERSONALIZED, 5)))
                .expectError(CustomExceptions.FeedRequestInProgressException.class)
                .verify();

        // Committer never invoked.
        verify(committer, never()).commit(anyString(), anyString(), anyCollection(), any(),
                any(FeedScannerSession.class), anyLong());
    }

    /** Commit ordering: hydrate is invoked before commit and committer receives non-null fields. */
    @Test
    void commit_isInvokedAfterHydration_andSavesUpdatedSession() {
        long now = java.time.Instant.now().getEpochSecond();
        FeedScannerSession existing = FeedScannerSession.builder()
                .sessionId("s-5").userId("u-1").scopeHash("scope-hash")
                .endpointKind(EndpointKind.PERSONALIZED).countryIds(List.of(0))
                .newestCursor(now - 1_000).olderCursor(now - 1_000).bufferIds(List.of())
                .createdAt(now - 60_000).updatedAt(now - 1_000)
                .build();
        when(sessionStore.find(eq("u-1"), eq("s-5"))).thenReturn(Mono.just(java.util.Optional.of(existing)));
        when(scanner.scan(any(), any(), anyBoolean(), anyLong(), anyLong(), anyInt()))
                .thenAnswer(inv -> {
                    long wStart = inv.getArgument(3);
                    if (wStart > existing.getNewestCursor()) {
                        return Mono.just(List.of(candidate("a", now - 50)));
                    }
                    return Mono.just(List.<Candidate>of());
                });

        PageResult<ArticleCardDto> result = pipeline.build(req("u-1", "s-5", EndpointKind.PERSONALIZED, 5)).block();
        assertThat(result).isNotNull();
        assertThat(result.getSessionId()).isEqualTo("s-5");

        InOrder order = inOrder(hydrator, committer);
        order.verify(hydrator).hydrate(any());
        order.verify(committer).commit(anyString(), anyString(), anyCollection(), any(),
                any(FeedScannerSession.class), anyLong());
    }
}
