"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

export default function NovelDetail() {
  const params = useParams();
  const { slug } = params; // URL'deki slug değerini alıyoruz

  const [novel, setNovel] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Backend'de yazdığımız /novels/{slug} ucuna istek atıyoruz
    fetch(`http://127.0.0.1:8000/novels/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Roman bulunamadı");
        return res.json();
      })
      .then((data) => {
        setNovel(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [slug]);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white text-lg animate-pulse">Roman yükleniyor...</div>;
  if (!novel) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-red-500">Roman Bulunamadı 😔</div>;

  return (
    <div className="min-h-screen bg-[#121212] pb-20 font-sans">
      
      {/* 1. ÜST KISIM (KAPAK & BİLGİ) */}
      <div className="relative bg-[#1a1a1a] text-white overflow-hidden shadow-2xl border-b border-gray-800">
        {/* Arkaplan Blur Efekti (Novel temasına uygun mor tonlar) */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20 blur-3xl transform scale-110"
          style={{ backgroundImage: `url(http://127.0.0.1:8000/${novel.cover_image})` }}
        ></div>
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-transparent to-transparent"></div>

        <div className="relative container mx-auto max-w-7xl px-4 py-16 flex flex-col md:flex-row gap-10 items-center md:items-start z-10">
          {/* Kapak Resmi */}
          <div className="w-52 md:w-72 flex-shrink-0 rounded-2xl overflow-hidden border border-purple-500/30 shadow-[0_0_50px_rgba(147,51,234,0.2)]">
            <img 
              src={`http://127.0.0.1:8000/${novel.cover_image}`} 
              alt={novel.title} 
              className="w-full h-auto object-cover"
            />
          </div>

          {/* Yazılar */}
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-4xl md:text-6xl font-black mb-4 drop-shadow-lg tracking-tight text-white italic">
              {novel.title}
            </h1>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-6">
               <span className="bg-purple-600/20 text-purple-400 border border-purple-600/50 px-4 py-1.5 rounded-full text-sm font-bold tracking-widest uppercase">
                 Novel
               </span>
               <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${novel.status === 'ongoing' ? 'bg-green-500/10 text-green-400 border-green-500/50' : 'bg-red-500/10 text-red-400 border-red-500/50'}`}>
                 {novel.status === 'ongoing' ? 'Devam Ediyor' : 'Tamamlandı'}
               </span>
               <span className="bg-gray-800/50 text-gray-300 border border-gray-700 px-4 py-1.5 rounded-full text-sm flex items-center gap-2">
                 ✍️ {novel.author || "Bilinmeyen Yazar"}
               </span>
            </div>

            <div className="bg-white/5 backdrop-blur-sm p-6 rounded-2xl border border-white/10 max-w-4xl">
                <h2 className="text-purple-400 font-bold mb-2 flex items-center gap-2 uppercase text-xs tracking-widest">Özet</h2>
                <p className="text-gray-300 text-lg leading-relaxed italic">
                {novel.summary}
                </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. BÖLÜMLER LİSTESİ */}
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <h3 className="text-2xl font-bold text-white mb-8 border-b border-gray-800 pb-4 flex justify-between items-center">
          <span className="flex items-center gap-3">
            <span className="w-1.5 h-6 bg-purple-600 rounded-full shadow-[0_0_10px_rgba(147,51,234,0.5)]"></span>
            Bölüm Listesi
          </span>
          <span className="text-sm font-medium text-gray-400 bg-[#1e1e1e] px-4 py-1.5 rounded-full border border-gray-800">
            {novel.chapters?.length || 0} Bölüm Mevcut
          </span>
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {novel.chapters && novel.chapters.length > 0 ? (
            // Bölümleri numaraya göre sıralayıp listele (Sondan başa)
            [...novel.chapters].sort((a, b) => b.chapter_number - a.chapter_number).map((ch) => (
              <Link 
                key={ch.id} 
                href={`/novel/${slug}/bolum/${ch.chapter_number}`} 
                className="bg-[#1e1e1e] p-5 rounded-2xl border border-gray-800 hover:border-purple-500/50 hover:bg-[#252525] transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600/10 rounded-xl border border-purple-500/20 flex items-center justify-center text-purple-400 font-black group-hover:bg-purple-600 group-hover:text-white transition-all">
                    {ch.chapter_number}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-200 group-hover:text-purple-400 transition">
                      {ch.title}
                    </h4>
                    <span className="text-[10px] text-gray-600 uppercase tracking-widest">
                      Bölümü Oku
                    </span>
                  </div>
                </div>
                <div className="text-gray-600 group-hover:text-purple-500 transition">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </Link>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-[#1e1e1e] rounded-3xl border border-dashed border-gray-800 text-gray-500">
              <span className="text-5xl block mb-4">📖</span>
              Henüz bu seriye ait bir bölüm yayınlanmamış.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}