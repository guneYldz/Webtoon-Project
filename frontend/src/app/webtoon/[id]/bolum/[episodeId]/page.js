"use client";

import { useEffect, useState } from "react";
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
  const [user, setUser] = useState(null); // Giriş yapmış kullanıcı var mı?

  // 1. VERİLERİ ÇEK
  useEffect(() => {
    setLoading(true);
    
    // Kullanıcı giriş yapmış mı?
    const token = localStorage.getItem("token");
    if (token) setUser(true); 

    // Bölüm Verisini Çek
    fetch(`http://127.0.0.1:8000/episodes/${episodeId}/read`)
      .then((res) => {
        if (!res.ok) throw new Error("Bölüm bulunamadı");
        return res.json();
      })
      .then((result) => {
        setData(result);
        setLoading(false);
        // Sayfa değişince en tepeye çık
        window.scrollTo(0, 0);
      })
      .catch((err) => {
        console.error(err);
        router.push(`/webtoon/${id}`);
      });

    // Yorumları Çek
    fetchComments();

  }, [episodeId, id, router]);

  const fetchComments = () => {
    fetch(`http://127.0.0.1:8000/comments/${episodeId}`)
      .then(res => res.json())
      .then(data => setComments(data))
      .catch(err => console.error("Yorumlar alınamadı", err));
  };

  // 2. YORUM GÖNDERME
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
        setNewComment(""); // Kutuyu temizle
        fetchComments();   // Listeyi yenile
        alert("Yorumun gönderildi! ✍️");
      } else {
        alert("Yorum gönderilemedi. Lütfen kayır olun");
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center pb-20">
      
      {/* ÜST MENU */}
      <div className="w-full bg-gray-800 text-white p-4 flex justify-between items-center sticky top-0 z-50 shadow-lg opacity-95">
        <Link href={`/webtoon/${id}`} className="text-gray-300 hover:text-white font-medium">
          ← Listeye Dön
        </Link>
        <h2 className="text-sm font-bold hidden md:block">{data.episode_title}</h2>
        <div></div>
      </div>

      {/* --- RESİMLER --- */}
      <div className="w-full max-w-3xl bg-black shadow-2xl">
        {data.images.map((img) => (
          <img
            key={img.id}
            src={`http://127.0.0.1:8000/${img.image_url}`}
            alt={`Sayfa ${img.page_order}`}
            className="w-full block"
          />
        ))}
      </div>

      {/* --- ALT KISIM (BUTONLAR & YORUMLAR) --- */}
      <div className="w-full max-w-3xl bg-gray-800 text-white mt-10 rounded-t-lg overflow-hidden">
        
        {/* Navigasyon Butonları */}
        <div className="p-8 text-center border-b border-gray-700">
          <h3 className="text-xl font-bold mb-6">Bölüm Sonu 🎉</h3>
          <div className="flex justify-center gap-4">
            {data.prev_episode_id && (
              <Link href={`/webtoon/${id}/bolum/${data.prev_episode_id}`} className="bg-gray-700 px-6 py-3 rounded-full">
                ← Önceki
              </Link>
            )}
            {data.next_episode_id ? (
              <Link href={`/webtoon/${id}/bolum/${data.next_episode_id}`} className="bg-blue-600 px-8 py-3 rounded-full">
                Sonraki Bölüm →
              </Link>
            ) : (
              <div className="bg-gray-700 text-gray-400 px-6 py-3 rounded-full cursor-not-allowed">Son Bölüm</div>
            )}
          </div>
        </div>

        {/* 👇 YORUMLAR BURADA 👇 */}
        <div className="p-8 bg-gray-900">
          <h3 className="text-lg font-bold mb-4">💬 Yorumlar ({comments.length})</h3>

          {/* Yorum Formu (Sadece giriş yapanlar görür) */}
          {user ? (
            <form onSubmit={handleCommentSubmit} className="mb-8">
              <textarea
                className="w-full p-3 bg-gray-800 text-white border border-gray-700 rounded"
                rows="3"
                placeholder="Bölüm hakkında ne düşünüyorsun?"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                required
              ></textarea>
              <button type="submit" className="mt-2 bg-green-600 text-white px-6 py-2 rounded font-bold">
                Gönder
              </button>
            </form>
          ) : (
            <div className="mb-8 p-4 bg-gray-800 rounded text-center text-gray-400">
              Yorum yapmak için <Link href="/login" className="text-blue-400">Giriş Yap</Link>
            </div>
          )}

          {/* Yorum Listesi */}
          <div className="space-y-4">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="bg-gray-800 p-4 rounded border border-gray-700">
                  <div className="flex justify-between mb-2">
                    <span className="font-bold text-blue-400">{comment.user_username}</span>
                    <span className="text-xs text-gray-500">{new Date(comment.created_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                  <p className="text-gray-300">{comment.content}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center italic">Henüz yorum yok. İlk yorumu sen yap!</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}