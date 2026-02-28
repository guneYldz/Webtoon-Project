"use client";

import { useState, useEffect } from "react";
import { API } from "@/api";
import Image from "next/image";

export default function NovelChaptersPage() {
    const [novels, setNovels] = useState([]);
    const [selectedNovelId, setSelectedNovelId] = useState("");
    const [novelSlug, setNovelSlug] = useState(""); // Needed for delete url
    const [chapters, setChapters] = useState([]);
    const [loading, setLoading] = useState(false);
    const [deleting, setDeleting] = useState(null); // ID of chapter being deleted

    const [editingChapter, setEditingChapter] = useState(null); // The chapter currently being edited
    const [editForm, setEditForm] = useState({
        title: "",
        content: "",
        chapter_number: "",
        is_published: true
    });

    // 1. Fetch all novels for dropdown (PUBLIC ENDPOINT - Reverted)
    useEffect(() => {
        const fetchNovels = async () => {
            try {
                // Reverted to Public API
                const res = await fetch(`${API}/novels/`);
                if (res.ok) {
                    const data = await res.json();
                    setNovels(data);
                }
            } catch (err) {
                console.error("Novel listesi çekilemedi:", err);
            }
        };
        fetchNovels();
    }, []);

    // 2. Fetch chapters when a novel is selected
    useEffect(() => {
        if (!selectedNovelId) {
            setChapters([]);
            setNovelSlug("");
            return;
        }

        const fetchChapters = async () => {
            setLoading(true);
            try {
                // Fetch novel details from Public API
                const res = await fetch(`${API}/novels/${selectedNovelId}`);
                if (res.ok) {
                    const data = await res.json();
                    setNovels(prev => prev.map(n => n.id === data.id ? data : n)); // Update novel details in list if needed
                    setNovelSlug(data.slug);

                    // Ensure chapters are sorted
                    const sortedChapters = (data.chapters || []).sort((a, b) => b.chapter_number - a.chapter_number);
                    setChapters(sortedChapters);
                }
            } catch (err) {
                console.error("Bölümler çekilemedi:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchChapters();
    }, [selectedNovelId]);

    // 3. Delete Chapter
    const handleDelete = async (chapterNumber) => {
        if (!confirm(`Bölüm ${chapterNumber} silinecek. Emin misiniz?`)) return;

        setDeleting(chapterNumber);
        try {
            const token = sessionStorage.getItem("access_token") ||
                sessionStorage.getItem("admin_token") ||
                sessionStorage.getItem("token");

            // Delete endpoint expects SLUG
            const res = await fetch(`${API}/novels/${novelSlug}/chapters/${chapterNumber}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (res.ok) {
                // Remove from local state
                setChapters(prev => prev.filter(c => c.chapter_number !== chapterNumber));
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

    // 4. Open Edit Modal
    const handleEditClick = (chapter) => {
        setEditingChapter(chapter);
        setEditForm({
            title: chapter.title,
            content: chapter.content,
            chapter_number: chapter.chapter_number,
            is_published: chapter.is_published ?? true // Default to true if undefined
        });
    };

    // 5. Submit Edit
    const handleUpdate = async (e) => {
        e.preventDefault();
        if (!editingChapter) return;

        try {
            const token = sessionStorage.getItem("access_token") ||
                sessionStorage.getItem("admin_token") ||
                sessionStorage.getItem("token");
            const formData = new FormData();
            formData.append("title", editForm.title);
            formData.append("content", editForm.content);
            formData.append("new_chapter_number", editForm.chapter_number);
            formData.append("is_published", editForm.is_published);

            const res = await fetch(`${API}/novels/${novelSlug}/chapters/${editingChapter.chapter_number}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                const updatedChapter = await res.json();

                // Update local state
                setChapters(prev => prev.map(c =>
                    c.id === editingChapter.id
                        ? { ...c, ...updatedChapter.data, chapter_number: Number(editForm.chapter_number) }
                        : c
                ));

                setEditingChapter(null); // Close modal
                alert("Bölüm güncellendi.");
            } else {
                const errorData = await res.json().catch(() => ({}));
                alert(`Güncelleme başarısız: ${errorData.detail || "Hata"}`);
            }

        } catch (err) {
            console.error("Güncelleme hatası:", err);
            alert("Bir hata oluştu.");
        }
    };

    return (
        <div className="space-y-8 relative">
            <h1 className="text-3xl font-bold text-gray-800 border-b pb-4">Novel Bölüm Yönetimi</h1>

            {/* Novel Selection */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">Novel Seçin</label>
                <select
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    value={selectedNovelId}
                    onChange={(e) => setSelectedNovelId(e.target.value)}
                >
                    <option value="">-- Bir Novel Seçin --</option>
                    {novels.map((novel) => (
                        <option key={novel.id} value={novel.id}>
                            {novel.title}
                        </option>
                    ))}
                </select>
            </div>

            {/* Chapter List */}
            {selectedNovelId && (
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
                                        <th className="p-4">Durum</th>
                                        <th className="p-4">İzlenme</th>
                                        <th className="p-4 text-right">İşlemler</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {chapters.map((chapter) => (
                                        <tr key={chapter.id} className="hover:bg-gray-50 group transition">
                                            <td className="p-4 font-bold text-blue-600">#{chapter.chapter_number}</td>
                                            <td className="p-4 text-gray-800 font-medium">{chapter.title}</td>
                                            <td className="p-4">
                                                {chapter.is_published ? (
                                                    <span className="bg-green-100 text-green-700 py-1 px-2 rounded text-sm font-bold">Yayında</span>
                                                ) : (
                                                    <span className="bg-gray-100 text-gray-500 py-1 px-2 rounded text-sm font-bold">Taslak</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-gray-500 text-sm">👁️ {chapter.view_count || 0}</td>
                                            <td className="p-4 text-right space-x-2">
                                                <button
                                                    onClick={() => handleEditClick(chapter)}
                                                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition font-medium text-sm"
                                                >
                                                    Düzenle
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(chapter.chapter_number)}
                                                    disabled={deleting === chapter.chapter_number}
                                                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                                                >
                                                    {deleting === chapter.chapter_number ? "Siliniyor..." : "Sil"}
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

            {/* EDIT MODEL */}
            {editingChapter && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-100 flex justify-between items-center sticky top-0 bg-white z-10">
                            <h3 className="text-xl font-bold text-gray-800">Bölümü Düzenle</h3>
                            <button
                                onClick={() => setEditingChapter(null)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleUpdate} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Bölüm No</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        required
                                        className="w-full p-2 border rounded-lg"
                                        value={editForm.chapter_number}
                                        onChange={e => setEditForm({ ...editForm, chapter_number: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                                    <select
                                        className="w-full p-2 border rounded-lg"
                                        value={editForm.is_published}
                                        onChange={e => setEditForm({ ...editForm, is_published: e.target.value === "true" })}
                                    >
                                        <option value="true">Yayında</option>
                                        <option value="false">Taslak (Gizli)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Bölüm Başlığı</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full p-2 border rounded-lg"
                                    value={editForm.title}
                                    onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">İçerik</label>
                                <textarea
                                    rows={10}
                                    required
                                    className="w-full p-2 border rounded-lg font-mono text-sm"
                                    value={editForm.content}
                                    onChange={e => setEditForm({ ...editForm, content: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex justify-end gap-3 border-t">
                                <button
                                    type="button"
                                    onClick={() => setEditingChapter(null)}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg"
                                >
                                    Kaydet & Güncelle
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
