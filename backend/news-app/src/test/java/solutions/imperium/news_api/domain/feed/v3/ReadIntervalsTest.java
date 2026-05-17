package solutions.imperium.news_api.domain.feed.v3;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;
import solutions.imperium.news_api.domain.feed.v3.model.Window;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ReadIntervalsTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void normalize_returnsEmpty_whenInputIsNullOrEmpty() {
        assertThat(ReadIntervals.normalize(null, 0L)).isEmpty();
        assertThat(ReadIntervals.normalize(List.of(), 0L)).isEmpty();
    }

    @Test
    void normalize_dropsExpiredIntervals() {
        List<Interval> input = List.of(
                new Interval(100, 200),
                new Interval(50, 80),
                new Interval(300, 400)
        );
        List<Interval> out = ReadIntervals.normalize(input, 90);
        assertThat(out).containsExactly(
                new Interval(100, 200),
                new Interval(300, 400)
        );
    }

    @Test
    void normalize_clipsStartAtMinValidTs() {
        List<Interval> input = List.of(new Interval(100, 500));
        List<Interval> out = ReadIntervals.normalize(input, 200);
        assertThat(out).containsExactly(new Interval(200, 500));
    }

    @Test
    void normalize_mergesOverlappingAndTouching_examplesFromPrd() {
        // PRD example:
        // [[7000,8000], [5000,7000], [3000,4500], [4400,5200]] -> [[3000,8000]]
        List<Interval> input = List.of(
                new Interval(7000, 8000),
                new Interval(5000, 7000),
                new Interval(3000, 4500),
                new Interval(4400, 5200)
        );
        List<Interval> out = ReadIntervals.normalize(input, 0L);
        assertThat(out).containsExactly(new Interval(3000, 8000));
    }

    @Test
    void normalize_mergesAdjacentIntegerIntervals() {
        // [3,5] and [6,8] should merge into [3,8]: ranges are inclusive integer ranges.
        List<Interval> input = List.of(new Interval(3, 5), new Interval(6, 8));
        List<Interval> out = ReadIntervals.normalize(input, 0L);
        assertThat(out).containsExactly(new Interval(3, 8));
    }

    @Test
    void normalize_keepsDisjointIntervalsSorted() {
        List<Interval> input = List.of(new Interval(900, 1000), new Interval(100, 200));
        List<Interval> out = ReadIntervals.normalize(input, 0L);
        assertThat(out).containsExactly(new Interval(100, 200), new Interval(900, 1000));
    }

    @Test
    void containsTimestamp_handlesEdgesAndGaps() {
        List<Interval> intervals = ReadIntervals.normalize(
                List.of(new Interval(100, 200), new Interval(300, 400)), 0L);
        assertThat(ReadIntervals.containsTimestamp(intervals, 99)).isFalse();
        assertThat(ReadIntervals.containsTimestamp(intervals, 100)).isTrue();
        assertThat(ReadIntervals.containsTimestamp(intervals, 150)).isTrue();
        assertThat(ReadIntervals.containsTimestamp(intervals, 200)).isTrue();
        assertThat(ReadIntervals.containsTimestamp(intervals, 250)).isFalse();
        assertThat(ReadIntervals.containsTimestamp(intervals, 350)).isTrue();
        assertThat(ReadIntervals.containsTimestamp(intervals, 401)).isFalse();
    }

    @Test
    void coversRange_trueOnlyForFullCover() {
        List<Interval> intervals = ReadIntervals.normalize(
                List.of(new Interval(100, 500)), 0L);
        assertThat(ReadIntervals.coversRange(intervals, 200, 400)).isTrue();
        assertThat(ReadIntervals.coversRange(intervals, 100, 500)).isTrue();
        assertThat(ReadIntervals.coversRange(intervals, 50, 500)).isFalse();
        assertThat(ReadIntervals.coversRange(intervals, 100, 600)).isFalse();
        assertThat(ReadIntervals.coversRange(List.of(), 100, 200)).isFalse();
    }

    @Test
    void subtract_returnsFullWindow_whenNoIntervals() {
        List<Window> gaps = ReadIntervals.subtract(List.of(), 100, 200);
        assertThat(gaps).containsExactly(new Window(100, 200));
    }

    @Test
    void subtract_returnsEmpty_whenWindowFullyCovered() {
        List<Interval> intervals = ReadIntervals.normalize(List.of(new Interval(100, 500)), 0L);
        assertThat(ReadIntervals.subtract(intervals, 200, 400)).isEmpty();
    }

    @Test
    void subtract_returnsGapsAroundIntervals_orderedNewestFirst() {
        // intervals: [200,300] and [400,450]; window [100, 500]
        // Expected gaps in original (asc) order: [100,199], [301,399], [451,500]
        // Returned newest-first: [451,500], [301,399], [100,199]
        List<Interval> intervals = ReadIntervals.normalize(
                List.of(new Interval(200, 300), new Interval(400, 450)), 0L);
        List<Window> gaps = ReadIntervals.subtract(intervals, 100, 500);
        assertThat(gaps).containsExactly(
                new Window(451, 500),
                new Window(301, 399),
                new Window(100, 199)
        );
    }

    @Test
    void subtract_handlesIntervalsThatExtendBeyondWindow() {
        List<Interval> intervals = ReadIntervals.normalize(
                List.of(new Interval(50, 250), new Interval(450, 600)), 0L);
        List<Window> gaps = ReadIntervals.subtract(intervals, 100, 500);
        assertThat(gaps).containsExactly(new Window(251, 449));
    }

    @Test
    void subtract_invertedRange_returnsEmpty() {
        List<Window> gaps = ReadIntervals.subtract(List.of(), 200, 100);
        assertThat(gaps).isEmpty();
    }

    @Test
    void serialize_thenDeserialize_roundTripsAndNormalizes() {
        List<Interval> intervals = ReadIntervals.normalize(
                List.of(new Interval(100, 200), new Interval(300, 400)), 0L);
        String json = ReadIntervals.serialize(mapper, intervals);
        List<Interval> back = ReadIntervals.deserialize(mapper, json);
        assertThat(back).isEqualTo(intervals);
    }

    @Test
    void deserialize_returnsEmpty_onBlankOrCorruptInput() {
        assertThat(ReadIntervals.deserialize(mapper, null)).isEmpty();
        assertThat(ReadIntervals.deserialize(mapper, "")).isEmpty();
        assertThat(ReadIntervals.deserialize(mapper, "{not-json")).isEmpty();
    }

    @Test
    void interval_rejectsInvertedRanges() {
        assertThatThrownBy(() -> new Interval(500, 100))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
