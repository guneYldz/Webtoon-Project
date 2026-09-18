"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

// Herkese açık profil ÖNİZLEME sayfası (salt okunur).
// Şifre değiştirme, fotoğraf yükleme gibi hesap işlemleri BURADA YOKTUR.
export default function KullaniciProfilSayfasi() {
  const params = useParams();
  const username = params?.username ? decodeURIComponent(params.username) : null;

  const [profile, setProfile] = useState(null);
  const [comments, setComments] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState("yorumlar");

  useEffect(() => {
    if (!username) return;
    (async () => {
      try {
        const pRes = await fetch(`${API}/auth/kullanici/${encodeURIComponent(username)}`);
        if (!pRes.ok) {
          setNotFound(true);
          return;
        }
        setProfile(await pRes.json());

        const [cRes, fRes] = await Promise.all([
          fetch(`${API}/comments/kullanici/${encodeURIComponent(username)}`),
          fetch(`${API}/favorites/kullanici/${encodeURIComponent(username)}`),
        ]);
        if (cRes.ok) setComments(await cRes.json());
        if (fRes.ok) setFavorites(await fRes.json());
      } catch (err) {
        console.error("Profil yüklenemedi:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [username]);

  if (loading) {
    return <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-purple-500 font-bold italic">Profil Yükleniyor...</div>;
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center text-gray-400 gap-4">
        <p className="text-xl font-bold">😕 Kullanıcı bulunamadı</p>
        <Link href="/" className="text-blue-400 hover:underline text-sm">Ana sayfaya dön</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-200 pb-20">
      <div className="container mx-auto max-w-4xl px-4 py-10">

        {/* PROFİL BAŞLIĞI */}
        <div className="bg-[#121212] rounded-3xl border border-purple-500/20 p-8 mb-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-24 h-24 rounded-full border-4 border-[#121212] outline outline-2 outline-purple-600 overflow-hidden bg-[#1a1a1a] shrink-0">
            {profile.profile_image ? (
              <img src={`${API}/${profile.profile_image}`} alt={profile.username} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-black text-purple-500 bg-purple-500/10">
                {profile.username?.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start flex-wrap">
              <h1 className="text-2xl font-black text-white">{profile.username}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase ${profile.role === "admin" ? "bg-red-900/50 text-red-200 border border-red-800" :
                profile.role === "editor" ? "bg-yellow-900/50 text-yellow-200 border border-yellow-800" :
                  "bg-blue-900/50 text-blue-200 border border-blue-800"}`}>
                {profile.role || "user"}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-1">
              📅 Katılım: {new Date(profile.created_at).toLocaleDateString("tr-TR")}
            </p>

            {/* İSTATİSTİKLER */}
            <div className="flex gap-6 mt-4 justify-center sm:justify-start">
              <div className="text-center">
                <p className="text-xl font-black text-white">{profile.comment_count}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">💬 Yorum</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-white">{profile.favorite_count}</p>
                <p className="text-xs text-gray-500 uppercase tracking-wider">❤️ Favori</p>
              </div>
            </div>
          </div>
        </div>

        {/* SEKMELER */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          <button
            onClick={() => setTab("yorumlar")}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wider transition border-b-2 ${tab === "yorumlar" ? "text-white border-purple-500" : "text-gray-500 border-transparent hover:text-gray-300"}`}
          >
            Yorumlar ({comments.length})
          </button>
          <button
            onClick={() => setTab("favoriler")}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wider transition border-b-2 ${tab === "favoriler" ? "text-white border-purple-500" : "text-gray-500 border-transparent hover:text-gray-300"}`}
          >
            Favoriler ({favorites.length})
          </button>
        </div>

        {/* YORUMLAR SEKMESİ */}
        {tab === "yorumlar" && (
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-gray-600 text-sm italic">Henüz yorum yapmamış.</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="bg-[#1a1a1a] p-5 rounded-xl border border-gray-800/50">
                  <div className="flex items-center gap-2 mb-2 text-sm flex-wrap">
                    {c.link ? (
                      <Link href={c.link} className="text-blue-400 font-bold hover:underline">
                        {c.seri_title} — {c.bolum_title}
                      </Link>
                    ) : (
                      <span className="text-gray-500 font-bold">{c.seri_title || "Bilinmeyen bölüm"}</span>
                    )}
                    {c.parent_id && <span className="text-xs text-gray-600 bg-gray-800 px-2 py-0.5 rounded-full">↩ yanıt</span>}
                    <span className="text-gray-600 text-xs ml-auto">{new Date(c.created_at).toLocaleDateString("tr-TR")}</span>
                  </div>
                  <p className="text-gray-300 text-sm leading-relaxed break-words">{c.content}</p>
                </div>
              ))
            )}
          </div>
        )}

        {/* FAVORİLER SEKMESİ */}
        {tab === "favoriler" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {favorites.length === 0 ? (
              <p className="text-gray-600 text-sm italic col-span-full">Henüz favori serisi yok.</p>
            ) : (
              favorites.map((f) => (
                <Link key={`${f.type}-${f.id}`} href={f.slug} className="group">
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-gray-800 group-hover:border-purple-500 transition">
                    <img
                      src={f.resim ? `${API}/${f.resim}` : "/placeholder.jpg"}
                      alt={f.baslik}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <span className={`absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded text-white ${f.tag === "NOVEL" || f.type === "novel" ? "bg-purple-600" : f.tag === "MANGA" ? "bg-orange-600" : "bg-blue-600"}`}>
                      {f.tag || (f.type === "webtoon" ? "WEBTOON" : "NOVEL")}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-300 mt-2 truncate group-hover:text-purple-400 transition">{f.baslik}</p>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
