-- Batch mark articles as seen + refresh TTL + opportunistic prune.
-- KEYS[1] = seen ZSET key
-- ARGV[1] = ttlSeconds
-- ARGV[2] = pruneOlderThanScore (0 to disable)
-- ARGV[3..] = alternating score, articleId pairs
local key            = KEYS[1]
local ttl            = tonumber(ARGV[1])
local pruneThreshold = tonumber(ARGV[2])

local args = {}
for i = 3, #ARGV do
    table.insert(args, ARGV[i])
end

local added = 0
if #args >= 2 then
    added = redis.call('ZADD', key, unpack(args))
end

if ttl > 0 then
    redis.call('EXPIRE', key, ttl)
end

if pruneThreshold > 0 then
    redis.call('ZREMRANGEBYSCORE', key, '-inf', '(' .. pruneThreshold)
end

return added
