"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API } from "@/api";

export default function CommentSection({ type, itemId, episodeId = null, chapterId = null }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- Giriş Kontrolü ve Yorumları Çekme ---
  useEffect(() => {
    // 1. Kullanıcı giriş yapmış mı?
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("token");
      setIsAuthenticated(!!token);
    }

    // 2. Yorumları Getir
    loadComments();
  }, [itemId, episodeId, chapterId]);

  const loadComments = async () => {
    try {
      let url = "";
      
      // Hangi türün yorumlarını çekeceğiz?
      if (type === "webtoon" && episodeId) {
        url = `${API}/comments/webtoon/${episodeId}`;
      } else if (type === "novel" && chapterId) {
        url = `${API}/comments/novel/${chapterId}`;
      } else {
        // Eğer ID'ler henüz gelmediyse bekle
        return;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setComments(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Yorumlar yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
        alert("Lütfen önce giriş yapın!");
        return;
    }

    // Gönderilecek Veri Paketi
    const payload = {
        content: newComment,
    };

    // Hangi ID'yi göndereceğiz?
    if (type === "webtoon") {
        payload.webtoon_episode_id = episodeId;
    } else {
        payload.novel_chapter_id = chapterId;
    }

    try {
      const res = await fetch(`${API}/comments/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        // Başarılıysa temizle ve yeniden yükle
        setNewComment("");
        loadComments();
      } else {
        // 🚨 HATA DÜZELTMESİ BURADA:
        // Eskiden alert(data) yapıldığı için [object Object] diyordu.
        // Şimdi data.detail diyerek içindeki mesajı okuyoruz.
        alert(data.detail || "Yorum gönderilirken bir hata oluştu.");
      }

    } catch (err) {
      console.error("Yorum hatası:", err);
      alert("Sunucuyla bağlantı kurulamadı.");
    }
  };

  if (loading) return <div className="text-gray-500 text-sm py-4">Yorumlar yükleniyor...</div>;

  return (
    <section>
        {/* Başlık */}
        <div className="flex items-center gap-3 mb-8">
            <h3 className="text-xl md:text-2xl font-bold text-white">Yorumlar</h3>
            <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg border border-blue-400">
                {comments.length}
            </span>
        </div>

        {/* Yorum Yapma Formu */}
        {!isAuthenticated ? (
            <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-dashed border-gray-700 text-center mb-10">
                <p className="text-gray-400 mb-4 text-sm">Yorum yapmak ve tartışmaya katılmak için giriş yapmalısın.</p>
                <Link href="/login" className="px-6 py-2.5 bg-white text-black rounded-full font-bold text-xs hover:bg-blue-500 hover:text-white transition-all shadow-lg">
                    Giriş Yap
                </Link>
            </div>
        ) : (
            <form onSubmit={handleCommentSubmit} className="mb-10 relative group">
                <textarea 
                    className="w-full bg-[#1a1a1a] text-gray-200 p-4 rounded-xl border border-gray-800 outline-none focus:border-blue-500/50 focus:bg-[#202020] transition-all resize-none min-h-[120px] text-sm placeholder:text-gray-600 shadow-inner"
                    placeholder="Bölüm hakkında ne düşünüyorsun?"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    required
                />
                <button 
                    type="submit" 
                    className="absolute bottom-4 right-4 bg-white text-black hover:bg-blue-600 hover:text-white px-5 py-2 rounded-full text-xs font-bold transition-all shadow-lg"
                >
                    GÖNDER
                </button>
            </form>
        )}

        {/* Yorum Listesi */}
        <div className="space-y-4">
            {comments.length === 0 ? (
                <p className="text-gray-600 text-sm italic">Henüz yorum yapılmamış. İlk yorumu sen yap!</p>
            ) : (
                comments.map((c) => (
                    <div key={c.id} className="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-all flex gap-4">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
                            {c.user_username ? c.user_username[0].toUpperCase() : "?"}
                        </div>
                        
                        {/* İçerik */}
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="text-blue-400 font-bold text-sm">{c.user_username}</span>
                                <span className="text-[10px] text-gray-600">• {new Date(c.created_at).toLocaleDateString()}</span>
                            </div>
                            <p className="text-gray-300 text-sm leading-relaxed">{c.content}</p>
                        </div>
                    </div>
                ))
            )}
        </div>
    </section>
  );
}