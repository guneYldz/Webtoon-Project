"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
// 👇 SENİN OLUŞTURDUĞUN BİLEŞENİ BURAYA ÇAĞIRIYORUZ
import FeaturedCard from "@/components/FeaturedSlider";

export default function Home() {
  const [webtoons, setWebtoons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featuredWebtoon, setFeaturedWebtoon] = useState(null);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/webtoons/")
      .then((res) => res.json())
      .then((data) => {
        setWebtoons(data);

        // 👇 VİTRİN MANTIĞI:
        // Eğer admin panelden 'is_featured' seçtiğin varsa onu al, yoksa listenin ilkini al.
        const vitrin = data.find(w => w.is_featured) || data[0];
        setFeaturedWebtoon(vitrin);

        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
    </div>
  );

  // Popüler Listesi (Sidebar için)
  const popularList = [...webtoons].sort((a, b) => b.view_count - a.view_count).slice(0, 10);
  // Güncel Seriler (Ana akış için ters sıralı)
  const latestUpdates = [...webtoons].reverse();

  return (
    <div className="min-h-screen font-sans bg-[#121212] pb-20">
      
      {/* --- ANA KAPSAYICI --- */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        
        {/* --- 1. YENİ HERO VİTRİN ALANI (Eski 3'lü yapının yerine) --- */}
        <div className="mb-12">
            {/* İşte futbolcu sahaya çıkıyor! 🏟️ */}
            <FeaturedCard webtoon={featuredWebtoon} />
        </div>

        {/* --- 2. ANA İÇERİK ve SIDEBAR --- */}
        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* SOL: GÜNCEL SERİLER */}
          <div className="flex-1 w-full">
            <div className="flex justify-between items-end mb-6 border-b border-gray-800 pb-3">
              <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-blue-600 rounded-full inline-block"></span> Güncel Seriler
              </h2>
              <Link href="/seriler" className="text-sm font-medium text-gray-500 hover:text-white transition">Tümünü Gör →</Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8">
              {latestUpdates.map((w) => (
                <div key={w.id} className="group flex flex-col gap-2">
                  {/* Kapak Resmi */}
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-gray-800 shadow-md group-hover:shadow-blue-900/20 group-hover:border-blue-500/50 transition duration-300">
                    <Link href={`/webtoon/${w.id}`}>
                      <img 
                        src={`http://127.0.0.1:8000/${w.cover_image}`} 
                        alt={w.title} 
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-110"
                      />
                    </Link>
                    <div className="absolute top-2 left-2">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm ${w.status === 'ongoing' ? 'bg-blue-600' : 'bg-red-600'}`}>
                          {w.status === 'ongoing' ? 'ONGOING' : 'TAMAMLANDI'}
                        </span>
                    </div>
                  </div>
                  
                  {/* Başlık ve Bölümler */}
                  <div>
                    <Link href={`/webtoon/${w.id}`}>
                      <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-blue-400 transition">
                        {w.title}
                      </h3>
                    </Link>
                    <div className="mt-2 space-y-1.5">
                      {/* Sahte bölüm verisi (İleride Backend'den gerçek bölümü çekeceğiz) */}
                      <div className="flex justify-between items-center text-xs text-gray-400 bg-[#1e1e1e] border border-gray-800 p-1.5 rounded hover:bg-[#2a2a2a] hover:text-white hover:border-gray-600 cursor-pointer transition">
                        <span>Son Bölüm</span>
                        <span className="text-[10px] text-gray-600">Yeni</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SAĞ: SIDEBAR (POPÜLER) */}
          <div className="w-full lg:w-80 flex-shrink-0">
              <div className="bg-[#1a1a1a] rounded-xl border border-gray-800 p-5 sticky top-24 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <span className="text-purple-500">🏆</span> En Popüler
                </h3>
                
                <div className="flex flex-col gap-5">
                  {popularList.map((w, index) => (
                    <Link key={w.id} href={`/webtoon/${w.id}`} className="flex gap-4 group items-center">
                      <div className={`text-3xl font-black italic w-8 flex-shrink-0 text-center ${index < 3 ? 'text-transparent bg-clip-text bg-gradient-to-b from-purple-400 to-purple-800' : 'text-gray-700'}`}>
                        {index + 1}
                      </div>
                      <div className="w-14 h-20 rounded-md overflow-hidden flex-shrink-0 border border-gray-800 group-hover:border-purple-500 transition">
                        <img src={`http://127.0.0.1:8000/${w.cover_image}`} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-purple-400 transition truncate">
                          {w.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                             <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 rounded">{w.type || "Manga"}</span>
                             <span className="text-[10px] text-gray-500 flex items-center gap-1">
                               👁️ {(w.view_count || 0).toLocaleString()}
                             </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-800">
                  <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">Türler</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Aksiyon', 'Macera', 'Fantastik', 'Dram', 'Romantizm', 'Isekai'].map(tag => (
                      <span key={tag} className="text-xs bg-[#252525] text-gray-400 px-3 py-1.5 rounded hover:bg-purple-600 hover:text-white cursor-pointer transition border border-gray-800 hover:border-purple-500">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
}