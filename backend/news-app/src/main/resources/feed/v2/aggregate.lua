-- Feed v2 candidate aggregation, single Lua call per country.
-- KEYS: feed ZSET keys (topic ZSETs, or a single fallback ZSET). All keys share the same country hash tag.
-- ARGV[1] sessionAnchor (long as decimal string)
-- ARGV[2] seekCursor (long as decimal string, Long.MAX_VALUE on first page)
-- ARGV[3] injectPerTopic
-- ARGV[4] scrollPerTopic
-- ARGV[5] includeInject (1/0)
-- ARGV[6] weightScale (double as string, 0.0 disables weighting)
-- ARGV[7..] topicWeights aligned with KEYS order (1.0 default if shorter)
--
-- Inject range:  rawScore >= sessionAnchor  (anchor article belongs to inject only)
-- Scroll range:  rawScore < min(seekCursor, sessionAnchor)
--
-- Output: flat array, alternating quadruples {bucket, articleId, rawScore, adjustedScore}.
local anchor       = tonumber(ARGV[1])
local seekCursor   = tonumber(ARGV[2])
local injectPerTopic = tonumber(ARGV[3])
local scrollPerTopic = tonumber(ARGV[4])
local includeInject  = tonumber(ARGV[5])
local weightScale    = tonumber(ARGV[6])

local scrollUpper = seekCursor
if anchor < scrollUpper then
    scrollUpper = anchor
end

local anchorStr      = string.format('%.0f', anchor)
local scrollUpperStr = '(' .. string.format('%.0f', scrollUpper)

local injectById = {}
local scrollById = {}

for topicOrder, key in ipairs(KEYS) do
    local topicWeight = tonumber(ARGV[6 + topicOrder]) or 1.0
    if topicWeight <= 0 then topicWeight = 0.0001 end
    local weightAdjust = math.log(topicWeight) * weightScale

    if includeInject == 1 and injectPerTopic > 0 then
        local injectRows = redis.call('ZREVRANGEBYSCORE', key, '+inf', anchorStr,
                                       'WITHSCORES', 'LIMIT', 0, injectPerTopic)
        for idx = 1, #injectRows, 2 do
            local articleId = injectRows[idx]
            local rawScore  = tonumber(injectRows[idx + 1])
            local adjusted  = rawScore + weightAdjust
            local existing  = injectById[articleId]
            if (not existing)
               or rawScore > existing.rawScore
               or (rawScore == existing.rawScore and adjusted > existing.adjusted)
               or (rawScore == existing.rawScore and adjusted == existing.adjusted and topicOrder < existing.topicOrder) then
                injectById[articleId] = {
                    id = articleId, rawScore = rawScore, adjusted = adjusted, topicOrder = topicOrder
                }
            end
        end
    end

    if scrollPerTopic > 0 then
        local scrollRows = redis.call('ZREVRANGEBYSCORE', key, scrollUpperStr, '-inf',
                                       'WITHSCORES', 'LIMIT', 0, scrollPerTopic)
        for idx = 1, #scrollRows, 2 do
            local articleId = scrollRows[idx]
            local rawScore  = tonumber(scrollRows[idx + 1])
            local adjusted  = rawScore + weightAdjust
            if not injectById[articleId] then
                local existing = scrollById[articleId]
                if (not existing)
                   or rawScore > existing.rawScore
                   or (rawScore == existing.rawScore and adjusted > existing.adjusted)
                   or (rawScore == existing.rawScore and adjusted == existing.adjusted and topicOrder < existing.topicOrder) then
                    scrollById[articleId] = {
                        id = articleId, rawScore = rawScore, adjusted = adjusted, topicOrder = topicOrder
                    }
                end
            end
        end
    end
end

local function compare(a, b)
    if a.rawScore ~= b.rawScore then return a.rawScore > b.rawScore end
    if a.adjusted ~= b.adjusted then return a.adjusted > b.adjusted end
    if a.topicOrder ~= b.topicOrder then return a.topicOrder < b.topicOrder end
    return a.id < b.id
end

local injectList = {}
for _, c in pairs(injectById) do table.insert(injectList, c) end
table.sort(injectList, compare)

local scrollList = {}
for _, c in pairs(scrollById) do table.insert(scrollList, c) end
table.sort(scrollList, compare)

local out = {}
for _, c in ipairs(injectList) do
    table.insert(out, 'inject')
    table.insert(out, c.id)
    table.insert(out, string.format('%.0f', c.rawScore))
    table.insert(out, string.format('%.6f', c.adjusted))
end
for _, c in ipairs(scrollList) do
    table.insert(out, 'scroll')
    table.insert(out, c.id)
    table.insert(out, string.format('%.0f', c.rawScore))
    table.insert(out, string.format('%.6f', c.adjusted))
end
return out
