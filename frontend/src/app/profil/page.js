"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Modal State'leri
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  
  // Form State'leri
  const [editForm, setEditForm] = useState({ username: "", email: "" });
  const [passForm, setPassForm] = useState({ old_password: "", new_password: "" });

  // Aktivite (yorumlar + favoriler)
  const [comments, setComments] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [tab, setTab] = useState("yorumlar");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/login"); return; }
    fetchProfile(token);
  }, []);

  const fetchProfile = async (token) => {
    try {
      const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setEditForm({ username: data.username, email: data.email });
        fetchActivity(data.username, token);
      } else {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  // Kullanıcının yorumlarını ve favorilerini çek
  const fetchActivity = async (username, token) => {
    try {
      const [cRes, fRes] = await Promise.all([
        fetch(`${API}/comments/kullanici/${encodeURIComponent(username)}`),
        fetch(`${API}/favorites/listele`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (cRes.ok) setComments(await cRes.json());
      if (fRes.ok) setFavorites(await fRes.json());
    } catch (err) { console.error("Aktivite yüklenemedi:", err); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API}/auth/update-profile-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) fetchProfile(token);
      else alert("Resim yüklenirken hata oluştu!");
    } catch (err) { console.error(err); } finally { setUploading(false); }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/auth/update-profile`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(editForm)
        });
        if (res.ok) {
            alert("Bilgiler güncellendi!");
            setShowEditModal(false);
            fetchProfile(token);
        } else {
            const err = await res.json();
            alert(err.detail);
        }
    } catch (error) { console.error(error); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    try {
        const res = await fetch(`${API}/auth/change-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(passForm)
        });
        if (res.ok) {
            alert("Şifre değiştirildi!");
            setShowPassModal(false);
            setPassForm({ old_password: "", new_password: "" });
        } else {
            const err = await res.json();
            alert(err.detail);
        }
    } catch (error) { console.error(error); }
  };

  const handleLogout = () => { localStorage.removeItem("token"); router.push("/login"); };

  if (loading) return <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-purple-500 font-bold italic">Profil Yükleniyor...</div>;

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center text-gray-200 py-10 px-4">
      <div className="w-full max-w-md bg-[#121212] p-8 rounded-[40px] border border-purple-500/20 shadow-2xl relative overflow-hidden">
        
        {/* Profil Resmi */}
        <div className="relative w-32 h-32 mx-auto mb-6 group">
            <div className="w-full h-full rounded-full border-4 border-[#121212] outline outline-2 outline-purple-600 overflow-hidden bg-[#1a1a1a]">
                {user?.profile_image ? (
                    <img src={`${API}/${user.profile_image}`} alt="Profil" className="w-full h-full object-cover"/>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-black text-purple-500 bg-purple-500/10">
                        {user?.username?.charAt(0).toUpperCase()}
                    </div>
                )}
            </div>
            <label className="absolute bottom-0 right-0 bg-purple-600 hover:bg-white hover:text-purple-600 text-white p-2 rounded-full cursor-pointer transition-all border-2 border-[#121212]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg>
                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={uploading} />
            </label>
        </div>

        <h1 className="text-2xl font-black text-white text-center mb-1">{user?.username}</h1>
        <p className="text-gray-500 text-sm text-center mb-6">{user?.email}</p>

        {/* Butonlar */}
        <div className="space-y-3 mb-6">
            <button onClick={() => setShowEditModal(true)} className="w-full py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-bold hover:bg-[#222] transition">✏️ Bilgileri Düzenle</button>
            <button onClick={() => setShowPassModal(true)} className="w-full py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-bold hover:bg-[#222] transition">🔒 Şifre Değiştir</button>
        </div>

        <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-bold text-sm hover:bg-red-500 hover:text-white transition uppercase tracking-widest">Çıkış Yap</button>
      </div>

      {/* ============ AKTİVİTE BÖLÜMÜ ============ */}
      <div className="w-full max-w-4xl mt-10">

        {/* İSTATİSTİKLER */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-[#121212] rounded-2xl border border-gray-800 p-5 text-center">
            <p className="text-3xl font-black text-white">{comments.length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">💬 Toplam Yorum</p>
          </div>
          <div className="bg-[#121212] rounded-2xl border border-gray-800 p-5 text-center">
            <p className="text-3xl font-black text-white">{favorites.length}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">❤️ Favori Seri</p>
          </div>
        </div>

        {/* SEKMELER */}
        <div className="flex gap-2 mb-6 border-b border-gray-800">
          <button
            onClick={() => setTab("yorumlar")}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wider transition border-b-2 ${tab === "yorumlar" ? "text-white border-purple-500" : "text-gray-500 border-transparent hover:text-gray-300"}`}
          >
            Yorumlarım ({comments.length})
          </button>
          <button
            onClick={() => setTab("favoriler")}
            className={`px-5 py-3 text-sm font-bold uppercase tracking-wider transition border-b-2 ${tab === "favoriler" ? "text-white border-purple-500" : "text-gray-500 border-transparent hover:text-gray-300"}`}
          >
            Favorilerim ({favorites.length})
          </button>
        </div>

        {/* YORUMLARIM */}
        {tab === "yorumlar" && (
          <div className="space-y-4">
            {comments.length === 0 ? (
              <p className="text-gray-600 text-sm italic">Henüz yorum yapmadın.</p>
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

        {/* FAVORİLERİM */}
        {tab === "favoriler" && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
            {favorites.length === 0 ? (
              <p className="text-gray-600 text-sm italic col-span-full">Henüz favori serin yok.</p>
            ) : (
              favorites.map((f) => (
                <Link key={`${f.type}-${f.id}`} href={f.slug} className="group">
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-gray-800 group-hover:border-purple-500 transition">
                    <img
                      src={f.resim ? `${API}/${f.resim}` : "/placeholder.jpg"}
                      alt={f.baslik}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <span className={`absolute top-1.5 left-1.5 text-[10px] font-black px-1.5 py-0.5 rounded text-white ${f.type === "webtoon" ? "bg-blue-600" : "bg-purple-600"}`}>
                      {f.type === "webtoon" ? "WEBTOON" : "NOVEL"}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-300 mt-2 truncate group-hover:text-purple-400 transition">{f.baslik}</p>
                </Link>
              ))
            )}
          </div>
        )}
      </div>

      {/* --- EDİT MODAL --- */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] p-6 rounded-2xl w-full max-w-sm border border-gray-700">
                <h3 className="text-xl font-bold mb-4">Profili Düzenle</h3>
                <input type="text" value={editForm.username} onChange={e => setEditForm({...editForm, username: e.target.value})} className="w-full p-3 bg-[#121212] rounded-lg mb-3 text-white border border-gray-700" placeholder="Kullanıcı Adı" />
                <input type="email" value={editForm.email} onChange={e => setEditForm({...editForm, email: e.target.value})} className="w-full p-3 bg-[#121212] rounded-lg mb-4 text-white border border-gray-700" placeholder="E-posta" />
                <div className="flex gap-2">
                    <button onClick={() => setShowEditModal(false)} className="flex-1 p-3 rounded-lg bg-gray-700 text-white font-bold">İptal</button>
                    <button onClick={handleUpdateProfile} className="flex-1 p-3 rounded-lg bg-purple-600 text-white font-bold">Kaydet</button>
                </div>
            </div>
        </div>
      )}

      {/* --- ŞİFRE MODAL --- */}
      {showPassModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-[#1a1a1a] p-6 rounded-2xl w-full max-w-sm border border-gray-700">
                <h3 className="text-xl font-bold mb-4">Şifre Değiştir</h3>
                <input type="password" value={passForm.old_password} onChange={e => setPassForm({...passForm, old_password: e.target.value})} className="w-full p-3 bg-[#121212] rounded-lg mb-3 text-white border border-gray-700" placeholder="Eski Şifre" />
                <input type="password" value={passForm.new_password} onChange={e => setPassForm({...passForm, new_password: e.target.value})} className="w-full p-3 bg-[#121212] rounded-lg mb-4 text-white border border-gray-700" placeholder="Yeni Şifre" />
                <div className="flex gap-2">
                    <button onClick={() => setShowPassModal(false)} className="flex-1 p-3 rounded-lg bg-gray-700 text-white font-bold">İptal</button>
                    <button onClick={handleChangePassword} className="flex-1 p-3 rounded-lg bg-purple-600 text-white font-bold">Değiştir</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}