import undetected_chromedriver as uc
import time
import base64

def test():
    options = uc.ChromeOptions()
    options.add_argument("--headless=new")
    driver = uc.Chrome(options=options, version_main=147)
    
    url = "https://manga-tr.com/id-47109-read-nan-hao-shang-feng-chapter-1.html"
    print(f"Loading {url}")
    driver.get(url)
    time.sleep(5)
    
    parts = driver.execute_script("""
        var page = document.querySelectorAll('.chapter-page')[0];
        if (!page) return null;
        var parts = page.getAttribute('data-parts');
        if (!parts) return null;
        try {
            return JSON.parse(parts);
        } catch(e) {
            return null;
        }
    """)
    
    if not parts:
        print("No parts found")
        return
        
    print(f"Found {len(parts)} parts. Fetching the first one...")
    purl = parts[0]
    print(f"Part URL: {purl}")
    
    cookies = driver.get_cookies()
    session = __import__('requests').Session()
    for c in cookies:
        session.cookies.set(c['name'], c['value'])
        
    ua = driver.execute_script("return navigator.userAgent;")
    print(f"User Agent: {ua}")
    
    resp = session.get(purl, headers={'User-Agent': ua, 'Referer': url})
    print(f"Status Code: {resp.status_code}")
    if resp.status_code == 200:
        print(f"Data length: {len(resp.content)}")
    else:
        print(f"Failed. Text: {resp.text[:100]}")

    driver.quit()

if __name__ == "__main__":
    test()
