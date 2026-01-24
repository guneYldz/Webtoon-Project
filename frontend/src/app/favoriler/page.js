"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API } from "@/api"; // Süslü parantezleri kaldırdık // API adresin (http://127.0.0.1:8000)

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  // Verileri Çekme Fonksiyonu
  useEffect(() => {
    const fetchFavorites = async () => {
      const token = localStorage.getItem("token");
      
      // Eğer giriş yapmamışsa login sayfasına at
      if (!token) {
          window.location.href = "/login"; 
          return;
      }

      try {
        const res = await fetch(`${API}/favorites/listele`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          setFavorites(data);
        }
      } catch (err) {
        console.error("Favoriler çekilemedi:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, []);

  // Yükleniyor Ekranı
  if (loading) return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-purple-400 gap-4">
        <div className="animate-spin text-4xl">⏳</div>
        <p className="animate-pulse tracking-widest uppercase text-sm font-bold">Favoriler Yükleniyor...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#121212] py-20 px-4 md:px-8 font-sans">
      <div className="container mx-auto max-w-7xl">
        
        {/* ÜST BAŞLIK ALANI */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-10 pb-6 border-b border-gray-800 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-white flex items-center gap-3">
            <span className="text-red-500 drop-shadow-lg">❤️</span> 
            <span>Favori Serilerim</span>
          </h1>
          
          <div className="bg-[#1e1e1e] border border-gray-700 px-4 py-2 rounded-full text-gray-300 text-sm font-medium">
            Toplam <span className="text-white font-bold ml-1">{favorites.length}</span> Seri Takipte
          </div>
        </div>

        {/* LİSTELEME ALANI */}
        {favorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
            {favorites.map((fav, index) => (
              <Link 
                key={index} 
                href={fav.slug || "#"} // Backend'den gelen hazır link (/novel/slug veya /webtoon/id)
                className="group relative block bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg border border-gray-800 hover:border-purple-500/50 hover:shadow-purple-900/20 transition-all duration-300 hover:-translate-y-1"
              >
                {/* Kapak Resmi */}
                <div className="aspect-[3/4] overflow-hidden relative">
                  <img 
                    src={`${API}/${fav.resim}`} 
                    alt={fav.baslik} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  
                  {/* Tür Etiketi (Sağ Üst) */}
                  <div className={`absolute top-2 right-2 px-2 py-1 rounded text-[10px] font-bold text-white uppercase tracking-wider border border-white/10 shadow-sm
                    ${fav.type === 'novel' ? 'bg-purple-600/90' : 'bg-blue-600/90'}`}>
                    {fav.type === 'novel' ? 'Novel' : 'Webtoon'}
                  </div>
                  
                  {/* Hover Efekti (Karartı) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />
                </div>

                {/* Alt Bilgi */}
                <div className="absolute bottom-0 left-0 w-full p-3">
                  <h3 className="text-white font-bold text-sm leading-tight line-clamp-2 group-hover:text-purple-400 transition-colors">
                    {fav.baslik}
                  </h3>
                  <div className="mt-2 text-[10px] text-gray-400 font-medium uppercase tracking-wider group-hover:text-white transition-colors flex items-center gap-1">
                     Okumaya Devam Et <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          /* BOŞ DURUM (HİÇ FAVORİ YOKSA) */
          <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-800 rounded-3xl bg-[#1a1a1a]/50">
            <div className="text-7xl mb-6 grayscale opacity-30 animate-bounce">💔</div>
            <h2 className="text-2xl text-white font-bold mb-3">Henüz Favorin Yok</h2>
            <p className="text-gray-500 mb-8 max-w-md mx-auto">
              Beğendiğin Webtoon veya Novelleri favorilerine ekleyerek kütüphaneni oluşturmaya başla.
            </p>
            <Link 
                href="/" 
                className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-full font-bold hover:shadow-[0_0_20px_rgba(147,51,234,0.4)] transition-all transform hover:scale-105"
            >
              🔥 Serileri Keşfet
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}