"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

export default function ReadingPage() {
  const params = useParams();
  const { id, episodeId } = params;
  const router = useRouter();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Yorum State'leri
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [user, setUser] = useState(false);

  // --- NAVBAR GİZLEME MANTIĞI ---
  const [showNavbar, setShowNavbar] = useState(true);
  const lastScrollY = useRef(0);

  // 1. VERİLERİ ÇEK
  useEffect(() => {
    setLoading(true);
    
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("token");
        if (token) setUser(true);
    }

    fetch(`http://127.0.0.1:8000/episodes/${episodeId}/read`)
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
        router.push(`/webtoon/${id}`);
      });

    fetchComments();
  }, [episodeId, id, router]);

  // --- SCROLL DİNLEYİCİSİ ---
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

  const fetchComments = () => {
    fetch(`http://127.0.0.1:8000/comments/${episodeId}`)
      .then(res => res.json())
      .then(data => setComments(data))
      .catch(err => console.error("Yorumlar alınamadı", err));
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Yorum yapmak için giriş yapmalısın!");
      router.push("/login");
      return;
    }

    try {
      const res = await fetch("http://127.0.0.1:8000/comments/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          episode_id: episodeId,
          content: newComment
        })
      });

      if (res.ok) {
        setNewComment(""); 
        fetchComments(); 
        alert("Yorumun gönderildi! ✍️");
      } else {
        alert("Yorum gönderilemedi. Lütfen giriş yapın.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center">Yükleniyor...</div>;
  if (!data) return null;

  // --- YENİ KONTROL: Bu bir Novel mi? ---
  // content_text varsa ve doluysa novel moduna geçeceğiz.
  const isNovel = data.content_text && data.content_text.length > 0;

  return (
    <div className="min-h-screen bg-[#121212] flex flex-col items-center font-sans">
      
      {/* --- ALT BAR (NAVBAR) --- */}
      <div 
        className={`fixed bottom-0 left-0 w-full z-50 transition-transform duration-300 ease-in-out ${
          showNavbar ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex justify-center w-full">
            <div className="w-full max-w-3xl bg-[#1a1a1a]/95 backdrop-blur-md border-t border-gray-800 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.5)] flex justify-between items-center text-white h-16 px-4">
                
                {/* Sol: Geri Dön */}
                <Link href={`/webtoon/${id}`} className="text-gray-300 hover:text-white font-medium flex items-center gap-2 transition group">
                  <span className="text-xl group-hover:-translate-x-1 transition">←</span> 
                  <span className="hidden sm:inline">Seriye Dön</span>
                </Link>
                
                {/* Orta: Başlık */}
                <div className="flex flex-col items-center justify-center">
                    <h2 className="text-sm font-bold text-gray-100 max-w-[120px] sm:max-w-xs truncate text-center leading-tight">
                      {data.episode_title}
                    </h2>
                    <span className="text-[10px] text-blue-400 font-bold">#{data.episode_number}</span>
                </div>

                {/* Sağ: Butonlar */}
                <div className="flex gap-2">
                    <button 
                      onClick={() => data.prev_episode_id && router.push(`/webtoon/${id}/bolum/${data.prev_episode_id}`)}
                      disabled={!data.prev_episode_id}
                      className="px-3 py-1.5 rounded bg-gray-700 text-xs disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-600 transition"
                    >
                      Önceki
                    </button>
                    <button 
                      onClick={() => data.next_episode_id && router.push(`/webtoon/${id}/bolum/${data.next_episode_id}`)}
                      disabled={!data.next_episode_id}
                      className="px-3 py-1.5 rounded bg-blue-600 text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-500 transition shadow-lg shadow-blue-900/20"
                    >
                      Sonraki
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* --- ANA İÇERİK ALANI --- */}
      {/* Novel ise padding ekliyoruz, Webtoon ise siyah arka plan ve padding yok */}
      <div 
        className={`w-full min-h-screen pt-10 pb-32 z-10 ${
            isNovel ? 'max-w-3xl px-6 md:px-12' : 'max-w-3xl bg-black shadow-[0_0_50px_-10px_rgba(0,0,0,0.5)]'
        }`}
      >
        
        {isNovel ? (
            // ==========================
            // 📖 NOVEL OKUMA MODU
            // ==========================
            <div className="novel-container">
                {/* Novel Başlığı */}
                <h1 className="text-3xl md:text-4xl font-bold text-white mb-8 border-b border-gray-800 pb-6 leading-tight">
                    {data.title}
                </h1>

                {/* METİN GÖSTERİMİ:
                    - font-serif: Kitap okuma hissi için tırnaklı yazı tipi.
                    - whitespace-pre-line: Veritabanındaki satır başlarını (\n) algılar.
                    - leading-loose: Satır aralarını açar, okumayı kolaylaştırır.
                */}
                <div className="text-gray-300 text-lg md:text-xl leading-loose font-serif whitespace-pre-line tracking-wide">
                    {data.content_text}
                </div>
            </div>
        ) : (
            // ==========================
            // 🖼️ WEBTOON OKUMA MODU (Eski Kodun)
            // ==========================
            <>
                {data.images && data.images.length > 0 ? (
                    data.images.map((img) => (
                    <img
                        key={img.id}
                        src={`http://127.0.0.1:8000/${img.image_url}`}
                        alt={`Sayfa ${img.page_order}`}
                        className="w-full h-auto block" 
                        loading="lazy"
                    />
                    ))
                ) : (
                    <div className="py-40 text-center text-gray-500 flex flex-col items-center">
                        <span className="text-4xl mb-2">📄</span>
                        <span>Görsel Yok</span>
                    </div>
                )}
            </>
        )}
      </div>

      {/* --- ALT KISIM (Bölüm Sonu & Yorumlar) --- */}
      <div className="w-full max-w-3xl bg-[#1e1e1e] border-t border-gray-800 pb-32 shadow-2xl z-10">
        <div className="p-8 sm:p-12 text-center border-b border-gray-800 bg-[#1a1a1a]">
          <h3 className="text-xl font-bold mb-8 text-white">Bölüm Sonu 🎉</h3>
          <div className="flex justify-center gap-4">
            {data.prev_episode_id && (
              <Link href={`/webtoon/${id}/bolum/${data.prev_episode_id}`} className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-medium transition w-full sm:w-auto">
                ← Önceki
              </Link>
            )}
            {data.next_episode_id ? (
              <Link href={`/webtoon/${id}/bolum/${data.next_episode_id}`} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg shadow-blue-900/20 transition w-full sm:w-auto">
                Sonraki Bölüm →
              </Link>
            ) : (
              <div className="bg-gray-800 text-gray-500 px-6 py-3 rounded-lg cursor-not-allowed border border-gray-700 w-full sm:w-auto">Son Bölüm</div>
            )}
          </div>
        </div>
        
        {/* Yorumlar... */}
        <div className="p-6 sm:p-10">
           <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            💬 Yorumlar <span className="text-sm bg-gray-800 px-2 py-0.5 rounded text-gray-400">{comments.length}</span>
           </h3>
           
           {user ? (
            <form onSubmit={handleCommentSubmit} className="mb-10">
               <div className="relative">
                <textarea
                  className="w-full p-4 bg-[#121212] text-white border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none transition resize-none shadow-inner"
                  rows="3"
                  placeholder="Bölüm hakkında düşüncelerin..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  required
                ></textarea>
                <button type="submit" className="absolute bottom-3 right-3 bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-1.5 rounded font-bold transition">
                  Gönder
                </button>
              </div>
            </form>
           ) : (
             <div className="mb-10 p-6 bg-[#252525] rounded-lg text-center border border-dashed border-gray-700">
              <p className="text-gray-400 mb-2 text-sm">Yorum yapmak için giriş yapmalısın.</p>
              <Link href="/login" className="text-blue-400 font-bold hover:underline text-sm">Giriş Yap</Link>
            </div>
           )}

           <div className="space-y-4">
            {comments.map((comment) => (
                <div key={comment.id} className="bg-[#252525] p-4 rounded-lg border border-gray-800 hover:border-gray-600 transition">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow">
                            {comment.user_username.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-gray-200 text-sm">{comment.user_username}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">{new Date(comment.created_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                  <p className="text-gray-300 text-sm pl-10 leading-relaxed">{comment.content}</p>
                </div>
              ))}
           </div>
        </div>
      </div>
    </div>
  );
}