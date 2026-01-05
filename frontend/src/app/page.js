"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function Home() {
  const [webtoons, setWebtoons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/webtoons/")
      .then((res) => res.json())
      .then((data) => {
        setWebtoons(data);
        setLoading(false);
      })
      .catch((err) => console.error(err));
  }, []);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white">Yükleniyor...</div>;

  // --- LİSTELERİ AYIR ---
  // 1. Vitrin (İlk 3 Webtoon)
  const showcase = webtoons.slice(0, 3);
  
  // 2. Popülerler (Sidebar için - İzlenmeye göre sırala)
  const popularList = [...webtoons].sort((a, b) => b.view_count - a.view_count).slice(0, 10);

  // 3. Güncellemeler (Kalanlar veya Hepsi)
  // Normalde tarihe göre sıralanır, şimdilik ters çeviriyoruz (en yeni en üstte)
  const latestUpdates = [...webtoons].reverse();

  return (
    <div className="min-h-screen font-sans">
      
      {/* --- NAVBAR --- */}
      <nav className="bg-[#1a1a1a] border-b border-gray-800 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            {/* Logo yerine yazı veya resim */}
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
              WebtoonTR
            </span>
          </Link>
          
          <div className="flex items-center gap-4 text-sm font-medium text-gray-300">
            <Link href="#" className="hover:text-white transition">Seriler</Link>
            <Link href="#" className="hover:text-white transition">Yeniler</Link>
            <div className="w-[1px] h-6 bg-gray-700"></div>
            <Link href="/login" className="hover:text-white transition">Giriş Yap</Link>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        
        {/* --- 1. ÜST VİTRİN (3'lü Kart) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          {showcase.map((w) => (
            <Link key={w.id} href={`/webtoon/${w.id}`} className="group relative h-64 rounded-xl overflow-hidden shadow-lg border border-gray-800">
              {/* Arkaplan Resmi */}
              <img 
                src={`http://127.0.0.1:8000/${w.cover_image}`} 
                alt={w.title} 
                className="absolute inset-0 w-full h-full object-cover transition duration-500 group-hover:scale-110"
              />
              {/* Karartma */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent opacity-80 group-hover:opacity-90 transition"></div>
              
              {/* İçerik */}
              <div className="absolute bottom-0 left-0 p-4 w-full">
                <span className="text-xs font-bold text-yellow-400 bg-black/50 px-2 py-1 rounded mb-2 inline-block">
                  ÖNERİLEN 🔥
                </span>
                <h3 className="text-xl font-bold text-white leading-tight">{w.title}</h3>
                <p className="text-gray-300 text-xs mt-1 line-clamp-1">{w.summary}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* --- 2. ANA İÇERİK (SOL) ve SIDEBAR (SAĞ) --- */}
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* SOL TARAF: GÜNCEL BÖLÜMLER */}
          <div className="flex-1">
            <div className="flex justify-between items-end mb-6 border-b border-gray-800 pb-2">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <span className="text-blue-500">●</span> Güncel Seriler
              </h2>
              <Link href="#" className="text-xs text-gray-500 hover:text-white">Tümünü Gör</Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {latestUpdates.map((w) => (
                <div key={w.id} className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800 hover:border-gray-600 transition group">
                  {/* Kapak */}
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <Link href={`/webtoon/${w.id}`}>
                      <img 
                        src={`http://127.0.0.1:8000/${w.cover_image}`} 
                        alt={w.title} 
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    </Link>
                    {/* Durum Etiketi */}
                    <div className="absolute top-2 left-2">
                       <span className={`text-[10px] font-bold px-2 py-1 rounded text-white ${w.status === 'ongoing' ? 'bg-blue-600' : 'bg-red-600'}`}>
                         {w.status === 'ongoing' ? 'DEVAM EDİYOR' : 'TAMAMLANDI'}
                       </span>
                    </div>
                  </div>
                  
                  {/* Bilgiler */}
                  <div className="p-3">
                    <Link href={`/webtoon/${w.id}`}>
                      <h3 className="font-bold text-sm text-gray-200 mb-2 truncate group-hover:text-blue-400 transition">
                        {w.title}
                      </h3>
                    </Link>
                    
                    {/* Son Bölümler (Sahte veri görsel amaçlı - İleride gerçeğini çekeriz) */}
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs text-gray-500 bg-[#252525] p-1.5 rounded hover:bg-[#333] cursor-pointer transition">
                        <span>Bölüm {Math.floor(Math.random() * 50) + 10}</span>
                        <span className="text-[10px]">2 saat</span>
                      </div>
                      <div className="flex justify-between items-center text-xs text-gray-500 bg-[#252525] p-1.5 rounded hover:bg-[#333] cursor-pointer transition">
                        <span>Bölüm {Math.floor(Math.random() * 10)}</span>
                        <span className="text-[10px]">1 gün</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SAĞ TARAF: SIDEBAR (POPÜLERLER) */}
          <div className="w-full lg:w-80 flex-shrink-0">
             <div className="bg-[#1e1e1e] rounded-xl border border-gray-800 p-5 sticky top-24">
               <h3 className="text-lg font-bold text-white mb-5 border-l-4 border-purple-500 pl-3">
                 En Popüler 🏆
               </h3>
               
               <div className="flex flex-col gap-4">
                 {popularList.map((w, index) => (
                   <Link key={w.id} href={`/webtoon/${w.id}`} className="flex gap-4 group">
                     {/* Sıra Numarası */}
                     <div className={`text-2xl font-bold italic w-6 flex-shrink-0 text-center ${index < 3 ? 'text-purple-500' : 'text-gray-600'}`}>
                       {index + 1}
                     </div>
                     
                     {/* Küçük Resim */}
                     <div className="w-16 h-20 rounded overflow-hidden flex-shrink-0">
                       <img src={`http://127.0.0.1:8000/${w.cover_image}`} className="w-full h-full object-cover" />
                     </div>
                     
                     {/* Yazı */}
                     <div className="flex flex-col justify-center">
                       <h4 className="text-sm font-bold text-gray-300 group-hover:text-white transition line-clamp-2">
                         {w.title}
                       </h4>
                       <span className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                         👁️ {(w.view_count || 0).toLocaleString()}
                       </span>
                     </div>
                   </Link>
                 ))}
               </div>

               {/* Türler Kısmı (Görsel) */}
               <div className="mt-8 pt-6 border-t border-gray-700">
                 <h3 className="text-md font-bold text-gray-400 mb-4">Türlere Göre Keşfet</h3>
                 <div className="flex flex-wrap gap-2">
                   {['Aksiyon', 'Macera', 'Fantastik', 'Dram', 'Romantizm'].map(tag => (
                     <span key={tag} className="text-xs bg-[#252525] text-gray-400 px-3 py-1 rounded-full hover:bg-purple-600 hover:text-white cursor-pointer transition">
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