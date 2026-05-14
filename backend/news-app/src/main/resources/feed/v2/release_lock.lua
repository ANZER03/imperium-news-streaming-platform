-- Atomic compare-and-delete lock release.
-- KEYS[1] = lock key, ARGV[1] = expected token
-- Returns 1 if released, 0 otherwise.
if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
else
    return 0
end
