package solutions.imperium.news_api.domain.feed.v3;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import solutions.imperium.news_api.domain.feed.v3.model.Interval;
import solutions.imperium.news_api.domain.feed.v3.model.Window;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;

/**
 * Pure utility for the V3 read-interval algebra. No Spring, no I/O.
 *
 * <p>An {@link Interval} represents an inclusive timestamp range that the server has fully
 * scanned and exhausted for a given (userId, scopeHash). Intervals are stored normalized:
 * sorted by start, with overlapping or touching ranges merged.
 *
 * <p>Provides:
 * <ul>
 *   <li>{@link #normalize(List, long)} — sort + merge + drop expired</li>
 *   <li>{@link #containsTimestamp(List, long)} — O(log N) point check</li>
 *   <li>{@link #coversRange(List, long, long)} — full-cover check for a window</li>
 *   <li>{@link #subtract(List, long, long)} — uncovered sub-windows of [start, end]</li>
 *   <li>{@link #serialize(ObjectMapper, List)} / {@link #deserialize(ObjectMapper, String)}</li>
 * </ul>
 */
public final class ReadIntervals {

    private static final TypeReference<List<Interval>> LIST_TYPE = new TypeReference<>() {};

    private ReadIntervals() {
    }

    /**
     * Returns a new normalized list: drops intervals that end before {@code minValidTs}, sorts by
     * {@code startTs}, and merges any pair that overlaps or touches (i.e. {@code a.endTs >= b.startTs - 1}
     * — adjacent integer ranges are merged into one).
     *
     * <p>Input is not mutated. Returns an immutable list.
     */
    public static List<Interval> normalize(List<Interval> intervals, long minValidTs) {
        if (intervals == null || intervals.isEmpty()) {
            return List.of();
        }
        List<Interval> kept = new ArrayList<>(intervals.size());
        for (Interval i : intervals) {
            if (i == null) continue;
            if (i.endTs() < minValidTs) continue; // expired
            // Clip the start at minValidTs to keep merge correct after pruning.
            long start = Math.max(i.startTs(), minValidTs);
            kept.add(new Interval(start, i.endTs()));
        }
        if (kept.isEmpty()) return List.of();
        kept.sort(Comparator.comparingLong(Interval::startTs).thenComparingLong(Interval::endTs));

        List<Interval> merged = new ArrayList<>(kept.size());
        Interval current = kept.get(0);
        for (int idx = 1; idx < kept.size(); idx++) {
            Interval next = kept.get(idx);
            // Treat touching ranges as mergeable: [3,5] and [6,8] merge into [3,8].
            if (next.startTs() <= current.endTs() + 1) {
                long newEnd = Math.max(current.endTs(), next.endTs());
                current = new Interval(current.startTs(), newEnd);
            } else {
                merged.add(current);
                current = next;
            }
        }
        merged.add(current);
        return Collections.unmodifiableList(merged);
    }

    /** O(log N) point lookup. Assumes {@code intervals} is normalized. */
    public static boolean containsTimestamp(List<Interval> intervals, long ts) {
        if (intervals == null || intervals.isEmpty()) return false;
        int lo = 0;
        int hi = intervals.size() - 1;
        while (lo <= hi) {
            int mid = (lo + hi) >>> 1;
            Interval m = intervals.get(mid);
            if (ts < m.startTs()) {
                hi = mid - 1;
            } else if (ts > m.endTs()) {
                lo = mid + 1;
            } else {
                return true;
            }
        }
        return false;
    }

    /**
     * Returns true iff {@code [wStart, wEnd]} is fully covered by a single normalized interval.
     */
    public static boolean coversRange(List<Interval> intervals, long wStart, long wEnd) {
        if (wEnd < wStart) return true;
        if (intervals == null || intervals.isEmpty()) return false;
        for (Interval i : intervals) {
            if (i.startTs() > wStart) return false; // intervals are sorted; nothing later can cover this start
            if (i.startTs() <= wStart && i.endTs() >= wEnd) return true;
        }
        return false;
    }

    /**
     * Returns the (sorted) interval that fully covers {@code [wStart, wEnd]}, or {@code null} if
     * none does. Use this with {@link #coversRange(List, long, long)} when you also need the
     * lower bound of the covering interval (e.g. to jump past the entire interval in O(1)).
     */
    public static Interval findCoveringInterval(List<Interval> intervals, long wStart, long wEnd) {
        if (wEnd < wStart) return null;
        if (intervals == null || intervals.isEmpty()) return null;
        for (Interval i : intervals) {
            if (i.startTs() > wStart) return null;
            if (i.startTs() <= wStart && i.endTs() >= wEnd) return i;
        }
        return null;
    }

    /**
     * Returns the sub-windows of {@code [wStart, wEnd]} not covered by {@code intervals}. The
     * result is in descending order of {@code endTs} (newest window first), matching the order
     * the scanner consumes them when stepping backward.
     */
    public static List<Window> subtract(List<Interval> intervals, long wStart, long wEnd) {
        if (wEnd < wStart) return List.of();
        if (intervals == null || intervals.isEmpty()) {
            return List.of(new Window(wStart, wEnd));
        }
        List<Window> gaps = new ArrayList<>();
        long cursor = wStart;
        for (Interval i : intervals) {
            if (i.endTs() < cursor) continue;            // before the window
            if (i.startTs() > wEnd) break;               // past the window
            long iStart = Math.max(i.startTs(), cursor);
            long iEnd = Math.min(i.endTs(), wEnd);
            if (iStart > cursor) {
                gaps.add(new Window(cursor, iStart - 1));
            }
            cursor = iEnd + 1;
            if (cursor > wEnd) break;
        }
        if (cursor <= wEnd) {
            gaps.add(new Window(cursor, wEnd));
        }
        // Reverse: newest first.
        Collections.reverse(gaps);
        return Collections.unmodifiableList(gaps);
    }

    public static String serialize(ObjectMapper mapper, List<Interval> intervals) {
        try {
            return mapper.writeValueAsString(intervals == null ? List.of() : intervals);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize read intervals", e);
        }
    }

    public static List<Interval> deserialize(ObjectMapper mapper, String json) {
        if (json == null || json.isBlank()) return List.of();
        try {
            List<Interval> parsed = mapper.readValue(json, LIST_TYPE);
            return parsed == null ? List.of() : parsed;
        } catch (JsonProcessingException e) {
            // Corrupt payload: return empty rather than poisoning the request.
            return List.of();
        }
    }
}
