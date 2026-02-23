import requests
import json
import sys

BASE_URL = "http://localhost:8000"

def check_endpoint(endpoint_name):
    url = f"{BASE_URL}/{endpoint_name}/"
    print(f"Testing {url} ...")
    try:
        response = requests.get(url)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code != 200:
            print(f"❌ FAIL: Expected 200, got {response.status_code}")
            print(f"Response Body: {response.text[:500]}")
            return False
            
        try:
            data = response.json()
        except json.JSONDecodeError:
            print("❌ FAIL: Response is not valid JSON")
            print(f"Response Body: {response.text[:500]}")
            return False
            
        if not isinstance(data, list):
            print(f"❌ FAIL: Expected a JSON LIST (Array), got {type(data)}")
            print(f"Response Body start: {str(data)[:200]}")
            return False
            
        print(f"✅ SUCCESS: Received list with {len(data)} items.")
        if len(data) > 0:
            print(f"Sample item keys: {list(data[0].keys())}")
            
        return True

    except requests.exceptions.ConnectionError:
        print("❌ FAIL: Could not connect to localhost:8000. Is the backend running?")
        return False
    except Exception as e:
        print(f"❌ FAIL: Unexpected error: {e}")
        return False

print("--- DIAGNOSTIC START ---")
novels_ok = check_endpoint("novels")
webtoons_ok = check_endpoint("webtoons")

if novels_ok and webtoons_ok:
    print("\n✅ API SYSTEM SEEMS HEALTHY. Backend is sending correct data formats.")
else:
    print("\n❌ API SYSTEM HAS ISSUES. Frontend is likely crashing due to bad data.")
