import requests
from bs4 import BeautifulSoup
from google import genai
import time
import os
import itertools
from dotenv import load_dotenv
import cloudscraper

# ==========================================
# ⚙️ AYARLAR VE YAPILANDIRMA
# ==========================================
load_dotenv()

# 4 API Key Rotasyonu
GOOGLE_API_KEYS = [
    k for k in [
        os.getenv("GOOGLE_API_KEY"),
        os.getenv("GOOGLE_API_KEY_2"),
        os.getenv("GOOGLE_API_KEY_3"),
        os.getenv("GOOGLE_API_KEY_4"),
        os.getenv("GOOGLE_API_KEY_5"),
        os.getenv("GOOGLE_API_KEY_6"),
        os.getenv("GOOGLE_API_KEY_7")

    ] if k
]

_current_key_index = 0

def get_gemini_client():
    return genai.Client(api_key=GOOGLE_API_KEYS[_current_key_index])

def rotate_key():
    global _current_key_index
    _current_key_index = (_current_key_index + 1) % len(GOOGLE_API_KEYS)
    print(f"🔄 API Key rotasyonu: Key #{_current_key_index + 1} aktif")

client = get_gemini_client() if GOOGLE_API_KEYS else None

# LOCALHOST AYARI: Docker'ın dışarı açtığı porta bağlanıyoruz.
API_URL = "http://127.0.0.1:8000"

BOT_USERNAME = os.getenv("BOT_USERNAME", "gunyz.62@gmail.com")
BOT_PASSWORD = os.getenv("BOT_PASSWORD", "62dersim62")
BEKLEME_SURESI = 15

# SERİYE ÖZEL AYARLAR (Config Yapısı)
NOVEL_CONFIGS = {
    "Shadow Slave": """
        1. "Nightmare Spell" -> "Kabus Büyüsü"
        2. "First Trial" -> "İlk Sınav"
        3. "Aspirant" -> "Aday"
        4. "Awakened" -> "Uyanmış"
        5. "Sleeper" -> "Uyuyan"
        6. "Sunny" -> "Sunny", "Nephis" -> "Nephis"
        7. "Legacy" -> "Miras"
        8. "Aspect" -> "Veçhe"
        9. "Memory" -> "Anı"
        10. "Echo" -> "Yankı"
    """,
    "Ghost Story": """
        1. "Ghost Story" -> "Hayalet Hikayesi"
        2. "Entity" -> "Varlık" (Eğer korkutucu bir tondaysa "Ucube" de kullanılabilir)
        3. "Cursed" -> "Lanetli"
        4. "Talisman" -> "Tılsım"
        5. "Exorcist" -> "Ruh Kovucu"
        6. "Evil Spirit" -> "Kötücül Ruh"
        7. "Eerie" -> "Ürkütücü / Tekin olmayan"
        8. "Haunted" -> "Perili / Musallatlı"
        9. "System" -> "Sistem"
        10. "Still gotta work" -> "Hâlâ çalışmak lazım" (Serinin ironik tonunu koru)
        11. Karakter adlarını (varsa özel isimler) ASLA çevirme.
        12. Ton: Gerilimli ama ana karakterin işine bağlılığını hissettiren, hafif absürt ve edebi bir dil.
    """,
    "default": """
        1. Özel isimleri (Karakter adları, şehir adları) ASLA çevirme.
        2. Büyü isimlerini mümkünse Türkçe karşılığıyla, parantez içinde İngilizcesi olacak şekilde çevir.
        3. Ton: Edebi, akıcı ve romanın türüne uygun.
    """,
}

# ==========================================
# 🔑 YARDIMCI FONKSİYONLAR
# ==========================================
def get_auth_token():
    try:
        response = requests.post(f"{API_URL}/auth/giris-yap", data={"username": BOT_USERNAME, "password": BOT_PASSWORD})
        if response.status_code == 200:
            print("✅ Giriş Başarılı! Token alındı.")
            return response.json().get("access_token")
        else:
            print(f"❌ Giriş Reddedildi! Kod: {response.status_code} | Hata: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Sunucuya Bağlanılamadı (Local API): {e}")
        return None

def get_last_chapter_number(token, novel_id, novel_slug):
    headers = {"Authorization": f"Bearer {token}"}
    for identifier in [novel_id, novel_slug]:
        try:
            res = requests.get(f"{API_URL}/novels/{identifier}", headers=headers)
            if res.status_code == 200:
                chapters = res.json().get("chapters", [])
                return max([ch["chapter_number"] for ch in chapters]) if chapters else 0
        except: continue
    return 0

def get_all_novels(token):
    headers = {"Authorization": f"Bearer {token}"}
    try:
        res = requests.get(f"{API_URL}/novels/", headers=headers)
        if res.status_code == 200:
            return res.json()
        else:
            print(f"❌ Romanlar çekilemedi! Sunucu Kod: {res.status_code}")
            return []
    except Exception as e:
        print(f"❌ Roman API'sine bağlanırken hata: {e}")
        return []

