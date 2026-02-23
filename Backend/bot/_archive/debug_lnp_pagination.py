import os
import time
import re
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

def test_pagination():
    print("🚀 Pagination Testi Başlatılıyor...")
    options = uc.ChromeOptions()
    # options.add_argument("--headless")
    driver = uc.Chrome(options=options, version_main=144)
    
    try:
        url = "https://lightnovelpub.me/book/got-dropped-into-a-ghost-story-still-gotta-work"
        driver.get(url)
        print(f"🌐 Ana sayfa açıldı: {url}")
        time.sleep(5)
        
        all_links = []
        current_page = 1
        max_pages = 5 # Test için 5 sayfa yeterli
        
        base_url = url.rstrip('/')
        
        while current_page <= max_pages:
            print(f"📑 Sayfa {current_page} taranıyor...")
            items = driver.find_elements(By.CSS_SELECTOR, ".chapter-list li")
            if not items:
                items = driver.find_elements(By.CSS_SELECTOR, ".ul-list5 li")
            
            if not items:
                print(f"❌ Sayfa {current_page}'da bölüm bulunamadı.")
                break
                
            page_links = 0
            for item in items:
                try:
                    link = item.find_element(By.TAG_NAME, "a").get_attribute("href")
                    if link and not any(l['url'] == link for l in all_links):
                        # Bölüm numarasını çıkar
                        text = item.text
                        match = re.search(r"(\d+(\.\d+)?)", text)
                        num = float(match.group(1)) if match else 0
                        all_links.append({"num": num, "url": link})
                        page_links += 1
                except:
                    continue
            
            print(f"✅ Sayfa {current_page}: {page_links} yeni bölüm bulundu. (Toplam: {len(all_links)})")
            
            # Sayfalama kontrolü
            pagination = driver.find_elements(By.CSS_SELECTOR, ".page")
            if pagination:
                current_page += 1
                next_url = f"{base_url}/{current_page}"
                driver.get(next_url)
                time.sleep(3)
            else:
                print("🏁 Sayfalama bitti.")
                break
                
        print(f"\n🎉 TEST TAMAMLANDI!")
        print(f"📊 Toplam bulunan bölüm sayısı: {len(all_links)}")
        if len(all_links) > 50:
            print("🚀 BAŞARILI: Sayfalama çalışıyor, 46'dan fazla bölüm bulundu.")
        else:
            print("⚠️ UYARI: Hala az bölüm bulundu. Sitede gerçekten az olabilir mi?")
            
    except Exception as e:
        print(f"❌ Hata: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    test_pagination()
