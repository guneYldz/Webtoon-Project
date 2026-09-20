"use client";

import { useState, useEffect } from "react";

type Announcement = {
    id: number;
    title: string;
    message: string;
};

export default function AnnouncementsPage() {
    const [items, setItems] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(true);
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

    const getToken = () =>
        sessionStorage.getItem("access_token") ||
        sessionStorage.getItem("admin_token") ||
        sessionStorage.getItem("token");

    const fetchAnnouncements = async () => {
        try {
            const token = getToken();
            if (!token) {
                window.location.href = "/login-admin";
                return;
            }

            const res = await fetch(`${API}/admin/announcements`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                if (data.status === "success") {
                    setItems(data.data);
                }
            } else if (res.status === 401) {
                alert("Oturum süresi dolmuş veya yetkiniz yok. Lütfen tekrar giriş yapın.");
                sessionStorage.removeItem("access_token");
                sessionStorage.removeItem("admin_token");
                window.location.href = "/login-admin";
            }
        } catch (error) {
            console.error("Duyurular yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            const form = new FormData();
            form.append("title", title.trim());
            form.append("message", message.trim());

            const res = await fetch(`${API}/admin/announcements`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                },
                body: form,
            });
            const data = await res.json();
            if (data.status === "success") {
                setTitle("");
                setMessage("");
                fetchAnnouncements();
            } else {
                alert(data.detail || data.message || "Duyuru eklenemedi");
            }
        } catch (error) {
            alert("Hata: " + (error as Error).message);
        }
    };

    const handleDelete = async (id: number, itemTitle: string) => {
        if (!confirm(`"${itemTitle}" duyurusunu silmek istediğinden emin misin?`)) return;

        setDeletingId(id);
        try {
            const res = await fetch(`${API}/admin/announcements/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${getToken()}`,
                },
            });
            const data = await res.json();
            if (data.status === "success") {
                setItems((prev) => prev.filter((item) => item.id !== id));
            } else {
                alert(data.detail || data.message || "Duyuru silinemedi");
            }
        } catch (error) {
            alert("Silme hatası: " + (error as Error).message);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="p-6 max-w-5xl">
            <h1 className="text-3xl font-bold mb-6">Duyurular</h1>

            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-lg font-semibold mb-4">Yeni Duyuru Ekle</h2>
                <form onSubmit={handleCreate} className="space-y-4">
                    <input
                        type="text"
                        placeholder="Başlık..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg"
                        required
                    />
                    <textarea
                        placeholder="Duyuru metni..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full px-4 py-2 border rounded-lg min-h-[120px]"
                    />
                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                        Ekle
                    </button>
                </form>
            </div>

            {loading && (
                <div className="text-center py-8">
                    <p className="text-gray-500">Yükleniyor...</p>
                </div>
            )}

            {!loading && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Başlık</th>
                                <th className="px-6 py-3 text-left text-sm font-medium text-gray-500 uppercase">Metin</th>
                                <th className="px-6 py-3 text-right text-sm font-medium text-gray-500 uppercase">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {items.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900 align-top">{item.id}</td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900 align-top">{item.title}</td>
                                    <td className="px-6 py-4 text-sm text-gray-600 align-top whitespace-pre-wrap max-w-xl">
                                        {item.message}
                                    </td>
                                    <td className="px-6 py-4 text-right align-top">
                                        <button
                                            onClick={() => handleDelete(item.id, item.title)}
                                            disabled={deletingId === item.id}
                                            className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                                        >
                                            {deletingId === item.id ? "Siliniyor..." : "Sil"}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {items.length === 0 && (
                        <div className="text-center py-8 text-gray-500">Henüz duyuru yok.</div>
                    )}
                </div>
            )}
        </div>
    );
}
