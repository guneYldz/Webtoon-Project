"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
// Google Fontları
import { Crimson_Pro, Cinzel, Lato } from "next/font/google";

// 1. Roman Metni Fontu
const crimson = Crimson_Pro({ 
  subsets: ["latin"], 
  weight: ["400", "600"],
  display: "swap"
});

// 2. Epik Başlık Fontu
const cinzel = Cinzel({ 
  subsets: ["latin"], 
  weight: ["700", "900"],
  display: "swap"
});

// 3. Arayüz Fontu
const lato = Lato({ 
  subsets: ["latin"], 
  weight: ["400", "700"],
  display: "swap"
});

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function NovelReadingPage() {
  const { slug, chapterNumber } = useParams();
  const router = useRouter();

  const [chapter, setChapter] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- AKILLI BAR İÇİN GEREKLİ STATE'LER ---
  const [showNavbar, setShowNavbar] = useState(true); // Bar görünüyor mu?
  const lastScrollY = useRef(0); // Son scroll pozisyonu
  const contentRef = useRef(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
        setIsAuthenticated(!!localStorage.getItem("token"));
    }
    loadChapter();
  }, [slug, chapterNumber]);

  // --- SCROLL DİNLEYİCİSİ (AKILLI BAR MANTIĞI) ---
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Aşağı kaydırıyorsa VE 50px'den fazla indiyse -> GİZLE
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setShowNavbar(false);
      } else {
        // Yukarı kaydırıyorsa -> GÖSTER
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
      const chapterRes = await fetch(`${API}/novels/${slug}/chapters/${chapterNumber}`);
      
      if (!chapterRes.ok) throw new Error("Bölüm yüklenemedi");
      
      const chapterData = await chapterRes.json();
      setChapter(chapterData);

      if (chapterData.id) {
          loadComments(chapterData.id);
      }
      
      window.scrollTo(0, 0);
    } catch (err) {
      console.error("Hata:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async (chapterId) => {
    try {
      const res = await fetch(`${API}/comments/novel/${chapterId}`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const token = localStorage.getItem("token");

    try {
      const res = await fetch(`${API}/comments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          novel_chapter_id: chapter.id,
          content: newComment
        })
      });

      if (res.ok) {
        setNewComment("");
        loadComments(chapter.id);
      } else {
        alert("Yorum gönderilemedi. Giriş yaptığınızdan emin olun.");
      }
    } catch (err) {
      console.error("Yorum gönderilemedi", err);
    }
  };

  const formatContent = (text) => {
    if (!text) return null;
    const paragraphs = text.split('\n');
    return paragraphs.map((para, index) => {
        if (!para.trim()) return <br key={index} className="mb-4"/>;
        return (
            <p key={index} className="mb-6 indent-8 text-justify leading-loose">
                {para}
            </p>
        );
    });
  };

  if (loading) return (
    <div className="min-h-screen bg-[#121212] flex items-center justify-center text-purple-500 font-bold italic animate-pulse tracking-widest text-xl">
        KİTAP AÇILIYOR...
    </div>
  );

  if (!chapter) return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center justify-center text-gray-400">
        <p>Bölüm bulunamadı.</p>
        <Link href={`/novel/${slug}`} className="mt-4 text-purple-500 hover:underline">Seriye Dön</Link>
    </div>
  );

  return (
    <div className={`min-h-screen bg-[#121212] font-sans text-gray-200 pb-32`}>
      
      {/* 1. ÜST KAPAK ALANI */}
      <div className="relative bg-[#1a1a1a] text-white overflow-hidden shadow-2xl border-b border-gray-800 mb-12">
        <div 
            className="absolute inset-0 bg-cover bg-center opacity-30 blur-[50px] transform scale-110"
            style={{ 
                backgroundImage: chapter.novel_cover ? `url(${API}/${chapter.novel_cover})` : 'none',
                backgroundColor: '#2d1b4e' 
            }}
        ></div>
        <div className="absolute inset-0 bg-gradient-to-t from-[#121212] via-[#121212]/60 to-transparent"></div>

        <div className="relative container mx-auto max-w-6xl px-6 py-16 flex flex-col items-center gap-8 z-10 text-center">
            {chapter.novel_cover && (
                <div className="w-40 md:w-48 flex-shrink-0 rounded-lg overflow-hidden border border-gray-600/50 shadow-[0_0_30px_rgba(0,0,0,0.5)] transform hover:scale-105 transition-transform duration-500">
                    <img src={`${API}/${chapter.novel_cover}`} alt={chapter.novel_title} className="w-full h-auto object-cover"/>
                </div>
            )}
            <div className="flex-1 pb-2">
                <Link href={`/novel/${slug}`} className="inline-block mb-4 px-4 py-1.5 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-bold tracking-widest uppercase hover:bg-purple-600 hover:text-white transition">
                     {chapter.novel_title || "Roman Serisi"}
                </Link>
                <h1 className={`${cinzel.className} text-3xl md:text-5xl lg:text-6xl font-black text-white drop-shadow-2xl leading-tight mb-4`}>
                    {chapter.title}
                </h1>
                <div className="flex items-center justify-center gap-4 text-gray-400 text-sm font-medium">
                     <span className="bg-[#121212]/80 px-3 py-1 rounded border border-gray-700">Bölüm #{chapter.chapter_number}</span>
                     <span className="text-gray-600">•</span>
                     <span>{new Date(chapter.created_at).toLocaleDateString('tr-TR')}</span>
                </div>
            </div>
        </div>
      </div>

      {/* 2. OKUMA ALANI */}
      <main ref={contentRef} className="container mx-auto max-w-4xl px-4 md:px-8">
        <div className="flex justify-center mb-10 opacity-40">
            <span className="text-2xl text-purple-500">❖</span>
        </div>
        <article className={`${crimson.className} novel-body min-h-[50vh] text-[#e5e5e5] text-xl md:text-2xl`}>
             {formatContent(chapter.content)}
        </article>
        <div className="flex items-center justify-center gap-4 mt-16 mb-16 opacity-30">
            <span className="h-[1px] w-full bg-gradient-to-r from-transparent via-gray-500 to-transparent"></span>
        </div>

        {/* 3. NORMAL NAVİGASYON (Sayfa içinde de kalsın, kullanıcı isterse buradan da geçer) */}
        <div className={`grid grid-cols-2 gap-4 md:gap-8 ${lato.className} max-w-3xl mx-auto`}>
          <button
            disabled={!chapter.prev_chapter}
            onClick={() => router.push(`/novel/${slug}/bolum/${chapter.prev_chapter}`)}
            className="group relative px-6 py-6 rounded-xl bg-[#1a1a1a] border border-gray-800 hover:border-purple-500/40 transition-all disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden flex flex-col items-start shadow-lg"
          >
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] group-hover:text-purple-400 mb-2">← Önceki</span>
             <span className="text-gray-200 font-bold text-lg group-hover:translate-x-1 transition-transform">
                {chapter.prev_chapter ? `Bölüm ${chapter.prev_chapter}` : "Başlangıç"}
             </span>
          </button>
          <button
            disabled={!chapter.next_chapter}
            onClick={() => router.push(`/novel/${slug}/bolum/${chapter.next_chapter}`)}
            className="group relative px-6 py-6 rounded-xl bg-gradient-to-br from-purple-900/40 to-purple-800/20 border border-purple-500/20 hover:border-purple-500/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed overflow-hidden flex flex-col items-end text-right shadow-lg"
          >
             <span className="text-[10px] text-purple-300 font-bold uppercase tracking-[0.2em] group-hover:text-white mb-2">Sonraki →</span>
             <span className="text-white font-bold text-lg group-hover:-translate-x-1 transition-transform">
                {chapter.next_chapter ? `Bölüm ${chapter.next_chapter}` : "Son Bölüm"}
             </span>
          </button>
        </div>

        {/* 4. YORUMLAR */}
        <section className={`mt-32 max-w-3xl mx-auto ${lato.className} border-t border-gray-800 pt-12`}>
            {/* ... Yorum kodları aynen kalıyor ... */}
            <div className="flex items-center gap-3 mb-8">
                 <h3 className="text-2xl font-bold text-white">Yorumlar</h3>
                 <span className="bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full">{comments.length}</span>
            </div>
            {!isAuthenticated ? (
            <div className="bg-[#1a1a1a] p-10 rounded-2xl border border-dashed border-gray-700 text-center">
              <p className="text-gray-400 mb-6 text-base">Yorum yapmak için giriş yap.</p>
              <Link href="/login" className="px-8 py-3 bg-white text-black rounded-full font-bold text-sm hover:bg-purple-500 hover:text-white transition-all shadow-lg">Giriş Yap</Link>
            </div>
          ) : (
            <form onSubmit={handleCommentSubmit} className="mb-12 relative group">
                <textarea 
                  className="w-full bg-[#1a1a1a] text-gray-200 p-6 rounded-2xl border border-gray-800 outline-none focus:border-purple-500/50 focus:bg-[#202020] transition-all resize-none min-h-[150px] text-lg font-serif placeholder:font-sans placeholder:text-gray-600 shadow-inner"
                  placeholder="Düşüncelerin..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  required
                />
                <button type="submit" className="absolute bottom-5 right-5 bg-white text-black hover:bg-purple-600 hover:text-white px-6 py-2 rounded-full text-xs font-bold transition-all shadow-lg">GÖNDER</button>
            </form>
          )}
          <div className="space-y-6">
            {comments.map(c => (
                <div key={c.id} className="bg-[#1a1a1a] p-6 rounded-2xl border border-gray-800/50 hover:border-gray-700 transition-all flex gap-4">
                   <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                        {c.user_username[0].toUpperCase()}
                   </div>
                   <div>
                      <div className="flex items-center gap-2 mb-1">
                          <span className="text-purple-400 font-bold text-sm">{c.user_username}</span>
                          <span className="text-xs text-gray-600">• {new Date(c.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-gray-300 text-base leading-relaxed font-serif">{c.content}</p>
                   </div>
                </div>
            ))}
          </div>
        </section>
      </main>

      {/* --- 5. ENTEGRE EDİLEN AKILLI BAR (FIXED NAVBAR) --- */}
      <div 
        className={`fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 ease-in-out ${
          showNavbar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center w-full">
            <div className="w-full max-w-4xl bg-[#121212]/95 backdrop-blur-xl border-t border-purple-500/20 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] flex justify-between items-center text-white h-16 px-6">
                
                {/* Sol: Geri Dön */}
                <Link href={`/novel/${slug}`} className="text-gray-400 hover:text-purple-400 font-medium flex items-center gap-2 transition group">
                  <span className="text-xl group-hover:-translate-x-1 transition">←</span> 
                  <span className={`hidden sm:inline ${lato.className} text-xs font-bold tracking-widest uppercase`}>Seriye Dön</span>
                </Link>
                
                {/* Orta: Başlık */}
                <div className="flex flex-col items-center justify-center">
                    <h2 className={`text-xs font-bold text-gray-200 max-w-[150px] sm:max-w-xs truncate text-center ${lato.className} tracking-wide`}>
                      {chapter.title}
                    </h2>
                    <span className="text-[10px] text-purple-500 font-black tracking-widest">#{chapter.chapter_number}</span>
                </div>

                {/* Sağ: Mini Butonlar */}
                <div className={`flex gap-3 ${lato.className}`}>
                    <button 
                      onClick={() => chapter.prev_chapter && router.push(`/novel/${slug}/bolum/${chapter.prev_chapter}`)}
                      disabled={!chapter.prev_chapter}
                      className="px-4 py-2 rounded-lg bg-[#1a1a1a] border border-white/10 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-800 hover:text-purple-400 transition"
                    >
                      Önceki
                    </button>
                    <button 
                      onClick={() => chapter.next_chapter && router.push(`/novel/${slug}/bolum/${chapter.next_chapter}`)}
                      disabled={!chapter.next_chapter}
                      className="px-4 py-2 rounded-lg bg-purple-600 border border-purple-500 text-xs font-bold text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-purple-500 transition shadow-lg shadow-purple-900/20"
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