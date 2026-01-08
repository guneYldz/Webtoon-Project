"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function NovelReadingPage() {
  const { slug, chapterNumber } = useParams();
  const router = useRouter();

  // State Tanımları
  const [chapter, setChapter] = useState(null);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Başlangıç Kontrolleri
  useEffect(() => {
    // Tarayıcıda mıyız kontrolü
    if (typeof window !== "undefined") {
        setIsAuthenticated(!!localStorage.getItem("token"));
    }
    loadChapter();
  }, [slug, chapterNumber]);

  // Veri Çekme Fonksiyonu
  const loadChapter = async () => {
    try {
      setLoading(true);
      const chapterRes = await fetch(`${API}/novels/${slug}/chapters/${chapterNumber}`);
      
      if (!chapterRes.ok) throw new Error("Bölüm yüklenemedi");
      
      const chapterData = await chapterRes.json();
      setChapter(chapterData);

      // Eğer bölüm geldiyse yorumları da çek
      if (chapterData.id) {
          loadComments(chapterData.id);
      }
      
      window.scrollTo(0, 0);
    } catch (err) {
      console.error("Hata:", err);
      // Hata olursa seri sayfasına atmasın, ekranda hata göstersin ki anlayalım
      // router.push(`/novel/${slug}`); 
    } finally {
      setLoading(false);
    }
  };

  // Yorumları Çekme
  const loadComments = async (chapterId) => {
    try {
      const res = await fetch(`${API}/comments/novel/${chapterId}`);
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch {
      setComments([]);
    }
  };

  // Yorum Gönderme
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

  // Yükleniyor Ekranı
  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-purple-500 font-bold italic animate-pulse">
        SAYFALAR ÇEVRİLİYOR...
    </div>
  );

  // Veri Yoksa Hata Ekranı
  if (!chapter) return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center text-gray-400">
        <p>Bölüm bulunamadı.</p>
        <Link href={`/novel/${slug}`} className="mt-4 text-purple-500 hover:underline">Seriye Dön</Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center overflow-x-hidden text-gray-200">
      
      <main className="w-full max-w-3xl bg-[#0d0d0d] px-6 md:px-16 pt-16 pb-20 relative">
        
        {/* --- BAŞLIK ALANI --- */}
        <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter uppercase italic drop-shadow-md">
                {chapter.novel_title || "Roman"}
            </h1>
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-purple-600 to-transparent opacity-50"></div>
        </div>

        {/* --- METİN İÇERİĞİ --- */}
        <article
          className="novel-content text-gray-300 text-lg md:text-xl leading-[2.4] font-serif tracking-wide text-justify mb-32"
          dangerouslySetInnerHTML={{ __html: chapter.content }}
        />

        {/* --- NAV BUTONLARI (ZARİF & SİMETRİK) --- */}
        <div className="grid grid-cols-2 gap-4 mt-10">
          <button
            disabled={!chapter.prev_chapter}
            onClick={() => router.push(`/novel/${slug}/bolum/${chapter.prev_chapter}`)}
            className="py-3 px-4 rounded-xl bg-[#151a21] border border-white/5 flex flex-col items-center justify-center transition-all hover:border-purple-500/50 disabled:opacity-5 group"
          >
            <span className="text-[9px] font-black text-purple-500 opacity-60 group-hover:opacity-100 uppercase tracking-widest">← ÖNCEKİ</span>
            <span className="text-white font-bold text-[10px] italic mt-1">
                {chapter.prev_chapter ? `Bölüm ${chapter.prev_chapter}` : "Başlangıç"}
            </span>
          </button>

          <button
            disabled={!chapter.next_chapter}
            onClick={() => router.push(`/novel/${slug}/bolum/${chapter.next_chapter}`)}
            className="py-3 px-4 rounded-xl bg-purple-600 border border-purple-400/30 flex flex-col items-center justify-center transition-all hover:bg-purple-500 shadow-lg disabled:opacity-5 group"
          >
            <span className="text-[9px] font-black text-white opacity-80 group-hover:opacity-100 uppercase tracking-widest">SONRAKİ →</span>
            <span className="text-white font-bold text-[10px] italic mt-1">
                {chapter.next_chapter ? `Bölüm ${chapter.next_chapter}` : "Son Bölüm"}
            </span>
          </button>
        </div>

        {/* --- SERİ SAYFASINA DÖN (BUTONLARIN ALTINDA) --- */}
        <div className="mt-8 flex justify-center">
            <Link href={`/novel/${slug}`} className="px-12 py-3 rounded-full border border-purple-600/40 text-purple-500 font-black text-[9px] tracking-[0.25em] hover:bg-purple-600 hover:text-white transition-all uppercase shadow-lg shadow-purple-900/10">
                SERİ SAYFASINA DÖN
            </Link>
        </div>

        {/* --- YORUMLAR --- */}
        <section className="mt-24">
          <div className="flex items-center gap-4 mb-10">
              <div className="w-1.5 h-6 bg-purple-600 rounded-full"></div>
              <h3 className="text-2xl font-black text-white italic tracking-tight">Yorumlar</h3>
          </div>

          {!isAuthenticated ? (
            <div className="p-8 rounded-[35px] border-2 border-purple-600/20 bg-purple-600/5 text-center mb-10 hover:border-purple-600/40 transition-all">
              <p className="text-gray-400 mb-6 text-xs font-medium">Yorum yapmak için giriş yapmalısın.</p>
              <Link href="/login" className="bg-white text-black px-10 py-3 rounded-full font-black text-[10px] hover:scale-105 transition-transform inline-block shadow-xl">
                GİRİŞ YAP
              </Link>
            </div>
          ) : (
            <form onSubmit={handleCommentSubmit} className="mb-10 bg-[#1a1a1a] p-6 rounded-[25px] border border-white/5 shadow-inner">
                <textarea 
                  className="w-full bg-transparent text-white outline-none resize-none placeholder-gray-600 text-sm"
                  rows="3"
                  placeholder="Düşüncelerini buraya yaz..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  required
                />
                <div className="flex justify-end mt-2">
                    <button type="submit" className="bg-purple-600 text-white px-6 py-2 rounded-full font-black text-[9px] hover:bg-purple-500 transition shadow-lg tracking-wide">
                        GÖNDER
                    </button>
                </div>
            </form>
          )}

          <div className="space-y-4">
            {comments && comments.length > 0 ? (
              comments.map(c => (
                <div key={c.id} className="bg-[#121212] p-5 rounded-2xl border border-white/5 hover:border-purple-500/20 transition-all">
                  <div className="flex justify-between items-center mb-2">
                      <p className="text-purple-500 font-bold text-xs">{c.user_username}</p>
                      <p className="text-[9px] text-gray-700 font-mono">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <p className="text-gray-400 text-xs leading-relaxed">{c.content}</p>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-600 italic py-6 text-sm">Henüz hiç yorum yapılmamış.</p>
            )}
          </div>
        </section>
      </main>

      <style jsx global>{`
        .novel-content p { margin-bottom: 2.2rem; text-align: justify; text-indent: 1.5rem; }
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #6b21a8; border-radius: 10px; }
      `}</style>
    </div>
  );
}