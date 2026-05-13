package solutions.imperium.news_api.exception;

public class CustomExceptions {
    public static class ArticleNotFoundException extends RuntimeException {
        public ArticleNotFoundException(String articleId) {
            super("Article not found: " + articleId);
        }
    }

    public static class FeedRequestInProgressException extends RuntimeException {
        public FeedRequestInProgressException(String sessionId) {
            super("Feed request already in progress for session: " + sessionId);
        }
    }
}
