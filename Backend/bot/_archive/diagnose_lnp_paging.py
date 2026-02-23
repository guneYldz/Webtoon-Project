import time
import re
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

def diagnostic():
    options = uc.ChromeOptions()
    # options.add_argument("--headless")
    driver = uc.Chrome(options=options)
    
    try:
        url = "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work"
        print(f"🔍 Inspecting: {url}")
        driver.get(url)
        time.sleep(10)
        
        # Check current page chapters
        chapters = driver.find_elements(By.CSS_SELECTOR, ".chapter-list li")
        print(f"📄 Page 1: Found {len(chapters)} chapters")
        if chapters:
            print(f"First chapter on Page 1: {chapters[0].text.strip()}")
            print(f"Last chapter on Page 1: {chapters[-1].text.strip()}")
            
        # Check pagination
        pagination = driver.find_elements(By.CSS_SELECTOR, ".page")
        print(f"🔗 Pagination elements found: {len(pagination)}")
        
        # Try Page 2
        page2_url = f"{url}/2"
        print(f"📄 Navigating to Page 2: {page2_url}")
        driver.get(page2_url)
        time.sleep(10)
        
        chapters_p2 = driver.find_elements(By.CSS_SELECTOR, ".chapter-list li")
        print(f"📄 Page 2: Found {len(chapters_p2)} chapters")
        if chapters_p2:
            print(f"First chapter on Page 2: {chapters_p2[0].text.strip()}")
            print(f"Last chapter on Page 2: {chapters_p2[-1].text.strip()}")
            
        # Dump source for page 2
        with open("lnp_page2_debug.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
            
    finally:
        driver.quit()

if __name__ == "__main__":
    diagnostic()
