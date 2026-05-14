-- Batch ZMSCORE for the seen-store. Reactive Spring Data exposes per-id score
-- only on some versions; routing through Lua keeps the call universally batched.
-- KEYS[1] = seen ZSET key, ARGV = article ids
-- Returns array of strings: each element is the score (as string) or empty string when absent.
local key = KEYS[1]
local out = {}
for i = 1, #ARGV do
    local score = redis.call('ZSCORE', key, ARGV[i])
    if score then
        table.insert(out, score)
    else
        table.insert(out, '')
    end
end
return out
