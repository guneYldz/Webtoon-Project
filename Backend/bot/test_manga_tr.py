import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import sys

options = Options()
options.add_argument('--headless')
driver = webdriver.Chrome(options=options)

try:
    print("Fetching page...")
    driver.get("https://manga-tr.com/id-47111-read-nan-hao-shang-feng-chapter-2.html")
    time.sleep(5)
    print(driver.page_source[:2000])
except Exception as e:
    print(f"Error: {e}")
finally:
    driver.quit()
