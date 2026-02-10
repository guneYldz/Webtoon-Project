"use client";

import { useState, useEffect } from "react";
import Link from "next/link";



export default function SerilerPage() {
  const [webtoons, setWebtoons] = useState([]);
  const [novels, setNovels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [webtoonRes, novelRes] = await Promise.all([
          fetch("http://127.0.0.1:8000/webtoons/"),
          fetch("http://127.0.0.1:8000/novels/")
        ]);

        const webtoonData = await webtoonRes.json();
        const novelData = await novelRes.json();

        // Her iki listeyi de A'dan Z'ye alfabetik sıralıyoruz
        setWebtoons(webtoonData.sort((a, b) => a.title.localeCompare(b.title)));
        setNovels(novelData.sort((a, b) => a.title.localeCompare(b.title)));

        setLoading(false);
      } catch (err) {
        console.error("Veriler çekilemedi:", err);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white text-lg animate-pulse">Arşiv Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">

      {/* HEADER */}
      <div className="bg-[#1a1a1a] border-b border-gray-800 pt-10 pb-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <h1 className="text-3xl font-black text-white mb-2 flex items-center gap-3">
            <span className="bg-gradient-to-r from-green-500 to-emerald-600 w-10 h-10 rounded-lg flex items-center justify-center shadow-lg text-xl">📚</span>
            Tüm Seriler
          </h1>
          <p className="text-gray-400 text-sm">
            Arşivimizdeki toplam <span className="text-white font-bold">{webtoons.length + novels.length}</span> seri alfabetik olarak listeleniyor.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-8 space-y-20">

        {/* --- 🎬 TÜM WEBTOONLAR --- */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Webtoon Arşivi</h2>
            <div className="flex-1 h-px bg-gray-800"></div>
            <span className="text-gray-500 text-xs font-mono">{webtoons.length} SERİ</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-10">
            {webtoons.map((w) => (
              <div key={`webtoon-${w.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:border-green-500/50 transition duration-300">
                  <Link href={`/webtoon/${w.id}`}>
                    <img
                      src={`http://127.0.0.1:8000/${w.cover_image}`}
                      alt={w.title}
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  </Link>
                  <div className="absolute top-2 left-2">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded text-white shadow-sm border border-black/10 ${w.status === 'ongoing' ? 'bg-blue-600' : 'bg-red-600'}`}>
                      {w.status === 'ongoing' ? 'ONGOING' : 'TAMAMLANDI'}
                    </span>
                  </div>
                </div>
                <div>
                  <Link href={`/webtoon/${w.id}`}>
                    <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-green-400 transition">{w.title}</h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-500 bg-[#1e1e1e] border border-gray-800 px-1.5 py-0.5 rounded">
                      {(w.episodes?.length || 0)} Bölüm
                    </span>
                    <span className="text-[10px] text-gray-500">👁️ {w.view_count || 0}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* --- 📖 TÜM ROMANLAR --- */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-2xl font-bold text-white uppercase tracking-wider">Roman Arşivi</h2>
            <div className="flex-1 h-px bg-gray-800"></div>
            <span className="text-gray-500 text-xs font-mono">{novels.length} SERİ</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-x-4 gap-y-10">
            {novels.map((n) => (
              <div key={`novel-${n.id}`} className="group flex flex-col gap-2">
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-gray-800 shadow-lg group-hover:border-purple-500/50 transition duration-300">
                  <Link href={`/novel/${n.slug}`}>
                    <img
                      src={`http://127.0.0.1:8000/${n.cover_image}`}
                      alt={n.title}
                      className="w-full h-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  </Link>
                  <div className="absolute top-2 left-2">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded text-white bg-purple-600">NOVEL</span>
                  </div>
                </div>
                <div>
                  <Link href={`/novel/${n.slug}`}>
                    <h3 className="font-bold text-sm text-gray-100 truncate group-hover:text-purple-400 transition">{n.title}</h3>
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400 italic">{n.author || 'Yazar Belirtilmedi'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}