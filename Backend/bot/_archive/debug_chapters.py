"""
LNP bölüm listesi debug scripti.
.ul-list5 li içindeki link ve text bilgilerini gösterir.
"""
import time
import re
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options

URL = "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work"

options = Options()
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_experimental_option("excludeSwitches", ["enable-logging"])

driver = webdriver.Chrome(options=options)
try:
    driver.get(URL)
    time.sleep(8)
    
    items = driver.find_elements(By.CSS_SELECTOR, ".ul-list5 li")
    print(f"✅ {len(items)} item bulundu")
    
    for i, item in enumerate(items[:5]):  # İlk 5 item'ı göster
        try:
            link_el = item.find_element(By.CSS_SELECTOR, "a")
            link = link_el.get_attribute("href")
            raw_text = item.text.strip()
            text_content = link_el.get_attribute("textContent").strip()
            print(f"\n--- Item {i+1} ---")
            print(f"  HREF: {link}")
            print(f"  item.text: '{raw_text}'")
            print(f"  a.textContent: '{text_content}'")
            match = re.search(r"(\d+(\.\d+)?)", raw_text or text_content)
            print(f"  Regex match: {match.group(1) if match else 'YOK!'}")
        except Exception as e:
            print(f"  EXCEPTION: {e}")
finally:
    driver.quit()
