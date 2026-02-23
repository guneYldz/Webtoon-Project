import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

options = uc.ChromeOptions()
options.add_argument("--headless")
driver = uc.Chrome(options=options)

try:
    url = "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work/chapters"
    print(f"📡 Navigating to: {url}")
    driver.get(url)
    time.sleep(15)
    
    pagination = driver.find_elements(By.CSS_SELECTOR, ".page, .pagination, .paging, [class*='page']")
    for p in pagination:
        print(f"Found element: {p.get_attribute('class')}")
        print(p.get_attribute('outerHTML'))
        
    # Also dump all links in pagination
    links = driver.find_elements(By.CSS_SELECTOR, ".page a, .pagination a")
    for l in links:
        print(f"Link: {l.text} -> {l.get_attribute('href')} (Class: {l.get_attribute('class')}, Title: {l.get_attribute('title')})")

finally:
    driver.quit()
