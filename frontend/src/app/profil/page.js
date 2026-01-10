"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

const API = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

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
      } else {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
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
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col items-center justify-center text-gray-200">
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
        <p className="text-gray-500 text-xs text-center mb-6">{user?.email}</p>

        {/* Butonlar */}
        <div className="space-y-3 mb-6">
            <button onClick={() => setShowEditModal(true)} className="w-full py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-bold hover:bg-[#222] transition">✏️ Bilgileri Düzenle</button>
            <button onClick={() => setShowPassModal(true)} className="w-full py-3 bg-[#1a1a1a] border border-white/10 rounded-xl text-sm font-bold hover:bg-[#222] transition">🔒 Şifre Değiştir</button>
        </div>

        <button onClick={handleLogout} className="w-full py-4 rounded-xl bg-red-500/10 text-red-500 font-bold text-xs hover:bg-red-500 hover:text-white transition uppercase tracking-widest">Çıkış Yap</button>
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