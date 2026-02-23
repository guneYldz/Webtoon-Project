import requests

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

urls = {
    "novelight_chapter": "https://novelight.net/book/chapter/289803",
    "lightnovelpub_chapter": "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work/chapter-11"
}

for name, url in urls.items():
    try:
        print(f"Fetching {name}...")
        response = requests.get(url, headers=headers, timeout=15)
        if response.status_code == 200:
            with open(f"{name}_home.html", "w", encoding="utf-8") as f:
                f.write(response.text)
            print(f"Saved {name}_home.html")
        else:
            print(f"Failed {name}: {response.status_code}")
    except Exception as e:
        print(f"Error {name}: {e}")
