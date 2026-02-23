import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By

# 👇 SORUNLU OLAN BİR BÖLÜMÜN LİNKİNİ BURAYA YAPIŞTIR
TEST_URL = "https://mangakusu.com/bir-savunma-oyununun-tirani-oldum-bolum-1/"

def xray_scan():
    print("🌍 Tarayıcı açılıyor...")
    options = uc.ChromeOptions()
    driver = uc.Chrome(options=options)
    
    try:
        driver.get(TEST_URL)
        print("⏳ Sayfa yükleniyor (8sn)...")
        time.sleep(8)
        
        # Lazy load tetiklemek için aşağı kaydır
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight / 3);")
        time.sleep(2)

        print("\n🔎 --- RÖNTGEN BAŞLIYOR ---")
        
        # Sayfadaki BÜYÜK resimleri bulmaya çalış
        all_imgs = driver.find_elements(By.TAG_NAME, "img")
        print(f"📄 Sayfada toplam {len(all_imgs)} adet resim var.")
        
        found_count = 0
        for i, img in enumerate(all_imgs):
            try:
                # Küçük ikonları atla (Genişliği 300px'den büyük olanlara bak)
                width = img.size['width']
                height = img.size['height']
                
                if width > 300: # Bu bir manga sayfası olmalı
                    found_count += 1
                    parent = img.find_element(By.XPATH, "./..") # Bir üst kutusu
                    grandparent = img.find_element(By.XPATH, "./../..") # İki üst kutusu
                    
                    print(f"\n[{found_count}] POTANSİYEL MANGA SAYFASI:")
                    print(f"   📏 Boyut: {width}x{height}")
                    print(f"   📦 Ana Kutu (Parent): Tag={parent.tag_name} | Class='{parent.get_attribute('class')}' | ID='{parent.get_attribute('id')}'")
                    print(f"   📦 Büyük Kutu (Grandparent): Tag={grandparent.tag_name} | Class='{grandparent.get_attribute('class')}' | ID='{grandparent.get_attribute('id')}'")
                    print(f"   🔗 SRC: {img.get_attribute('src')}")
                    print(f"   🔗 DATA-SRC: {img.get_attribute('data-src')}")
                    
                    if found_count >= 3: break # İlk 3 tanesi yeterli
            except: continue
            
        if found_count == 0:
            print("❌ HATA: Hiç büyük resim bulunamadı. (Canvas veya Shadow DOM olabilir)")

    except Exception as e:
        print(f"Hata: {e}")
    finally:
        driver.quit()

if __name__ == "__main__":
    xray_scan()