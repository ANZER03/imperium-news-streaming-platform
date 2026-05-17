package solutions.imperium.news_api.core;

public class Constants {
    public static final String KEY_USER_PREFS = "user:%s:prefs"; // %s is userId
    public static final String KEY_USER_VIEWED = "user:%s:viewed";
    public static final String KEY_USER_VIEWED_BLOOM = "bf:user:%s:viewed";
    public static final String KEY_FEED_SESSION = "session:%s:%s";
    public static final String KEY_FEED_SESSION_LOCK = "lock:%s:%s";
    public static final String KEY_FEED_TOPIC = "feed:topic:%s";
    public static final String KEY_NEWS_HASH = "news:%s";
    public static final String KEY_TOPICS_LIST = "topics:list"; // cached topic taxonomy
    public static final String KEY_ARTICLE_CACHE = "article:%s";  // full article cache, TTL 24h
    public static final String KEY_USER_SAVED = "user:%s:saved";  // bookmarked article IDs (no TTL)
    public static final String KEY_COUNTRIES_LIST = "countries:list";
    public static final String KEY_FEED_COUNTRY = "feed:country:%s";
    public static final String KEY_FEED_COUNTRY_TOPIC = "feed:country:%s:topic:%s"; // %s = countryId, topicId

    // Feed Scanner (V3 algorithm) keys — see backend/news-app/feed_v3_prd.md
    public static final String KEY_FEED_READ_INTERVALS = "feed:read:intervals:%s:%s"; // %s = userId, scopeHash
    public static final String KEY_FEED_READ_IDS = "feed:read:ids:%s:%s";              // %s = userId, scopeHash
    public static final String KEY_FEED_SCANNER_SESSION = "feed:session:%s:%s";        // %s = userId, sessionId
    public static final String KEY_FEED_SCANNER_LOCK = "feed:lock:%s:%s";              // %s = userId, sessionId
}
