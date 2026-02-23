import requests
import json

try:
    print("Fetching http://localhost:8000/novels/ ...")
    response = requests.get("http://localhost:8000/novels/")
    print(f"Status Code: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"Data count: {len(data)}")
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        print("Error fetching data")
        print(response.text)

    print("\nFetching http://localhost:8000/webtoons/ ...")
    response_w = requests.get("http://localhost:8000/webtoons/")
    print(f"Status Code: {response_w.status_code}")
    if response_w.status_code == 200:
        data_w = response_w.json()
        print(f"Data count: {len(data_w)}")
    else:
        print("Error fetching webtoons")

except Exception as e:
    print(f"Connection failed: {e}")
