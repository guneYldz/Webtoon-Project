# Dosya: bot/scraper.py
import requests
# BeautifulSoup kütüphanesini kurmalısın: pip install beautifulsoup4 requests

def fetch_latest_chapters(source_url):
    """
    Verilen URL'e gider ve oradaki bölümleri listeler.
    Dönüş: [{'no': 101, 'link': '...'}, {'no': 102, 'link': '...'}] gibi bir liste döner.
    """
    # NOT: Burası örnek. Her sitenin HTML yapısı farklıdır.
    # Gerçek projede BeautifulSoup ile HTML'i parçalaman lazım.
    
    print(f"📡 Siteye gidiliyor: {source_url}")
    
    # Simülasyon yapıyorum: Diyelim ki siteden veriyi çektik
    # Gerçekte burada requests.get() ve soup.find() olacak.
    sitedeki_bolumler = [
        {"episode_number": 100, "url": "http://site.com/bolum-100"},
        {"episode_number": 101, "url": "http://site.com/bolum-101"}, # Yeni bölüm
    ]
    
    return sitedeki_bolumler

def download_chapter_images(chapter_url):
    """
    Bölüm linkine girer ve resim linklerini bulur.
    """
    print(f"   📥 Resimler indiriliyor: {chapter_url}")
    # Burada resimleri indirip sunucuna/S3'e yükleme kodu olur.
    # Şimdilik örnek liste dönüyoruz:
    return ["resim1.jpg", "resim2.jpg"]