package solutions.imperium.news_api.core;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class PageResult<T> {
    private List<T> data;
    private Long nextCursor;
    private Long sessionCursor;
    private String sessionId;
    private Long sessionAnchor;
    private Long nextScrollCursor;
    private String source;
    private Boolean hasMore;
    private Integer newSinceLastSession;
    private List<String> warnings;

    public PageResult(List<T> data, Long nextCursor) {
        this.data = data;
        this.nextCursor = nextCursor;
    }
}
