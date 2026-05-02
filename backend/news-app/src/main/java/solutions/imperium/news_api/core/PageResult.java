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

    public PageResult(List<T> data, Long nextCursor) {
        this.data = data;
        this.nextCursor = nextCursor;
    }
}
