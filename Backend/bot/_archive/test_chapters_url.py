import requests
from bs4 import BeautifulSoup

url = "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work/chapters"
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

print(f"📡 Testing: {url}")
try:
    resp = requests.get(url, headers=headers, timeout=15)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        soup = BeautifulSoup(resp.text, 'html.parser')
        chapters = soup.select(".chapter-list li")
        print(f"Found {len(chapters)} chapters on /chapters")
        if chapters:
            print(f"First: {chapters[0].text.strip()}")
            print(f"Last: {chapters[-1].text.strip()}")
            
        pagination = soup.select(".page")
        print(f"Pagination elements: {len(pagination)}")
        
        # Test page 2 of chapters
        p2_url = f"{url}/page-2"
        print(f"📡 Testing P2: {p2_url}")
        resp2 = requests.get(p2_url, headers=headers, timeout=15)
        print(f"P2 Status: {resp2.status_code}")
        if resp2.status_code == 200:
            soup2 = BeautifulSoup(resp2.text, 'html.parser')
            chapters2 = soup2.select(".chapter-list li")
            print(f"Found {len(chapters2)} chapters on /chapters/page-2")
except Exception as e:
    print(f"Error: {e}")
