"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function CommentsAdminPage() {
    const [comments, setComments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [seriType, setSeriType] = useState("");
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

    const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

    const getToken = () =>
        sessionStorage.getItem("admin_token") ||
        sessionStorage.getItem("access_token") ||
        sessionStorage.getItem("token");

    const fetchComments = async () => {
        setLoading(true);
        try {
            const token = getToken();
            if (!token) {
                window.location.href = "/login-admin";
                return;
            }

            const params = new URLSearchParams({ page: page.toString(), limit: "20" });
            if (search) params.append("search", search);
            if (seriType) params.append("seri_type", seriType);

            const res = await fetch(`${API}/admin/comments?${params}`, {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
            });

            if (res.ok) {
                const data = await res.json();
                if (data.status === "success") {
                    setComments(data.data);
                    setPagination(data.pagination);
                }
            } else if (res.status === 401) {
                alert("Oturum süresi dolmuş. Lütfen tekrar giriş yapın.");
                window.location.href = "/login-admin";
            }
        } catch (error) {
            console.error("Yorum listesi yüklenemedi:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchComments();
    }, [page, seriType]);

    const handleSearch = (e) => {
        e.preventDefault();
        setPage(1);
        fetchComments();
    };

    const handleDelete = async (commentId) => {
        if (!confirm("Bu yorumu (ve varsa yanıtlarını) silmek istediğine emin misin?")) return;
        try {
            const res = await fetch(`${API}/admin/comments/${commentId}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${getToken()}` },
            });
            const data = await res.json();
            if (res.ok && data.status === "success") {
                fetchComments();
            } else {
                alert(data.detail || data.message || "Silinemedi");
            }
        } catch (error) {
            alert("Hata: " + error.message);
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Yorumlar</h1>
                    <p className="text-gray-500 text-sm mt-1">Toplam {pagination.total || 0} yorum</p>
                </div>
            </div>

            <div className="bg-white p-4 rounded-lg shadow mb-6">
                <form onSubmit={handleSearch} className="flex gap-4 flex-wrap">
                    <input
                        type="text"
                        placeholder="Kullanıcı veya yorum içeriği ara..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg"
                    />
                    <select
                        value={seriType}
                        onChange={(e) => { setSeriType(e.target.value); setPage(1); }}
                        className="px-4 py-2 border rounded-lg"
                    >
                        <option value="">Tüm Türler</option>
                        <option value="novel">Novel</option>
                        <option value="webtoon">Webtoon</option>
                    </select>
                    <button type="submit" className="bg-gray-800 text-white px-6 py-2 rounded-lg hover:bg-gray-900">
                        Ara
                    </button>
                </form>
            </div>

            {loading && (
                <div className="text-center py-8">
                    <p className="text-gray-500">Yükleniyor...</p>
                </div>
            )}

            {!loading && (
                <div className="bg-white rounded-lg shadow overflow-x-auto">
                    <table className="w-full min-w-[800px]">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">ID</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Kullanıcı</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Seri</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Bölüm</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Yorum</th>
                                <th className="px-4 py-3 text-left text-sm font-medium text-gray-500 uppercase">Tarih</th>
                                <th className="px-4 py-3 text-right text-sm font-medium text-gray-500 uppercase">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {comments.map((c) => (
                                <tr key={c.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-900">{c.id}</td>
                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                        <Link
                                            href={`/kullanici/${encodeURIComponent(c.username)}`}
                                            className="text-blue-600 hover:underline"
                                            target="_blank"
                                        >
                                            {c.username}
                                        </Link>
                                        {c.parent_id && (
                                            <span className="ml-1 text-xs text-gray-400">(yanıt)</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                        <span className={`mr-1 text-xs px-1.5 py-0.5 rounded ${c.seri_type === "webtoon" ? "bg-blue-100 text-blue-800" : "bg-purple-100 text-purple-800"}`}>
                                            {c.seri_type === "webtoon" ? "W" : "N"}
                                        </span>
                                        {c.seri_title || "—"}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-600">
                                        {c.link ? (
                                            <Link href={c.link} className="hover:underline text-blue-600" target="_blank">
                                                {c.bolum_title || "—"}
                                            </Link>
                                        ) : (
                                            c.bolum_title || "—"
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                                        <p className="line-clamp-2 break-words">{c.content}</p>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                        {new Date(c.created_at).toLocaleDateString("tr-TR")}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button
                                            onClick={() => handleDelete(c.id)}
                                            className="text-sm text-red-600 hover:text-red-800 font-medium"
                                        >
                                            Sil
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {comments.length === 0 && (
                        <div className="text-center py-8 text-gray-500">Yorum bulunamadı.</div>
                    )}
                </div>
            )}

            {pagination.pages > 1 && (
                <div className="flex justify-center gap-2 mt-6">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 border rounded-lg disabled:opacity-50"
                    >
                        Önceki
                    </button>
                    <span className="px-4 py-2">
                        Sayfa {page} / {pagination.pages}
                    </span>
                    <button
                        onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                        disabled={page === pagination.pages}
                        className="px-4 py-2 border rounded-lg disabled:opacity-50"
                    >
                        Sonraki
                    </button>
                </div>
            )}
        </div>
    );
}
