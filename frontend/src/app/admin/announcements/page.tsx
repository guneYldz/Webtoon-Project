"use client";

import { useState, useEffect } from "react";

type Announcement = {
  id: number;
  title: string;
  message: string;
  link?: string | null;
  image?: string | null;
  created_at?: string | null;
  author?: string | null;
};

export default function AdminAnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

  const getToken = () => sessionStorage.getItem("admin_token");

  const setImage = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setImageFile(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const fetchList = async () => {
    const token = getToken();
    if (!token) {
      window.location.href = "/login-admin";
      return;
    }
    try {
      const res = await fetch(`${API}/admin/announcements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === "success") setItems(data.data);
      } else if (res.status === 401) {
        window.location.href = "/login-admin";
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchList();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert("Başlık ve mesaj zorunlu");
      return;
    }
    if (!confirm("Bu duyuru tüm aktif kullanıcılara bildirim olarak gidecek. Devam?")) return;

    setSending(true);
    setSuccess(null);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("message", message.trim());
      if (link.trim()) form.append("link", link.trim());
      if (imageFile) form.append("image", imageFile);

      const res = await fetch(`${API}/admin/announcements`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form,
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSuccess(data.message);
        setTitle("");
        setMessage("");
        setLink("");
        setImage(null);
        fetchList();
      } else {
        alert(data.detail || "Duyuru gönderilemedi");
      }
    } catch (err) {
      alert("Hata: " + (err as Error).message);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async (id: number, itemTitle: string) => {
    if (!confirm(`"${itemTitle}" duyurusunu silmek istediğinden emin misin?`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API}/admin/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const data = await res.json();
      if (data.status === "success") {
        setItems((prev) => prev.filter((item) => item.id !== id));
      } else {
        alert(data.detail || data.message || "Duyuru silinemedi");
      }
    } catch (err) {
      alert("Silme hatası: " + (err as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-3xl font-bold mb-2">📢 Duyuru Gönder</h1>
      <p className="text-gray-500 text-sm mb-6">
        Yazacağın duyuru tüm aktif kullanıcıların bildirim ziline düşer. İstersen fotoğraf ve link de ekleyebilirsin.
      </p>

      <form onSubmit={handleCreate} className="bg-white rounded-xl shadow p-6 space-y-4 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Başlık</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Örn: Yeni özellik yayında!"
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mesaj</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Duyuru metnini yaz..."
            className="w-full px-4 py-2 border rounded-lg resize-y"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Fotoğraf (opsiyonel)</label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={(e) => setImage(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-purple-50 file:text-purple-700 file:font-semibold hover:file:bg-purple-100"
          />
          <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP veya GIF. Duyurular sayfasında görünür.</p>
          {preview && (
            <div className="mt-3 relative">
              <img src={preview} alt="Önizleme" className="max-h-56 rounded-lg border object-contain bg-gray-50 w-full" />
              <button type="button" onClick={() => setImage(null)} className="mt-2 text-xs font-semibold text-red-600 hover:underline">
                Fotoğrafı kaldır
              </button>
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Link (opsiyonel)</label>
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/novel/shadow-slave veya https://..."
            className="w-full px-4 py-2 border rounded-lg"
          />
          <p className="text-xs text-gray-400 mt-1">Bildirime tıklanınca bu adrese gider. Site içi yol veya tam URL olabilir.</p>
        </div>
        <button
          type="submit"
          disabled={sending}
          className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg disabled:opacity-50 transition"
        >
          {sending ? "Gönderiliyor..." : "Tüm Kullanıcılara Gönder"}
        </button>
        {success && <p className="text-green-600 text-sm font-medium text-center">{success}</p>}
      </form>

      <h2 className="text-xl font-bold mb-4">Yayındaki duyurular</h2>
      {loading && <p className="text-gray-500">Yükleniyor...</p>}
      {!loading && (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {items.length === 0 ? (
            <p className="text-center py-8 text-gray-500">Henüz duyuru yok.</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                      #{item.id} {item.title}
                    </p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap mt-1">{item.message}</p>
                    {item.link && <p className="text-xs text-blue-600 mt-1 truncate">{item.link}</p>}
                  </div>
                  <button
                    onClick={() => handleDelete(item.id, item.title)}
                    disabled={deletingId === item.id}
                    className="text-red-600 hover:text-red-800 text-sm font-semibold shrink-0 disabled:opacity-50"
                  >
                    {deletingId === item.id ? "Siliniyor..." : "Sil"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
