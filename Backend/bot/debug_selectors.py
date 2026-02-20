


from selenium import webdriver
from selenium.webdriver.common.by import By
import undetected_chromedriver as uc
import time

def check(url):
    print(f"Checking URL: {url}")
    options = uc.ChromeOptions()
    options.add_argument("--window-size=1920,1080")
    # options.add_argument("--headless=new") 
    
    # FIX: use_subprocess=True for Windows WinError 6
    driver = uc.Chrome(options=options, use_subprocess=True)
    
    try:
        driver.get(url)
        time.sleep(15) # Wait for Cloudflare


        
        selectors = [
            # LightNovelPub
            "ul.chapter-list li a",
            ".ul-list5 li a",
            # Novelight
            ".list-chapter li a",
            "ul.chapter-list a",
            "#chapter-list a"
        ]
        
        found = False
        for sel in selectors:
            try:
                elems = driver.find_elements(By.CSS_SELECTOR, sel)
                if elems:
                    print(f"✅ Selector FOUND: '{sel}' - Count: {len(elems)}")
                    print(f"   Sample: {elems[0].get_attribute('href')}")
                    found = True
            except:
                pass
                
        if not found:
            print("❌ No selectors worked!")
            print("Page Title:", driver.title)
            print("Page Source Sample:", driver.page_source[:500])
            with open("debug_page_source.html", "w", encoding="utf-8") as f:
                f.write(driver.page_source)
            print("Full page source saved to debug_page_source.html")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    check("https://lightnovelpub.me/novel/shadow-slave-19072354")
    check("https://novelight.net/series/got-dropped-into-a-ghost-story-still-gotta-work/")
