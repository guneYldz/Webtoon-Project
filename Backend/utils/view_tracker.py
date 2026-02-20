from datetime import datetime, timedelta
import threading
from typing import Tuple


class ViewTracker:
    """
    IP tabanlı view count rate limiting sistemi.
    Aynı IP'nin belirli bir süre içinde aynı içeriği tekrar izlemesini engeller.
    """
    
    def __init__(self, ttl_seconds: int = 3600):
        """
        Args:
            ttl_seconds: View kaydının geçerli olacağı süre (saniye). Varsayılan 1 saat.
        """
        self.ttl = ttl_seconds
        self.views = {}  # {(ip, content_type, content_id): timestamp}
        self.lock = threading.Lock()
    
    def should_count_view(self, ip: str, content_type: str, content_id: int) -> bool:
        """
        Belirtilen IP'nin bu içerik için view sayılıp sayılmayacağını kontrol eder.
        
        Args:
            ip: Kullanıcının IP adresi
            content_type: İçerik tipi ("webtoon", "novel", "episode", "chapter")
            content_id: İçerik ID'si
            
        Returns:
            True: View sayılmalı (ilk kez veya TTL süresi geçmiş)
            False: View sayılmamalı (yakın zamanda sayılmış)
        """
        key = (ip, content_type, content_id)
        now = datetime.now()
        
        with self.lock:
            # Önce eski kayıtları temizle (memory optimization)
            self._cleanup_old_entries(now)
            
            # Bu IP bu içeriği son TTL süresi içinde izledi mi?
            if key in self.views:
                last_view = self.views[key]
                elapsed = (now - last_view).total_seconds()
                
                if elapsed < self.ttl:
                    # Süre dolmamış, sayma
                    return False
                else:
                    # Süre dolmuş, kayıt güncelle
                    self.views[key] = now
                    return True
            
            # İlk kez izleniyor, kaydet ve say
            self.views[key] = now
            return True
    
    def _cleanup_old_entries(self, now: datetime):
        """
        TTL süresi geçmiş eski kayıtları siler (memory leak önleme).
        
        Args:
            now: Şu anki zaman
        """
        expired_keys = [
            k for k, v in self.views.items()
            if (now - v).total_seconds() > self.ttl
        ]
        
        for k in expired_keys:
            del self.views[k]
    
    def get_stats(self) -> dict:
        """
        Debugging için istatistikler döndürür.
        
        Returns:
            Dict containing: total_entries, content_types_breakdown
        """
        with self.lock:
            total = len(self.views)
            breakdown = {}
            
            for (ip, content_type, content_id), timestamp in self.views.items():
                if content_type not in breakdown:
                    breakdown[content_type] = 0
                breakdown[content_type] += 1
            
            return {
                "total_entries": total,
                "content_types": breakdown,
                "ttl_seconds": self.ttl
            }


# ==========================================
# 🌐 GLOBAL INSTANCE
# ==========================================
# Uygulama genelinde tek bir instance kullanılır (singleton pattern)
view_tracker = ViewTracker(ttl_seconds=3600)  # 1 saat
