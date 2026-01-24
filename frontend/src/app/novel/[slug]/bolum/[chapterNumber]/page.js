"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import CommentSection from "@/components/CommentSection"; 
import Link from "next/link";
import { Crimson_Pro, Cinzel, Lato } from "next/font/google";
import { API } from "@/api";

// --- FONTLAR ---
const crimson = Crimson_Pro({ subsets: ["latin"], weight: ["400", "600"], display: "swap" });
const cinzel = Cinzel({ subsets: ["latin"], weight: ["700", "900"], display: "swap" });
const lato = Lato({ subsets: ["latin"], weight: ["400", "700"], display: "swap" });

export default function NovelReadingPage() {
  const { slug, chapterNumber } = useParams();
  const router = useRouter();

  const [chapter, setChapter] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- NAVBAR SAKLAMA AYARI ---
  const [showNavbar, setShowNavbar] = useState(true); 
  const lastScrollY = useRef(0);

  // --- 1. VERİLERİ ÇEK ---
  useEffect(() => {
    loadChapter();
  }, [slug, chapterNumber]);

  // --- 2. NAVBAR SCROLL MANTIĞI ---
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setShowNavbar(false);
      } else {
        setShowNavbar(true);
      }
      lastScrollY.current = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const loadChapter = async () => {
    try {
      setLoading(true);
      
      // 🔥 TEK VE GÜÇLÜ İSTEK
      // credentials: "include" sayesinde Backend hem veriyi verir hem de sayacı artırır.
      // cache: "no-store" sayesinde her zaman güncel görüntülenme sayısını görürsün.
      const res = await fetch(`${API}/novels/${slug}/chapters/${chapterNumber}`, {
          cache: "no-store",
          credentials: "include" 
      });

      if (!res.ok) throw new Error("Bölüm yüklenemedi");
      
      const data = await res.json();
      setChapter(data);
      window.scrollTo(0, 0);

    } catch (err) {
      console.error("Hata:", err);
    } finally {
      setLoading(false);
    }
  };

  // --- PARAGRAF DÜZENLEYİCİ ---
  const formatContent = (text) => {
    if (!text) return null;
    return text.split('\n').map((para, index) => {
        if (!para.trim()) return <br key={index} className="mb-4"/>;
        return (
            <p key={index} className="mb-8 indent-8 text-justify leading-loose">
                {para}
            </p>
        );
    });
  };

  // --- TARİH FORMATLAYICI (GÜVENLİ) ---
  const formatDate = (dateString) => {
      if (!dateString) return "Tarih Yok";
      try {
          return new Date(dateString).toLocaleDateString('tr-TR', {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
          });
      } catch (e) {
          return "Tarih Hatalı";
      }
  };

  if (loading) return <div className="min-h-screen bg-[#121212] flex items-center justify-center text-purple-500 font-bold animate-pulse text-xl tracking-widest">YÜKLENİYOR...</div>;
  if (!chapter) return <div className="min-h-screen bg-[#121212] text-white flex justify-center items-center">Bölüm Bulunamadı</div>;

  return (
    // overflow-x-hidden: Sağa sola kaymayı engeller
    <div className={`min-h-screen bg-[#121212] font-sans text-gray-200 pb-40 overflow-x-hidden`}>
      
      {/* 1. ÜST KAPAK ALANI (ÖZEL MOR TASARIM) */}
      <div className="relative bg-[#1a1a1a] text-white shadow-2xl border-b border-gray-800 mb-12">
        {/* Arka Plan Resmi ve Blur Efekti */}
        <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-[50px] scale-110" 
            style={{ 
                backgroundImage: chapter.novel_cover ? `url(${API}/${chapter.novel_cover})` : 'none', 
                backgroundColor: '#2d1b4e' // Resim yoksa Mor arka plan
            }}
        ></div>
        
        {/* Karartma Katmanı */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent"></div>
        
        {/* İçerik */}
        <div className="relative container mx-auto max-w-6xl px-6 py-16 flex flex-col items-center gap-8 z-10 text-center">
            {/* Kapak Resmi (Varsa) */}
            {chapter.novel_cover && (
                <div className="w-40 md:w-48 flex-shrink-0 rounded-lg overflow-hidden border border-gray-600/50 shadow-2xl transform hover:scale-105 transition-transform duration-500">
                    <img 
                        src={`${API}/${chapter.novel_cover}`} 
                        alt={chapter.novel_title} 
                        className="w-full h-auto object-cover"
                    />
                </div>
            )}
            
            <div className="flex-1 pb-2">
                {/* Seri Adı Butonu */}
                <Link href={`/novel/${slug}`} className="inline-block mb-4 px-4 py-1.5 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-widest uppercase hover:bg-purple-600 hover:text-white transition">
                      {chapter.novel_title || "Roman Serisi"}
                </Link>
                
                {/* Bölüm Başlığı */}
                <h1 className={`${cinzel.className} text-3xl md:text-5xl lg:text-6xl font-black text-white drop-shadow-2xl leading-tight mb-4`}>
                    {chapter.title}
                </h1>
                
                {/* --- BİLGİ SATIRI --- */}
                <div className="flex flex-wrap items-center justify-center gap-4 text-gray-400 text-sm font-medium">
                      {/* Bölüm Numarası */}
                      <span className="bg-[#121212]/80 px-3 py-1 rounded border border-gray-700">
                          Bölüm #{chapter.chapter_number}
                      </span>
                      
                      {/* Tarih */}
                      <span className="flex items-center gap-1">
                          📅 {formatDate(chapter.created_at)}
                      </span>
                      
                      {/* İzlenme Sayısı */}
                      <span className="flex items-center gap-1 text-purple-400 bg-purple-900/20 px-2 py-1 rounded">
                         👁️ {chapter.view_count || 0}
                      </span>
                </div>
            </div>
        </div>
      </div>

      {/* 2. OKUMA ALANI */}
      <main className="container mx-auto max-w-4xl px-4 md:px-8 relative z-10">
        <div className="flex justify-center mb-10 opacity-40 text-purple-500 text-2xl">❖</div>
        <article className={`${crimson.className} text-[#e5e5e5] text-xl md:text-2xl`}>
             {formatContent(chapter.content)}
        </article>
        <div className="flex justify-center mt-12 opacity-40 text-purple-500 text-2xl">❖</div>
      </main>

      {/* 3. YORUM ALANI */}
      <div className={`mt-32 max-w-3xl mx-auto ${lato.className} border-t border-gray-800 pt-12 px-4`}>
          <CommentSection 
             type="novel" 
             itemId={chapter.novel_id} 
             chapterId={chapter.id} 
          />
      </div>

      {/* 4. SABİT ALT BAR */}
      <div 
        className={`fixed bottom-0 left-0 w-full z-[999] transition-transform duration-300 ease-in-out ${
          showNavbar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center w-full">
            <div className="w-full max-w-4xl bg-[#121212]/95 backdrop-blur-xl border-t border-purple-500/20 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] flex justify-between items-center text-white h-16 px-6">
                
                <Link href={`/novel/${slug}`} className="text-gray-400 hover:text-purple-400 font-medium flex items-center gap-2 transition group">
                  <span className="text-xl group-hover:-translate-x-1 transition">←</span> 
                  <span className={`hidden sm:inline ${lato.className} text-xs font-bold tracking-widest uppercase`}>Seri</span>
                </Link>
                
                <div className="flex flex-col items-center justify-center px-4">
                    <h2 className={`text-xs font-bold text-gray-200 max-w-[120px] sm:max-w-xs truncate text-center ${lato.className} tracking-wide`}>
                      {chapter.title}
                    </h2>
                    <span className="text-[10px] text-purple-500 font-black tracking-widest">#{chapter.chapter_number}</span>
                </div>

                <div className={`flex gap-3 ${lato.className}`}>
                    <button 
                      onClick={() => chapter.prev_chapter && router.push(`/novel/${slug}/bolum/${chapter.prev_chapter}`)}
                      disabled={!chapter.prev_chapter}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 hover:text-purple-400 transition"
                    >
                      Önceki
                    </button>
                    <button 
                      onClick={() => chapter.next_chapter && router.push(`/novel/${slug}/bolum/${chapter.next_chapter}`)}
                      disabled={!chapter.next_chapter}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 border border-purple-500 text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-purple-500 transition shadow-lg"
                    >
                      Sonraki
                    </button>
                </div>
            </div>
        </div>
      </div>

    </div>
  );
}