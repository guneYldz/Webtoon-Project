import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
import sys

def verify_lnp():
    print("Verifying LightNovelPub...", flush=True)
    options = uc.ChromeOptions()
    options.add_argument("--start-maximized")
    driver = uc.Chrome(options=options, version_main=144)
    
    try:
        url = "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work/chapter-11"
        print(f"Opening {url}", flush=True)
        driver.get(url)
        
        print("Waiting 10 seconds...", flush=True)
        time.sleep(10)
        
        # Dump HTML
        with open("lnp_debug.html", "w", encoding="utf-8") as f:
            f.write(driver.page_source)
            
        print("HTML Dumped.", flush=True)
        
        # Try generic selector
        selectors = ["#chapter-container", ".chapter-content", ".text-left", "div.chapter"]
        found = False
        for sel in selectors:
            try:
                elem = driver.find_element(By.CSS_SELECTOR, sel)
                text = elem.text
                if len(text) > 100:
                    print(f"SUCCESS: Found content with '{sel}'! Length: {len(text)}", flush=True)
                    print(f"Snippet: {text[:100]}", flush=True)
                    found = True
                    break
            except:
                pass
                
        if not found:
            print("FAILED: No content found with standard selectors.", flush=True)

    except Exception as e:
        print(f"Error: {e}", flush=True)
    finally:
        driver.quit()

if __name__ == "__main__":
    verify_lnp()
