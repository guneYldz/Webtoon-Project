"use client";

import { useState } from "react";

export default function AnnouncementsAdminPage() {
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [link, setLink] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);

    const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim() || !message.trim()) {
            alert("Başlık ve mesaj zorunlu");
            return;
        }
        if (!confirm("Bu duyuru tüm aktif kullanıcılara bildirim olarak gidecek. Devam?")) return;

        setLoading(true);
        setResult(null);
        try {
            const token = sessionStorage.getItem("admin_token");
            const form = new FormData();
            form.append("title", title.trim());
            form.append("message", message.trim());
            if (link.trim()) form.append("link", link.trim());

            const res = await fetch(`${API}/admin/announcements`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: form,
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                setResult(data.message);
                setTitle("");
                setMessage("");
                setLink("");
            } else {
                alert(data.detail || "Duyuru gönderilemedi");
            }
        } catch (err) {
            alert("Hata: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-2xl">
            <h1 className="text-3xl font-bold mb-2">📢 Duyuru Gönder</h1>
            <p className="text-gray-500 text-sm mb-6">
                Yazacağın duyuru tüm aktif kullanıcıların bildirim ziline düşer.
            </p>

            <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-6 space-y-4">
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Link (opsiyonel)
                    </label>
                    <input
                        type="text"
                        value={link}
                        onChange={(e) => setLink(e.target.value)}
                        placeholder="/novel/shadow-slave veya https://..."
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-400 mt-1">
                        Bildirime tıklanınca bu adrese gider. Site içi yol veya tam URL olabilir.
                    </p>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-lg disabled:opacity-50 transition"
                >
                    {loading ? "Gönderiliyor..." : "Tüm Kullanıcılara Gönder"}
                </button>
                {result && (
                    <p className="text-green-600 text-sm font-medium text-center">{result}</p>
                )}
            </form>
        </div>
    );
}
