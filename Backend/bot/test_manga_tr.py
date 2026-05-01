import time
import undetected_chromedriver as uc
from selenium.webdriver.chrome.options import Options

options = Options()
# options.add_argument("--headless") # Bize gorsel lazim gormek icin
driver = uc.Chrome(options=options)
driver.get("https://manga-tr.com/id-181988-read-nan-hao-shang-feng-chapter-2.html")
time.sleep(10)

# Check all images container
with open("dom_dump.html", "w", encoding="utf-8") as f:
    f.write(driver.page_source)

imgs = driver.execute_script("""
return Array.from(document.querySelectorAll('img')).map(img => {
    return {
        src: img.src || img.getAttribute('data-src'),
        width: img.naturalWidth,
        height: img.naturalHeight,
        clientHeight: img.clientHeight,
        display: window.getComputedStyle(img).display
    };
});
""")

import json
print("IMG TAGS:")
for i in imgs:
    if i['src'] and "img_part" in str(i['src']).lower():
         print(json.dumps(i))
         
print("\nCANVAS TAGS:")
canvas = driver.execute_script("return document.querySelectorAll('canvas').length;")
print(f"Canvas count: {canvas}")

driver.quit()
