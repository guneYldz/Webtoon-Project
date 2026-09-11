"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { API } from "@/api";

// Profil fotoğrafı varsa onu, yoksa baş harfli daireyi gösterir.
// username varsa /kullanici/[username] profil önizlemesine tıklanabilir.
function Avatar({ username, image, sizeClass = "w-10 h-10", textClass = "text-sm" }) {
  const avatar = image ? (
    <img
      src={`${API}/${image}`}
      alt={username || "avatar"}
      className={`${sizeClass} rounded-full object-cover shadow-md shrink-0 border border-gray-700`}
    />
  ) : (
    <div className={`${sizeClass} rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold ${textClass} shadow-md shrink-0`}>
      {username ? username[0].toUpperCase() : "?"}
    </div>
  );

  if (!username) return avatar;
  return (
    <Link href={`/kullanici/${encodeURIComponent(username)}`} className="shrink-0 hover:opacity-80 transition" title={`${username} profili`}>
      {avatar}
    </Link>
  );
}

export default function CommentSection({ type, itemId, episodeId = null, chapterId = null }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  // Yanıt sistemi: hangi yorumun altında yanıt formu açık?
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");

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

  // Bildirimden #comment-ID ile gelindiyse ilgili yoruma kaydır
  useEffect(() => {
    if (loading || comments.length === 0) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash.startsWith("#comment-")) return;
    const tryScroll = () => {
      const el = document.querySelector(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-blue-500");
        setTimeout(() => el.classList.remove("ring-2", "ring-blue-500"), 2500);
        return true;
      }
      return false;
    };
    if (!tryScroll()) {
      // Yanıt henüz DOM'a oturmamış olabilir
      setTimeout(tryScroll, 300);
    }
  }, [loading, comments]);

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

  // Ortak gönderim: parentId null ise ana yorum, doluysa yanıt
  const submitComment = async (content, parentId = null) => {
    if (!content.trim()) return false;

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Lütfen önce giriş yapın!");
      return false;
    }

    const payload = { content };

    if (parentId) {
      payload.parent_id = parentId;
    }
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
        loadComments();
        return true;
      } else {
        alert(data.detail || "Yorum gönderilirken bir hata oluştu.");
        return false;
      }
    } catch (err) {
      console.error("Yorum hatası:", err);
      alert("Sunucuyla bağlantı kurulamadı.");
      return false;
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    const ok = await submitComment(newComment);
    if (ok) setNewComment("");
  };

  const handleReplySubmit = async (e, parentId) => {
    e.preventDefault();
    const ok = await submitComment(replyText, parentId);
    if (ok) {
      setReplyText("");
      setReplyingTo(null);
    }
  };

  if (loading) return <div className="text-gray-500 text-sm py-4">Yorumlar yükleniyor...</div>;

  // --- Yorumları ağaca çevir: ana yorumlar + altlarındaki yanıtlar ---
  const rootComments = comments.filter((c) => !c.parent_id);
  const repliesByParent = {};
  comments.forEach((c) => {
    if (c.parent_id) {
      if (!repliesByParent[c.parent_id]) repliesByParent[c.parent_id] = [];
      repliesByParent[c.parent_id].push(c);
    }
  });
  // Yanıtlar eskiden yeniye sıralansın (sohbet akışı gibi okunur)
  Object.values(repliesByParent).forEach((list) =>
    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  );

  const renderReplyForm = (parentId) => (
    <form onSubmit={(e) => handleReplySubmit(e, parentId)} className="mt-3 relative">
      <textarea
        className="w-full bg-[#141414] text-gray-200 p-3 rounded-lg border border-gray-800 outline-none focus:border-blue-500/50 transition-all resize-none min-h-[70px] text-sm placeholder:text-gray-600"
        placeholder="Yanıtını yaz..."
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        autoFocus
        required
      />
      <div className="flex justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={() => { setReplyingTo(null); setReplyText(""); }}
          className="px-4 py-1.5 rounded-full text-xs font-bold text-gray-400 hover:text-white transition"
        >
          Vazgeç
        </button>
        <button
          type="submit"
          className="bg-white text-black hover:bg-blue-600 hover:text-white px-4 py-1.5 rounded-full text-xs font-bold transition-all shadow"
        >
          YANITLA
        </button>
      </div>
    </form>
  );

  // isReply=true iken yanıt butonu KÖK yorumun id'sini kullanır;
  // böylece yanıta verilen yanıt da aynı zincirin altında görünür.
  const renderCommentBody = (c, isReply = false, rootId = null) => {
    const replyTarget = rootId || c.id;
    // Aynı zincirde iki form açılmasın diye form anahtarı yorumun kendi id'si
    const formKey = c.id;

    return (
      <div className="flex gap-4">
        {/* Avatar */}
        <Avatar
          username={c.user_username}
          image={c.user_profile_image}
          sizeClass={isReply ? "w-8 h-8" : "w-10 h-10"}
          textClass={isReply ? "text-xs" : "text-sm"}
        />

        {/* İçerik */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Link
              href={`/kullanici/${encodeURIComponent(c.user_username)}`}
              className="text-blue-400 font-bold text-sm hover:underline"
            >
              {c.user_username}
            </Link>
            <span className="text-sm text-gray-600">• {new Date(c.created_at).toLocaleDateString()}</span>
          </div>
          <p className="text-gray-300 text-sm leading-relaxed break-words">{c.content}</p>

          {isAuthenticated && (
            <button
              onClick={() => {
                setReplyingTo(replyingTo === formKey ? null : formKey);
                setReplyText("");
              }}
              className="mt-2 text-xs font-bold text-gray-500 hover:text-blue-400 transition"
            >
              ↩ Yanıtla
            </button>
          )}

          {replyingTo === formKey && renderReplyForm(replyTarget)}
        </div>
      </div>
    );
  };

  return (
    <section>
      {/* Başlık */}
      <div className="flex items-center gap-3 mb-8">
        <h3 className="text-xl md:text-2xl font-bold text-white">Yorumlar</h3>
        <span className="bg-blue-600 text-white text-sm font-bold px-2 py-1 rounded-full shadow-lg border border-blue-400">
          {comments.length}
        </span>
      </div>

      {/* Yorum Yapma Formu */}
      {!isAuthenticated ? (
        <div className="bg-[#1a1a1a] p-8 rounded-2xl border border-dashed border-gray-700 text-center mb-10">
          <p className="text-gray-400 mb-4 text-sm">Yorum yapmak ve tartışmaya katılmak için giriş yapmalısın.</p>
          <Link href="/login" className="px-6 py-2.5 bg-white text-black rounded-full font-bold text-sm hover:bg-blue-500 hover:text-white transition-all shadow-lg">
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
            className="absolute bottom-4 right-4 bg-white text-black hover:bg-blue-600 hover:text-white px-5 py-2 rounded-full text-sm font-bold transition-all shadow-lg"
          >
            GÖNDER
          </button>
        </form>
      )}

      {/* Yorum Listesi */}
      <div className="space-y-4">
        {rootComments.length === 0 ? (
          <p className="text-gray-600 text-sm italic">Henüz yorum yapılmamış. İlk yorumu sen yap!</p>
        ) : (
          rootComments.map((c) => (
            <div
              key={c.id}
              id={`comment-${c.id}`}
              className="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-all scroll-mt-24"
            >
              {renderCommentBody(c)}

              {/* Yanıtlar */}
              {repliesByParent[c.id] && repliesByParent[c.id].length > 0 && (
                <div className="mt-4 ml-6 md:ml-12 space-y-3 border-l-2 border-gray-800 pl-4">
                  {repliesByParent[c.id].map((r) => (
                    <div
                      key={r.id}
                      id={`comment-${r.id}`}
                      className="bg-[#141414] p-4 rounded-lg border border-gray-800/50 scroll-mt-24"
                    >
                      {renderCommentBody(r, true, c.id)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
