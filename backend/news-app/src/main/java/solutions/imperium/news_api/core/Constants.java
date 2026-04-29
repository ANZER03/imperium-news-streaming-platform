package solutions.imperium.news_api.core;

public class Constants {
    public static final String KEY_USER_PREFS = "user:%s:prefs"; // %s is userId
    public static final String KEY_USER_VIEWED = "user:%s:viewed";
    public static final String KEY_FEED_TOPIC = "feed:topic:%s";
    public static final String KEY_NEWS_HASH = "news:%s";
    public static final String KEY_TOPICS_LIST = "topics:list"; // cached topic taxonomy
    public static final String KEY_ARTICLE_CACHE = "article:%s";  // full article cache, TTL 24h
    public static final String KEY_USER_SAVED = "user:%s:saved";  // bookmarked article IDs (no TTL)
    public static final String KEY_COUNTRIES_LIST = "countries:list";
    public static final String KEY_FEED_COUNTRY = "feed:country:%s";
}
