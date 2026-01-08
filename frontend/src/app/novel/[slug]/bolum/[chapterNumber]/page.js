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
  
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [user, setUser] = useState(false);

  const [showNavbar, setShowNavbar] = useState(true);
  const lastScrollY = useRef(0);

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
      .then(data => setComments(Array.isArray(data) ? data : []))
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-blue-500 font-bold tracking-widest text-xs uppercase animate-pulse">Yükleniyor...</span>
    </div>
  );
  
  if (!data) return null;

  const isNovel = data.content_text && data.content_text.length > 0;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center font-sans">
      
      {/* --- ALT NAVBAR (Dinamik Gizlenen) --- */}
      <div 
        className={`fixed bottom-0 left-0 w-full z-50 transition-all duration-500 ease-in-out ${
          showNavbar ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
        }`}
      >
        <div className="flex justify-center w-full px-4 pb-4">
            <div className="w-full max-w-3xl bg-[#161616]/90 backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl flex justify-between items-center text-white h-16 px-6">
                
                <Link href={`/webtoon/${id}`} className="text-gray-400 hover:text-white transition-colors">
                  <span className="text-xl">←</span> 
                </Link>
                
                <div className="flex flex-col items-center">
                    <h2 className="text-[11px] font-black text-gray-100 uppercase tracking-tighter max-w-[150px] truncate">
                      {data.episode_title}
                    </h2>
                    <span className="text-[9px] text-blue-500 font-bold">BÖLÜM {data.episode_number}</span>
                </div>

                <div className="flex gap-3">
                    <button 
                      onClick={() => data.prev_episode_id && router.push(`/webtoon/${id}/bolum/${data.prev_episode_id}`)}
                      disabled={!data.prev_episode_id}
                      className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center disabled:opacity-10 hover:bg-white/10 transition"
                    >
                      <span className="text-xs">◀</span>
                    </button>
                    <button 
                      onClick={() => data.next_episode_id && router.push(`/webtoon/${id}/bolum/${data.next_episode_id}`)}
                      disabled={!data.next_episode_id}
                      className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20 hover:bg-blue-500 transition"
                    >
                      <span className="text-xs">▶</span>
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* --- ANA İÇERİK --- */}
      <div className={`w-full pt-10 pb-20 ${isNovel ? 'max-w-2xl px-6' : 'max-w-3xl'}`}>
        
        {isNovel ? (
            <div className="novel-mode mb-20">
                <h1 className="text-4xl font-black text-white mb-10 leading-tight italic tracking-tighter border-l-4 border-blue-600 pl-6">
                    {data.episode_title}
                </h1>
                <div className="text-gray-300 text-lg md:text-[20px] leading-[2.2] font-serif whitespace-pre-line tracking-wide">
                    {data.content_text}
                </div>
            </div>
        ) : (
            <div className="webtoon-mode bg-black">
                {data.images?.map((img, index) => (
                    <img
                        key={img.id || index}
                        src={`http://127.0.0.1:8000/${img.image_url}`}
                        alt="page"
                        className="w-full h-auto block"
                        loading="lazy"
                    />
                ))}
            </div>
        )}

        {/* --- BÖLÜM SONU BUTONLARI --- */}
        <div className="my-20 flex flex-col items-center px-4">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-12"></div>
            <div className="flex gap-4 w-full justify-center">
                {data.prev_episode_id && (
                  <button onClick={() => router.push(`/webtoon/${id}/bolum/${data.prev_episode_id}`)} className="bg-white/5 border border-white/5 text-white px-8 py-4 rounded-2xl font-bold hover:bg-white/10 transition flex-1 max-w-[200px]">
                    ← Önceki
                  </button>
                )}
                {data.next_episode_id ? (
                  <button onClick={() => router.push(`/webtoon/${id}/bolum/${data.next_episode_id}`)} className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-500 transition flex-1 max-w-[200px]">
                    Sonraki Bölüm
                  </button>
                ) : (
                  <div className="bg-white/5 border border-dashed border-white/10 text-gray-500 px-8 py-4 rounded-2xl font-bold">Seri Sonu</div>
                )}
            </div>
        </div>

        {/* --- YORUM SEKSIYONU (Geliştirilmiş) --- */}
        <div className="comments-section bg-[#111] rounded-[2rem] p-6 sm:p-10 border border-white/5 mx-4 shadow-2xl">
            <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black text-white uppercase italic tracking-widest flex items-center gap-3">
                    <span className="w-2 h-6 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"></span>
                    Yorumlar
                </h3>
                <span className="font-mono text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                    {comments.length} BAŞLIK
                </span>
            </div>

            {user ? (
              <form onSubmit={handleCommentSubmit} className="mb-12 group">
                <div className="relative bg-[#161616] rounded-2xl border border-white/5 focus-within:border-blue-600/50 transition-all p-4">
                  <textarea
                    className="w-full bg-transparent text-white outline-none resize-none placeholder-gray-600 text-sm py-2"
                    rows="3"
                    placeholder="Bölüm hakkında bir şeyler karala..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                  ></textarea>
                  <div className="flex justify-end mt-2">
                    <button type="submit" className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black px-6 py-2 rounded-full uppercase tracking-tighter transition shadow-lg">
                      YAYINLA
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              <div className="mb-12 p-8 bg-blue-600/5 rounded-2xl text-center border border-dashed border-blue-600/20">
                <p className="text-gray-400 mb-4 text-xs font-medium italic">Fikirlerini paylaşmak için giriş yapmalısın.</p>
                <Link href="/login" className="inline-block bg-white text-black px-8 py-2 rounded-full font-black text-[10px] hover:scale-105 transition-transform uppercase tracking-tighter">Giriş Yap</Link>
              </div>
            )}

            <div className="space-y-6">
              {comments.length > 0 ? (
                comments.map((comment) => (
                  <div key={comment.id} className="bg-white/[0.02] p-6 rounded-2xl border border-white/5 hover:bg-white/[0.04] transition-all group">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-900 flex items-center justify-center text-white text-sm font-black shadow-lg shadow-blue-600/10">
                              {comment.user_username?.charAt(0).toUpperCase() || "?"}
                          </div>
                          <div>
                            <span className="font-black text-gray-100 text-[11px] uppercase tracking-wider block">@{comment.user_username}</span>
                            <span className="text-[9px] text-blue-500 font-bold uppercase opacity-60">Okuyucu</span>
                          </div>
                      </div>
                      <span className="text-[9px] text-gray-600 font-mono">{new Date(comment.created_at).toLocaleDateString("tr-TR")}</span>
                    </div>
                    <p className="text-gray-400 text-xs leading-[1.8] font-medium pl-1">{comment.content}</p>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center opacity-20 flex flex-col items-center">
                    <span className="text-4xl mb-4">🌑</span>
                    <p className="text-xs font-black uppercase tracking-widest">Burada henüz kimse yok...</p>
                </div>
              )}
            </div>
        </div>
      </div>
    </div>
  );
}