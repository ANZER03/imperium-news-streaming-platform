package solutions.imperium.news_api.exception;

public class CustomExceptions {
    public static class ArticleNotFoundException extends RuntimeException {
        public ArticleNotFoundException(String articleId) {
            super("Article not found: " + articleId);
        }
    }
}
