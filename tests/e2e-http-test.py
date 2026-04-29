import urllib.request
import json

base_url = "http://localhost:8999/api/v1"

print("=== 1. User Onboarding ===")
onboard_req = urllib.request.Request(f"{base_url}/users/onboard", method="POST")
onboard_req.add_header('Content-Type', 'application/json')
onboard_data = json.dumps({"topics": ["science_technology"], "countryId": 1}).encode('utf-8')
with urllib.request.urlopen(onboard_req, data=onboard_data) as response:
    onboard_res = json.loads(response.read().decode())
    user_id = onboard_res["userId"]
    print(f"Extracted User ID: {user_id}\n")

print("=== 2. Get Initial Feed ===")
feed_req_1 = urllib.request.Request(f"{base_url}/feed?userId={user_id}&limit=5")
with urllib.request.urlopen(feed_req_1) as response:
    feed_res_1 = json.loads(response.read().decode())
    print(f"Feed Page 1 returned {len(feed_res_1['data'])} articles.")
    next_cursor = feed_res_1.get("nextCursor")
    print(f"Extracted Cursor for Next Page: {next_cursor}")
    if len(feed_res_1['data']) >= 2:
        article_1_id = feed_res_1['data'][0]['id']
        article_2_id = feed_res_1['data'][1]['id']
        print(f"Article 1 ID: {article_1_id}, Article 2 ID: {article_2_id}\n")
    else:
        print("Not enough articles returned.\n")
        exit(1)

print("=== 3. Scroll to Next Page ===")
feed_req_2 = urllib.request.Request(f"{base_url}/feed?userId={user_id}&limit=5&cursor={next_cursor}")
with urllib.request.urlopen(feed_req_2) as response:
    feed_res_2 = json.loads(response.read().decode())
    print(f"Feed Page 2 returned {len(feed_res_2['data'])} articles.\n")

print("=== 4. Track Article Views ===")
view_req = urllib.request.Request(f"{base_url}/feed/views", method="POST")
view_req.add_header('Content-Type', 'application/json')
view_data = json.dumps({"userId": user_id, "articleIds": [article_1_id, article_2_id]}).encode('utf-8')
with urllib.request.urlopen(view_req, data=view_data) as response:
    print(f"Marked {article_1_id} and {article_2_id} as viewed.\n")

print("=== 5. Get Feed Again (Viewed articles should be filtered) ===")
feed_req_3 = urllib.request.Request(f"{base_url}/feed?userId={user_id}&limit=5")
with urllib.request.urlopen(feed_req_3) as response:
    feed_res_3 = json.loads(response.read().decode())
    returned_ids = [a['id'] for a in feed_res_3['data']]
    print(f"Feed Page 1 (After Views) returned IDs: {returned_ids}")
    if article_1_id not in returned_ids and article_2_id not in returned_ids:
        print("SUCCESS: Viewed articles were successfully filtered out!")
    else:
        print("FAILURE: Viewed articles were NOT filtered out!")
