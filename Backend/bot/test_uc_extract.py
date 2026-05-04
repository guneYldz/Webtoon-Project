import time
import undetected_chromedriver as uc
from io import BytesIO

options = uc.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--disable-gpu")
options.add_argument("--window-size=1280,900")
options.add_argument("--disable-blink-features=AutomationControlled")

try:
    driver = uc.Chrome(options=options, version_main=147)
    url = "https://manga-tr.com/id-47111-read-nan-hao-shang-feng-chapter-2.html"
    print(f"Loading {url}...")
    driver.get(url)
    time.sleep(10)
    
    # Check if we are in 'Tümü' or 'Sayfadan Sayfaya' mode
    # Try to switch to Sayfadan Sayfaya
    clicked = driver.execute_script(
        "var btns = Array.from(document.querySelectorAll('button, a, div'));"
        "var target = btns.find(function(b) {"
        "  var t = b.textContent.trim();"
        "  return t === 'Sayfadan Sayfaya' || t.toLowerCase().includes('sayfa');"
        "});"
        "if (target) { target.click(); return true; }"
        "return false;"
    )
    print(f"Switched to Sayfadan Sayfaya: {clicked}")
    time.sleep(3)
    
    total_pages = driver.execute_script(
        "var sel = document.querySelector('select');"
        "if (sel && sel.options.length > 1) return sel.options.length;"
        "var inp = document.querySelector('input[type=\"number\"]');"
        "if (inp && inp.max) return parseInt(inp.max);"
        "return 0;"
    )
    print(f"Total Pages detected: {total_pages}")

    # Fallback to Tümü
    if total_pages == 0:
        print("Falling back to scrolling and collecting parts...")
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(3)
        driver.execute_script("window.scrollTo(0, 0);")
        time.sleep(2)
        
        pages = driver.execute_script(
            "return Array.from(document.querySelectorAll('.chapter-page')).map(el => {"
            "  var c = el.querySelector('canvas');"
            "  var img = el.querySelector('img');"
            "  return {"
            "    has_canvas: !!c,"
            "    has_img: !!img,"
            "    parts: el.getAttribute('data-parts')"
            "  };"
            "});"
        )
        print(f"Chapter pages: {len(pages)}")
        for i, p in enumerate(pages):
            print(f"Page {i}: {p}")

except Exception as e:
    print(f"Error: {e}")
finally:
    try:
        driver.quit()
    except:
        pass
