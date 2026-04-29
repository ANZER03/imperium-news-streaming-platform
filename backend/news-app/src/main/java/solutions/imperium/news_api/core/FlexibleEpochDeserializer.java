package solutions.imperium.news_api.core;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.deser.std.StdDeserializer;

import java.io.IOException;
import java.time.Instant;
import java.time.format.DateTimeParseException;

/**
 * Deserializes timestamp fields that may arrive as:
 *  - epoch seconds (Long/numeric string)
 *  - epoch milliseconds (> 2e10)
 *  - epoch microseconds (> 2e13)
 *  - ISO-8601 string (e.g. "2026-04-28T01:34:24.559Z")
 * Always returns epoch seconds as Long, or null on blank/unparseable input.
 */
public class FlexibleEpochDeserializer extends StdDeserializer<Long> {

    public FlexibleEpochDeserializer() {
        super(Long.class);
    }

    @Override
    public Long deserialize(JsonParser p, DeserializationContext ctx) throws IOException {
        String raw = p.getText();
        if (raw == null) return null;
        raw = raw.trim();
        if (raw.isEmpty() || raw.equalsIgnoreCase("null")) return null;

        // Try numeric first
        try {
            long v = Long.parseLong(raw);
            if (v > 2_000_000_000_000_000L) return v / 1_000_000L; // µs → s
            if (v > 20_000_000_000L)         return v / 1_000L;     // ms → s
            return v;
        } catch (NumberFormatException ignored) {
        }

        // Try ISO-8601
        try {
            return Instant.parse(raw).getEpochSecond();
        } catch (DateTimeParseException ignored) {
        }

        return null;
    }
}
