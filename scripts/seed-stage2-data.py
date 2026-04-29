import redis
import time
import json

r = redis.Redis(host='localhost', port=46379, db=0)

user_id = "user123"
topic = "science_technology"

# 1. Seed user preferences
# Note: The Java app expects a serialized List for 'topics' if using Jackson2JsonRedisSerializer
# but the UserRepository.saveUserPreferences uses Map.of("topics", req.getTopics())
# and the RedisConfig uses Jackson2JsonRedisSerializer(Object.class).
# Jackson serializes List as JSON array.

topics_json = json.dumps([topic])
r.hset(f"user:{user_id}:prefs", "topics", topics_json)
r.hset(f"user:{user_id}:prefs", "country_id", "1")

# 2. Seed topic feed (ZSET)
# Create 30 articles with decreasing timestamps
now = int(time.time())
for i in range(30):
    art_id = f"art_{i}"
    timestamp = now - (i * 100) # Each article 100s apart
    r.zadd(f"feed:topic:{topic}", {art_id: timestamp})
    
    # 3. Seed article metadata (HASH)
    r.hset(f"news:{art_id}", "title", json.dumps(f"Article Title {i}"))
    r.hset(f"news:{art_id}", "excerpt", json.dumps(f"This is the excerpt for article {i}"))
    r.hset(f"news:{art_id}", "published_at", json.dumps(str(timestamp)))
    r.hset(f"news:{art_id}", "source_name", json.dumps("Imperium News"))
    r.hset(f"news:{art_id}", "root_topic_label", json.dumps("Technology"))

print(f"Seeded 30 articles for user {user_id} in topic {topic}")

