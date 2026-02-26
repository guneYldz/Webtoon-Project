"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function NovelReadingPage() {
  const params = useParams();
  const { slug, chapterNumber } = params;
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNavbar, setShowNavbar] = useState(true);
  const lastScrollY = useRef(0);

  // 1. VERİLERİ ÇEK
  useEffect(() => {
    setLoading(true);
    // Backend'de roman bölümlerini slug ve bölüm numarasına göre çeken uç nokta
    fetch(`https://kaosmanga.net/api/novels/${slug}/chapters/${chapterNumber}`)
      .then((res) => {
        if (!res.ok) throw new Error("Bölüm bulunamadı");
        return res.json();
      })
      .then((result) => {
        setData(result);
        setLoading(false);
        window.scrollTo(0, 0);
      })
      .catch((err) => {
        console.error(err);
        router.push(`/novel/${slug}`);
      });
  }, [slug, chapterNumber, router]);

  // 2. NAVBAR GİZLEME MANTIĞI (Scroll dinleyici)
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-white italic">Yükleniyor...</div>;
  if (!data) return null;

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center font-sans">
      
      {/* --- ALT GEZİNTİ ÇUBUĞU (NAVBAR) --- */}
      <div className={`fixed bottom-0 left-0 w-full z-50 transition-transform duration-500 ${showNavbar ? "translate-y-0" : "translate-y-full"}`}>
        <div className="flex justify-center w-full px-4 pb-4">
          <div className="w-full max-w-3xl bg-[#1a1a1a]/95 backdrop-blur-md border border-gray-800 rounded-2xl shadow-2xl flex justify-between items-center text-white h-16 px-6">
            <Link href={`/novel/${slug}`} className="text-gray-400 hover:text-purple-400 transition flex items-center gap-2">
              <span className="text-xl">←</span> <span className="hidden sm:inline">Geri Dön</span>
            </Link>

            <div className="text-center">
              <h2 className="text-xs font-bold truncate max-w-[150px]">{data.title}</h2>
              <p className="text-[10px] text-purple-500 font-bold uppercase">Bölüm {data.chapter_number}</p>
            </div>

            <div className="flex gap-2">
              <button 
                onClick={() => data.prev_chapter && router.push(`/novel/${slug}/bolum/${data.prev_chapter}`)}
                disabled={!data.prev_chapter}
                className="p-2 rounded-lg bg-gray-800 disabled:opacity-20 hover:bg-gray-700 transition"
              >
                ◀
              </button>
              <button 
                onClick={() => data.next_chapter && router.push(`/novel/${slug}/bolum/${data.next_chapter}`)}
                disabled={!data.next_chapter}
                className="px-4 py-2 rounded-lg bg-purple-600 font-bold text-xs disabled:opacity-20 hover:bg-purple-500 transition shadow-lg shadow-purple-900/40"
              >
                Sonraki
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- İÇERİK ALANI --- */}
      <div className="w-full max-w-3xl bg-[#161616] min-h-screen shadow-2xl px-6 md:px-16 pt-20 pb-40 border-x border-gray-900">
        
        {/* Bölüm Başlığı */}
        <div className="mb-12 text-center border-b border-gray-800 pb-10">
            <h1 className="text-3xl md:text-5xl font-black text-white mb-4 tracking-tight leading-tight italic">
                {data.title}
            </h1>
            <p className="text-purple-500 font-bold tracking-widest uppercase text-xs">
                {data.novel_title} — Bölüm {data.chapter_number}
            </p>
        </div>

        {/* 📖 METİN İÇERİĞİ (Roman)
            Backend'den gelen 'content' alanını (HTML) burada gösteriyoruz.
        */}
        <div 
          className="novel-content text-gray-200 text-lg md:text-xl leading-[2] font-serif tracking-wide select-text text-justify"
          dangerouslySetInnerHTML={{ __html: data.content }}
        />

        {/* Bölüm Sonu Butonları */}
        <div className="mt-20 pt-10 border-t border-gray-800 flex flex-col items-center gap-6">
            <div className="flex gap-4 w-full">
                {data.next_chapter ? (
                    <button 
                        onClick={() => router.push(`/novel/${slug}/bolum/${data.next_chapter}`)}
                        className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl transition shadow-xl shadow-purple-900/20"
                    >
                        Sonraki Bölüme Geç →
                    </button>
                ) : (
                    <Link href={`/novel/${slug}`} className="w-full py-4 bg-gray-800 text-center text-gray-400 font-bold rounded-xl transition">
                        Seri Sayfasına Dön
                    </Link>
                )}
            </div>
        </div>
      </div>

      {/* Roman Okuma Ayarları (CSS) */}
      <style jsx global>{`
        .novel-content p {
          margin-bottom: 2rem;
          text-indent: 1rem;
        }
        .novel-content strong {
          color: #fff;
          font-weight: 800;
        }
      `}</style>
    </div>
  );
}