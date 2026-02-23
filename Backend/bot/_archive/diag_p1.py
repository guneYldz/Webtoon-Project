import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

options = uc.ChromeOptions()
options.add_argument("--headless")
driver = uc.Chrome(options=options)

try:
    url = "https://novellive.app/book/got-dropped-into-a-ghost-story-still-gotta-work/1"
    print(f"📡 Navigating to Page 1: {url}")
    driver.get(url)
    time.sleep(15)
    
    items = driver.find_elements(By.CSS_SELECTOR, ".ul-list5 li")
    print(f"Found {len(items)} items on Page 1")
    for i in items:
        print(f"Item Text: {i.text.strip()}")
        try:
            link = i.find_element(By.TAG_NAME, "a").get_attribute("href")
            print(f"Link: {link}")
        except:
            print("No link found")

    with open("lnp_page1_diagnostic.html", "w", encoding="utf-8") as f:
        f.write(driver.page_source)

finally:
    driver.quit()
