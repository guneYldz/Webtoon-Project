"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function NovelsListPage() {
    const [novels, setNovels] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [publishedFilter, setPublishedFilter] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({});

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const fetchNovels = async () => {
        setLoading(true);
        try {
            // 1. Token'ı al
            const token = localStorage.getItem("access_token") ||
                localStorage.getItem("admin_token") ||
                localStorage.getItem("token");

            console.log("🔍 DEBUG: Fetching novels with token:", token ? "Exists" : "MISSING");

            if (!token) {
                console.warn("⚠️ Token bulunamadı, login sayfasına yönlendiriliyor.");
                window.location.href = "/login-admin";
                return;
            }

            // 2. İsteği at (Paginated endpoint öncelikli)
            const params = new URLSearchParams({ page: page.toString(), limit: "20" });
            if (search) params.append("search", search);
            if (statusFilter) params.append("status", statusFilter);
            if (publishedFilter !== "") params.append("is_published", publishedFilter);

            const res = await fetch(`${API}/api/admin/novels?${params}`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });

            console.log("🔍 DEBUG: Novels response status:", res.status);

            if (res.ok) {
                const data = await res.json();
                if (data.status === "success" && data.data) {
                    setNovels(data.data);
                    setPagination(data.pagination || {});
                } else if (Array.isArray(data)) {
                    // Yedek plan: Düz liste
                    setNovels(data);
                    setPagination({ page: 1, limit: data.length, total: data.length, pages: 1 });
                }
            } else {
                console.error("❌ Veri çekilemedi. Status:", res.status);
                if (res.status === 401) {
                    alert("Oturum süresi dolmuş veya yetkiniz yok. Lütfen tekrar giriş yapın.");
                    localStorage.removeItem("access_token");
                    localStorage.removeItem("admin_token");
                    window.location.href = "/login-admin";
                }
            }
        } catch (error) {
            console.error("❌ Novel listesi yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNovels();
    }, [page, statusFilter, publishedFilter]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchNovels();
    };

    const handleDelete = async (id) => {
        if (!confirm("Bu novel'ı silmek istediğinden emin misin?")) return;
        try {
            const res = await fetch(`${API}/api/admin/novels/${id}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                }
            });
            const data = await res.json();
            if (data.status === "success") {
                alert(data.message);
                fetchNovels();
            }
        } catch (error) {
            alert("Silme hatası: " + error.message);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold">Tüm Noveller</h1>
                <Link href="/admin/novel-ekle" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
                    + Yeni Novel
                </Link>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="Başlık veya özet ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
                    />
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className="px-4 py-2 border rounded-lg">
                        <option value="">Tüm Durumlar</option>
                        <option value="ongoing">Devam Ediyor</option>
                        <option value="completed">Tamamlandı</option>
                    </select>
                    <select value={publishedFilter} onChange={(e) => { setPublishedFilter(e.target.value); setPage(1); }} className="px-4 py-2 border rounded-lg">
                        <option value="">Tüm Yayın Durumları</option>
                        <option value="true">Yayında</option>
                        <option value="false">Taslak</option>
                    </select>
                    <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900">Ara</button>
                </form>
            </div>

            {loading && <div className="text-center py-8"><p className="text-gray-500">Yükleniyor...</p></div>}

            {!loading && (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Başlık</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yazar</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Öne Çıkan</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Yayın</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {novels.map((novel) => (
                                <tr key={novel.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900">{novel.id}</td>
                                    <td className="px-6 py-4">
                                        <div className="text-sm font-medium text-gray-900">{novel.title}</div>
                                        <div className="text-xs text-gray-500 truncate max-w-xs">{novel.summary}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">{novel.author || "—"}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-xs rounded-full ${novel.status === "ongoing" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                                            {novel.status === "ongoing" ? "Devam Ediyor" : "Tamamlandı"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        {novel.is_featured ? <span className="text-yellow-500">⭐ Evet</span> : <span className="text-gray-400">—</span>}
                                    </td>
                                    <td className="px-6 py-4">
                                        {novel.is_published ? <span className="text-green-600">✓ Yayında</span> : <span className="text-gray-400">Taslak</span>}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <Link href={`/admin/novels/${novel.id}/edit`} className="text-blue-600 hover:text-blue-800 text-sm">Düzenle</Link>
                                        <button onClick={() => handleDelete(novel.id)} className="text-red-600 hover:text-red-800 text-sm">Sil</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {novels.length === 0 && <div className="text-center py-8 text-gray-500">Henüz novel yok.</div>}
                </div>
            )}

            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-4 py-2 border rounded-lg disabled:opacity-50">Önceki</button>
                    <span className="px-4 py-2">Sayfa {page} / {pagination.pages}</span>
                    <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages} className="px-4 py-2 border rounded-lg disabled:opacity-50">Sonraki</button>
                </div>
            )}
        </div>
    );
}
