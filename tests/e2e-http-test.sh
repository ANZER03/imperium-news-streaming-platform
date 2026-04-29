#!/bin/bash
set -e

BASE_URL="http://localhost:8999/api/v1"

echo "=== 1. User Onboarding ==="
# User selects 'science_technology' from taxonomy
ONBOARD_RES=$(curl -s -X POST "$BASE_URL/users/onboard" \
  -H "Content-Type: application/json" \
  -d '{"topics": ["science_technology"], "countryId": 1}')

echo "Onboarding Response: $ONBOARD_RES"
USER_ID=$(echo "$ONBOARD_RES" | jq -r '.userId')
echo "Extracted User ID: $USER_ID"
echo ""

echo "=== 2. Get Initial Feed ==="
FEED_RES_1=$(curl -s "$BASE_URL/feed?userId=$USER_ID&limit=5")
echo "Feed Page 1 Response: $FEED_RES_1" | jq .

NEXT_CURSOR=$(echo "$FEED_RES_1" | jq -r '.nextCursor')
ARTICLE_1_ID=$(echo "$FEED_RES_1" | jq -r '.data[0].id')
ARTICLE_2_ID=$(echo "$FEED_RES_1" | jq -r '.data[1].id')
echo "Extracted Cursor for Next Page: $NEXT_CURSOR"
echo ""

echo "=== 3. Scroll to Next Page ==="
FEED_RES_2=$(curl -s "$BASE_URL/feed?userId=$USER_ID&limit=5&cursor=$NEXT_CURSOR")
echo "Feed Page 2 Response: $FEED_RES_2" | jq .
echo ""

echo "=== 4. Track Article Views ==="
echo "Marking $ARTICLE_1_ID and $ARTICLE_2_ID as viewed..."
curl -s -X POST "$BASE_URL/feed/views" \
  -H "Content-Type: application/json" \
  -d "{\"userId\": \"$USER_ID\", \"articleIds\": [\"$ARTICLE_1_ID\", \"$ARTICLE_2_ID\"]}"
echo ""
echo ""

echo "=== 5. Get Feed Again (Viewed articles should be filtered) ==="
FEED_RES_3=$(curl -s "$BASE_URL/feed?userId=$USER_ID&limit=5")
echo "Feed Page 1 (After Views) Response: $FEED_RES_3" | jq .
