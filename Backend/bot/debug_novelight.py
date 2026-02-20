import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
import sys

def debug():
    print("Debugging Novelight...", flush=True)
    options = uc.ChromeOptions()
    options.add_argument("--start-maximized")
    # Using version_main=144 as per existing code
    driver = uc.Chrome(options=options, version_main=144)
    
    try:
        url = "https://novelight.net/book/shadow-slave-novel"
        print(f"Opening Book Page: {url}", flush=True)
        driver.get(url)
        time.sleep(5)
        
        # Click Show All if exists
        try:
             show_all = driver.find_element(By.CSS_SELECTOR, "#show-all-chapters")
             driver.execute_script("arguments[0].click();", show_all)
             print("Clicked Show All", flush=True)
             time.sleep(3)
        except:
             pass

        # Find first chapter
        chapters = driver.find_elements(By.CSS_SELECTOR, ".chapters .chapter")
        if chapters:
            print(f"Found {len(chapters)} chapters. Clicking first...", flush=True)
            # Scroll to element to ensure it's clickable
            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", chapters[0])
            time.sleep(1)
            try:
                chapters[0].click()
                print("Clicked chapter element", flush=True)
            except:
                print("Click failed, trying JS click...", flush=True)
                driver.execute_script("arguments[0].click();", chapters[0])
            
            print("Waiting 10 seconds...", flush=True)
            time.sleep(10)
            
            # Dump HTML
            html = driver.page_source
            with open("novelight_debug_chapter.html", "w", encoding="utf-8") as f:
                f.write(html)
            print("Dumped Chapter HTML", flush=True)
            
            # Content Analysis
            elements = driver.find_elements(By.TAG_NAME, "div")
            best_elem = None
            max_len = 0
            
            for elem in elements:
                try:
                    text = elem.text
                    if len(text) > max_len and len(text) < 20000:
                        l = len(text)
                        if l > 100:
                             print(f"Candidate: {elem.get_attribute('class')} | Len: {l}", flush=True)
                        max_len = l
                        best_elem = elem
                except:
                    pass
            
            if best_elem:
                print(f"Best Candidate: {best_elem.get_attribute('class')} | ID: {best_elem.get_attribute('id')}", flush=True)
                print(f"Snippet: {best_elem.text[:100]}", flush=True)
        else:
            print("No chapters found!", flush=True)

    except Exception as e:
        print(f"Error: {e}", flush=True)
    finally:
        try:
            driver.quit()
        except:
            pass

if __name__ == "__main__":
    debug()
