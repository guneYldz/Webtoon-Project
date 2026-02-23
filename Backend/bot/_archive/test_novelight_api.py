import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Referer': 'https://novelight.net/book/shadow-slave-novel',
    'X-Requested-With': 'XMLHttpRequest'
}

base_url = "https://novelight.net"
chapter_id = "289803" # From HTML
book_slug = "shadow-slave-novel"

endpoints = [
    f"/book/ajax/read-chapter/{chapter_id}",
]

for ep in endpoints:
    url = base_url + ep
    print(f"Trying {url}...")
    try:
        resp = requests.get(url, headers=headers, timeout=5)
        print(f"Status: {resp.status_code}, Len: {len(resp.text)}")
        if resp.status_code == 200 and len(resp.text) > 100:
            print(f"POSSIBLE MATCH! Snippet: {resp.text[:200]}")
    except Exception as e:
        print(f"Error: {e}")
