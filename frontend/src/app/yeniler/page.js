"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function YenilerPage() {
  const [webtoons, setWebtoons] = useState([]);
  const [novels, setNovels] = useState([]); // 📖 Romanlar için yeni state
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // İki veriyi de aynı anda çekiyoruz
    const fetchData = async () => {
      try {
        const [webtoonRes, novelRes] = await Promise.all([
          fetch("https://kaosmanga.net/api/webtoons/"),
          fetch("https://kaosmanga.net/api/novels/")
        ]);

        const webtoonData = await webtoonRes.json();
        const novelData = await novelRes.json();

        // Son eklenenler en üstte görünsün diye ters çeviriyoruz
        setWebtoons([...webtoonData].reverse());
        setNovels([...novelData].reverse());
        
        setLoading(false);
      } catch (err) {
        console.error("Veri çekme hatası:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white text-lg animate-pulse">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">
      
      {/* HEADER */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 pt-10 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
            <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
              <span className="bg-gradient-to-r from-red-500 to-orange-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg text-xl">🔥</span>
              Yeniler
            </h1>
            <p className="text-gray-400 text-sm">Siteye eklenen son seriler ve güncellemeler.</p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-16">
        
        {/* --- 🎬 YENİ WEBTOONLAR BÖLÜMÜ --- */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
             <span className="w-1.5 h-6 bg-red-600 rounded-full"></span>
             Yeni Eklenen Webtoonlar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
            {webtoons.map((w, index) => (
              <div key={`webtoon-${w.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:border-red-500/50 transition duration-300">
                  <Link href={`/webtoon/${w.id}`}>
                      <img 
                          src={`https://kaosmanga.net/api/${w.cover_image}`} 
                          alt={w.title} 
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                      />
                  </Link>
                  {index < 5 && (
                      <div className="absolute top-2 right-2">
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-red-600 text-white shadow-md animate-pulse">NEW</span>
                      </div>
                  )}
                </div>
                <div>
                  <Link href={`/webtoon/${w.id}`}>
                      <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-red-400 transition">{w.title}</h3>
                  </Link>
                  <p className="text-[10px] text-gray-500 mt-1">Webtoon • {new Date().toLocaleDateString('tr-TR')}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* --- 📖 YENİ ROMANLAR BÖLÜMÜ --- */}
        <section>
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
             <span className="w-1.5 h-6 bg-purple-600 rounded-full"></span>
             Yeni Eklenen Romanlar
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
            {novels.map((n, index) => (
              <div key={`novel-${n.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:border-purple-500/50 transition duration-300">
                  <Link href={`/novel/${n.slug}`}>
                      <img 
                          src={`https://kaosmanga.net/api/${n.cover_image}`} 
                          alt={n.title} 
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                      />
                  </Link>
                  {index < 5 && (
                      <div className="absolute top-2 right-2">
                          <span className="text-[10px] font-bold px-2 py-1 rounded bg-purple-600 text-white shadow-md animate-pulse">NEW</span>
                      </div>
                  )}
                </div>
                <div>
                  <Link href={`/novel/${n.slug}`}>
                      <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-purple-400 transition">{n.title}</h3>
                  </Link>
                  <p className="text-[10px] text-gray-500 mt-1">Roman • {n.author || 'Belirtilmedi'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}