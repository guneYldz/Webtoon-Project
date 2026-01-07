"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function SerilerPage() {
  const [webtoons, setWebtoons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://127.0.0.1:8000/webtoons/")
      .then((res) => res.json())
      .then((data) => {
        // A'dan Z'ye Alfabetik Sıralama Yapıyoruz
        const sorted = data.sort((a, b) => a.title.localeCompare(b.title));
        setWebtoons(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white text-lg animate-pulse">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">
      
      {/* HEADER */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 pt-10 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
            <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
              <span className="bg-gradient-to-r from-green-500 to-emerald-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg text-xl">📚</span>
              Tüm Seriler
            </h1>
            <p className="text-gray-400 text-sm">Arşivimizdeki toplam <span className="text-white font-bold">{webtoons.length}</span> seri A'dan Z'ye listeleniyor.</p>
        </div>
      </div>

      {/* LİSTE */}
      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-8">
          {webtoons.map((w) => (
            <div key={w.id} className="group flex flex-col gap-2">
              
              {/* Kart Resmi */}
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:shadow-green-900/20 group-hover:border-green-500/50 transition duration-300">
                <Link href={`/webtoon/${w.id}`}>
                    <img 
                        src={`http://127.0.0.1:8000/${w.cover_image}`} 
                        alt={w.title} 
                        className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                        loading="lazy"
                    />
                </Link>
                
                {/* Durum Etiketi */}
                <div className="absolute top-2 left-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm border border-black/10 ${w.status === 'ongoing' ? 'bg-blue-600' : 'bg-red-600'}`}>
                      {w.status === 'ongoing' ? 'ONGOING' : 'TAMAMLANDI'}
                    </span>
                </div>
              </div>
              
              {/* Bilgiler */}
              <div>
                <Link href={`/webtoon/${w.id}`}>
                    <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-green-400 transition">
                        {w.title}
                    </h3>
                </Link>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500 bg-[#1e1e1e] border border-gray-800 px-1.5 py-0.5 rounded">
                        {(w.episodes?.length || 0)} Bölüm
                    </span>
                    <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        👁️ {(w.view_count || 0).toLocaleString()}
                    </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}