import os
import time
import re
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

def test_pagination():
    print("START_TEST")
    options = uc.ChromeOptions()
    # options.add_argument("--headless")
    driver = uc.Chrome(options=options, version_main=144)
    
    try:
        url = "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work"
        driver.get(url)
        time.sleep(5)
        
        all_links = []
        current_page = 1
        max_pages = 3
        
        base_url = url.rstrip('/')
        
        while current_page <= max_pages:
            items = driver.find_elements(By.CSS_SELECTOR, ".chapter-list li")
            if not items:
                items = driver.find_elements(By.CSS_SELECTOR, ".ul-list5 li")
            
            page_links = 0
            for item in items:
                try:
                    link = item.find_element(By.TAG_NAME, "a").get_attribute("href")
                    if link and not any(l['url'] == link for l in all_links):
                        all_links.append({"url": link})
                        page_links += 1
                except: continue
            
            print(f"PAGE_{current_page}_FOUND_{page_links}_TOTAL_{len(all_links)}")
            
            pagination = driver.find_elements(By.CSS_SELECTOR, ".page")
            if pagination and current_page < max_pages:
                current_page += 1
                next_url = f"{base_url}/{current_page}"
                driver.get(next_url)
                time.sleep(3)
            else:
                break
                
        print(f"FINAL_TOTAL_{len(all_links)}")
        if len(all_links) > 50:
            print("SUCCESS")
        else:
            print("FAILURE_LOW_COUNT")
            
    except Exception as e:
        print(f"ERROR_{str(e)}")
    finally:
        driver.quit()

if __name__ == "__main__":
    test_pagination()