# ==========================================
# 🕷️ SCRAPER
# ==========================================
def scrape_chapter(url, current_ch_num): # Parametreye current_ch_num ekledik
    print(f"   🌍 Kaynak taranıyor: {url}")
    scraper = cloudscraper.create_scraper()
    try:
        response = scraper.get(url, timeout=10)
        if response.status_code != 200: return None, None

        soup = BeautifulSoup(response.text, 'html.parser')
        title_tag = soup.find('h1') or soup.find('span', class_='title__')

        content = soup.find('div', class_='txt') or soup.find('div', id='content')

        if content:
            for bad in content.find_all(['script', 'style', 'iframe', 'a']):
                bad.decompose()

            # --- BAŞLIK TEMİZLİĞİ BAŞLIYOR ---
            clean_title = f"Bölüm {current_ch_num}" # Varsayılan ve en temiz halimiz

            if title_tag:
                raw_title = title_tag.get_text(strip=True)
                # Eğer orjinal başlıkta özel bir isim varsa (örn: Chapter 1 - The Beginning) o kısmı da alabiliriz.
                # Ama en garanti ve sade olanı sadece "Bölüm X" olarak zorlamaktır.
                # Eğer roman ismini içeriyorsa, onu kesinlikle atıyoruz.
                if "-" in raw_title:
                    extra_name = raw_title.split("-", 1)[1].strip()
                    clean_title = f"Bölüm {current_ch_num} - {extra_name}"
            # --- BAŞLIK TEMİZLİĞİ BİTTİ ---

            return clean_title, content.get_text(separator="\n\n").strip()
        return None, None
    except Exception as e:
        print(f"   ❌ Scraping Hatası: {e}")
        return None, None
# ==========================================
# 🤖 ÇEVİRİ VE YÜKLEME
# ==========================================
def translate_and_upload(token, novel, chapter_num, eng_title, eng_text):
    global client

    if not client:
        print("❌ HATA: Gemini client başlatılamadı!")
        return "ERROR"

    novel_key = "default"
    if "Shadow Slave" in novel['title']: novel_key = "Shadow Slave"
    elif "Ghost Story" in novel['title']: novel_key = "Ghost Story"

    config = NOVEL_CONFIGS[novel_key]

    print(f"   🤖 AI ({novel_key}) Çeviriyor... (Key: {GOOGLE_API_KEYS[_current_key_index][:5]}...)")

    prompt = f"""
    Sen profesyonel bir roman çevirmenisin. GÖREVİN: Aşağıdaki metni Türkçeye çevirmek.

    KURALLAR:
    1. ASLA 'Elbette', 'İşte çeviri' gibi giriş cümleleri yazma.
    2. SADECE romanın metnini döndür.
    3. Çeviride şu talimatları uygula:
{config}

    METİN:
    {eng_text[:8000]}
    """

    max_cycles = 3
    for cycle in range(max_cycles):
        for key_attempt in range(len(GOOGLE_API_KEYS)):
            try:
                client = get_gemini_client()
                response = client.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt
                )
                ceviri = response.text.strip()

                if ceviri.startswith(("Elbette", "İşte", "Çeviri:", "Tabii")):
                    ceviri = "\n".join(ceviri.split("\n")[1:])

                payload = {"novel_id": novel['id'], "chapter_number": chapter_num, "title": eng_title, "content": ceviri}
                headers = {"Authorization": f"Bearer {token}"}
                res = requests.post(f"{API_URL}/novels/bolum-ekle", data=payload, headers=headers)

                if res.status_code in [200, 201]:
                    print(f"   🎉 Bölüm {chapter_num} BAŞARIYLA KAYDEDİLDİ!")
                    return "SUCCESS"
                elif res.status_code == 400 and "mevcut" in res.text:
                    return "SKIP"
                else:
                    print(f"   ❌ Kayıt Hatası: {res.status_code} - {res.text}")
                    return "ERROR"

            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    print(f"⚠️ Rate limit (429) - Key #{_current_key_index + 1} doldu, sonraki key'e geçiliyor...")
                    rotate_key()
                else:
                    print(f"   ❌ API Hatası: {e}")
                    return "ERROR"

        wait_secs = 65
        print(f"⏳ Tüm key'ler ({len(GOOGLE_API_KEYS)}) rate limit'e çarptı. {wait_secs}sn bekleniyor... (Döngü {cycle+1}/{max_cycles})")
        time.sleep(wait_secs)

    print("❌ Tüm denemeler başarısız. Tüm API hakları bitmiş olabilir. Bot 1 SAAT (3600 sn) uykuya geçiyor...")
    time.sleep(3600)  # 1 saat bekler
    return "ERROR"    # ERROR döndürüldüğü için döngü kırılır ve bölüm kaydedilmez

# ==========================================
# 🏭 ANA DÖNGÜ
# ==========================================
if __name__ == "__main__":
    print("🚀 KAOS BOT YEREL TEST MODU BAŞLATILDI")

    while True:
        token = get_auth_token()
        if token:
            novels = get_all_novels(token)
            print(f"📚 Veritabanından toplam {len(novels)} roman okundu.")

            KAOS_DOMAINS = ["freewebnovel.com"]
            active_novels = [
                n for n in novels
                if n.get('source_url') and any(d in n['source_url'] for d in KAOS_DOMAINS)
            ]
            print(f"🎯 Freewebnovel şartına uyan roman sayısı: {len(active_novels)}")

            if len(active_novels) == 0:
                print("⚠️ İşlem yapılacak uygun roman bulunamadı. Belki veritabanında 'source_url' kısmı boştur veya freewebnovel içermiyordur.")

            for novel in active_novels:
                print(f"\n🔹 KONTROL: {novel['title']}")
                last_ch = get_last_chapter_number(token, novel['id'], novel['slug'])
                current_ch = int(last_ch) + 1

                while True:
                    target_url = novel['source_url'].format(current_ch)
                    eng_title, eng_text = scrape_chapter(target_url, current_ch)

                    if not eng_text:
                        print(f"   ⚠️ {current_ch}. Bölüm bulunamadı veya çekilemedi, seriyi atlıyorum.")
                        break

                    status = translate_and_upload(token, novel, current_ch, eng_title, eng_text)
                    if status in ["SUCCESS", "SKIP"]:
                        current_ch += 1
                        time.sleep(5)
                    else: break

        print(f"\n💤 Bekleme modu ({BEKLEME_SURESI}sn)...")
        time.sleep(BEKLEME_SURESI)