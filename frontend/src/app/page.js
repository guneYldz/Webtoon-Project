"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import FeaturedCard from "@/components/FeaturedSlider";

export default function Home() {
  const [webtoons, setWebtoons] = useState([]);
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [featuredWebtoon, setFeaturedWebtoon] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [webtoonRes, novelRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/webtoons/"),
          fetch("http://127.0.0.1:8000/novels/")
        ]);

        const webtoonData = await webtoonRes.json();
        const novelData = await novelRes.json();

        setWebtoons(webtoonData);
        setNovels(novelData);

        const vitrin = webtoonData.find(w => w.is_featured) || webtoonData[0];
        setFeaturedWebtoon(vitrin);

        setLoading(false);
      } catch (err) {
        console.error("Veriler çekilemedi:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  // --- MANTIK: TÜMÜNÜ BİRLEŞTİR VE SIRALA ---
  // Webtoon ve Romanları tek bir listede toplayıp tarihe göre sıralıyoruz
  const allSeries = [
    ...webtoons.map(item => ({ ...item, typeLabel: "WEBTOON", linkPath: "webtoon", color: "blue" })),
    ...novels.map(item => ({ ...item, typeLabel: "NOVEL", linkPath: "novel", color: "purple" }))
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const popularList = [...webtoons].sort((a, b) => b.view_count - a.view_count).slice(0, 10);

  return (
    <div className="min-h-screen font-sans bg-[#121212] pb-20">
      <div className="container mx-auto max-w-7xl px-4 py-8">
        
        {/* --- 1. HERO VİTRİN --- */}
        <div className="mb-12">
            <FeaturedCard webtoon={featuredWebtoon} />
        </div>

        <div className="flex flex-col lg:flex-row gap-10 items-start">
          
          {/* SOL: ANA İÇERİK AKIŞI */}
          <div className="flex-1 w-full">
            
            <section>
              <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-3">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                  <span className="w-2 h-8 bg-gradient-to-b from-blue-600 to-purple-600 rounded-full inline-block"></span> 
                  Son Eklenen Serilerimiz
                </h2>
                <Link href="/seriler" className="text-sm font-medium text-gray-500 hover:text-white transition">Tümünü Gör →</Link>
              </div>

              {/* KART GRİD YAPISI */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-5 gap-y-10">
                {allSeries.map((item) => (
                  <div key={`${item.typeLabel}-${item.id}`} className="group flex flex-col gap-3">
                    
                    {/* Kapak Görseli */}
                    <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:border-gray-600 transition-all duration-300">
                      <Link href={`/${item.linkPath}/${item.slug || item.id}`}>
                        <img 
                          src={`http://127.0.0.1:8000/${item.cover_image}`} 
                          alt={item.title} 
                          className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                        />
                      </Link>
                      
                      {/* 🏷️ TÜR ETİKETİ (WEBTOON veya NOVEL) */}
                      <div className="absolute top-2 left-2">
                         <span className={`text-[10px] font-black px-2 py-0.5 rounded shadow-lg text-white border border-white/10 ${
                           item.typeLabel === 'WEBTOON' ? 'bg-blue-600' : 'bg-purple-600'
                         }`}>
                           {item.typeLabel}
                         </span>
                      </div>
                    </div>

                    {/* Bilgiler */}
                    <div className="px-1">
                      <Link href={`/${item.linkPath}/${item.slug || item.id}`}>
                        <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-blue-400 transition duration-200">
                          {item.title}
                        </h3>
                      </Link>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-[10px] text-gray-500 italic truncate max-w-[70%]">
                          {item.author || (item.typeLabel === 'WEBTOON' ? 'Stüdyo' : 'Yazar')}
                        </p>
                        <span className="text-[10px] text-gray-600 font-medium">
                          {item.status === 'ongoing' ? 'Güncel' : 'Bitti'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* SAĞ: SIDEBAR (POPÜLER) */}
          <div className="w-full lg:w-80 flex-shrink-0">
              <div className="bg-[#1a1a1a] rounded-2xl border border-gray-800 p-6 sticky top-24 shadow-2xl">
                <h3 className="text-lg font-bold text-white mb-8 flex items-center gap-2">
                  <span className="text-yellow-500">🔥</span> Trend Listesi
                </h3>
                
                <div className="flex flex-col gap-6">
                  {popularList.map((w, index) => (
                    <Link key={w.id} href={`/webtoon/${w.id}`} className="flex gap-4 group items-center">
                      <div className={`text-4xl font-black italic w-10 flex-shrink-0 text-center ${index < 3 ? 'text-transparent bg-clip-text bg-gradient-to-b from-blue-400 to-purple-600' : 'text-gray-800'}`}>
                        {index + 1}
                      </div>
                      <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 border border-gray-800 group-hover:border-blue-500 transition-colors">
                        <img src={`http://127.0.0.1:8000/${w.cover_image}`} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div className="flex flex-col justify-center min-w-0">
                        <h4 className="text-sm font-bold text-gray-200 group-hover:text-blue-400 transition truncate leading-tight">
                          {w.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                           <span className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">Webtoon</span>
                           <span className="text-[9px] text-gray-600">👁️ {w.view_count || 0}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
          </div>

        </div>
      </div>
    </div>
  );
}