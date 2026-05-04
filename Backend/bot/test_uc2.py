import time
import undetected_chromedriver as uc

options = uc.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-gpu")
options.add_argument("--disable-extensions")
options.add_argument("--window-size=1280,900")
options.add_argument("--disable-blink-features=AutomationControlled")

print("Starting uc...")
try:
    driver = uc.Chrome(options=options, version_main=147)
    print("Fetching chapter URL...")
    driver.get("https://manga-tr.com/id-47111-read-nan-hao-shang-feng-chapter-2.html")
    time.sleep(8)
    
    with open("page_source.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)
        
    print("Page source saved to page_source.html")
    
    total_pages = driver.execute_script(
        "var sel = document.querySelector('select');"
        "if (sel && sel.options.length > 1) return sel.options.length;"
        "return 0;"
    ) or 0
    print(f"Total pages (select): {total_pages}")
    
    if total_pages < 1:
        total_pages = driver.execute_script(
            "var inp = document.querySelector('input[type=\"number\"]');"
            "if (inp && inp.max) return parseInt(inp.max);"
            "return 0;"
        ) or 0
        print(f"Total pages (input): {total_pages}")

    # Fallback Tümü testi:
    urls = driver.execute_script(
        "var result = [];"
        "document.querySelectorAll('img').forEach(function(img) {"
        "  var src = img.getAttribute('data-src') || img.getAttribute('data-original') || img.src || '';"
        "  result.push(src);"
        "});"
        "return result;"
    )
    print(f"All images: {urls}")

except Exception as e:
    print(f"Error: {e}")
finally:
    try:
        driver.quit()
    except:
        pass
