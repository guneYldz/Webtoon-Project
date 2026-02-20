"use client";

import { useState, useEffect } from "react";
import { API } from "@/api";

export default function WebtoonChaptersPage() {
    const [webtoons, setWebtoons] = useState([]);
    const [selectedWebtoon, setSelectedWebtoon] = useState("");
    const [chapters, setChapters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(null); // ID of chapter being deleted

    // 1. Fetch all webtoons for dropdown (PUBLIC ENDPOINT - Reverted)
    useEffect(() => {
        const fetchWebtoons = async () => {
            try {
                // Reverted to Public API to ensure visibility
                const res = await fetch(`${API}/webtoons`);
                if (res.ok) {
                    const data = await res.json();
                    setWebtoons(data);
                }
            } catch (err) {
                console.error("Webtoon listesi çekilemedi:", err);
            }
        };
        fetchWebtoons();
    }, []);

    // 2. Fetch chapters when a webtoon is selected
    useEffect(() => {
        if (!selectedWebtoon) {
            setChapters([]);
            return;
        }

        const fetchChapters = async () => {
            setLoading(true);
            try {
                // Fetch webtoon details from Public API
                const res = await fetch(`${API}/webtoons/${selectedWebtoon}`);

                if (res.ok) {
                    const data = await res.json();
                    // Public API returns the object directly
                    const episodes = data.episodes || [];

                    // Sort by episode number descending (newest first)
                    const sortedChapters = episodes.sort((a, b) => b.episode_number - a.episode_number);
                    setChapters(sortedChapters);
                }
            } catch (err) {
                console.error("Bölümler çekilemedi:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchChapters();
    }, [selectedWebtoon]);

    // 3. Delete Chapter
    const handleDelete = async (episodeId) => {
        if (!confirm("Bölüm silinecek. Emin misiniz?")) return;

        setDeleting(episodeId);
        try {
            const token = localStorage.getItem("admin_token") || localStorage.getItem("access_token");

            // Use specific delete endpoint added to routers/episode.py
            const res = await fetch(`${API}/episodes/${episodeId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                // Remove from local state
                setChapters(prev => prev.filter(c => c.id !== episodeId));
                alert("Bölüm başarıyla silindi.");
            } else {
                const errorData = await res.json().catch(() => ({}));
                alert(`Silme başarısız: ${errorData.detail || "Bilinmeyen hata"}`);
            }
        } catch (err) {
            console.error("Silme hatası:", err);
            alert("Bir hata oluştu.");
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="text-3xl font-bold text-gray-800 border-b pb-4">Webtoon Bölüm Yönetimi</h1>

            {/* Webtoon Selection */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">Webtoon Seçin</label>
                <select
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    value={selectedWebtoon}
                    onChange={(e) => setSelectedWebtoon(e.target.value)}
                >
                    <option value="">-- Bir Webtoon Seçin --</option>
                    {webtoons.map((webtoon) => (
                        <option key={webtoon.id} value={webtoon.id}>
                            {webtoon.title}
                        </option>
                    ))}
                </select>
            </div>

            {/* Chapter List */}
            {selectedWebtoon && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                        <h2 className="text-xl font-semibold text-gray-800">Bölümler ({chapters.length})</h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-500">Bölümler yükleniyor...</div>
                    ) : chapters.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">Bu seriye ait bölüm bulunamadı.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                                    <tr>
                                        <th className="p-4">Bölüm No</th>
                                        <th className="p-4">Başlık</th>
                                        <th className="p-4">Yayın Tarihi</th>
                                        <th className="p-4">İzlenme</th>
                                        <th className="p-4 text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {chapters.map((chapter) => (
                                        <tr key={chapter.id} className="hover:bg-gray-50 group transition">
                                            <td className="p-4 font-bold text-blue-600">#{chapter.episode_number}</td>
                                            <td className="p-4 text-gray-800 font-medium">{chapter.title}</td>
                                            <td className="p-4 text-gray-500 text-sm">
                                                {new Date(chapter.created_at).toLocaleDateString('tr-TR')}
                                            </td>
                                            <td className="p-4 text-gray-500 text-sm">👁️ {chapter.view_count || 0}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(chapter.id)}
                                                    disabled={deleting === chapter.id}
                                                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                                                >
                                                    {deleting === chapter.id ? "Siliniyor..." : "Sil"}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
