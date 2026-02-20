"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditNovelPage({ params }) {
    const router = useRouter();
    const [novel, setNovel] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        summary: "",
        author: "",
        status: "ongoing",
        is_published: false,
        is_featured: false,
        source_url: "", // State
    });

    const [coverImage, setCoverImage] = useState(null);

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const novelId = params.id;

    // Novel verilerini yükle
    useEffect(() => {
        const fetchNovel = async () => {
            try {
                const res = await fetch(`${API}/api/admin/novels/${novelId}`, {
                    headers: {
                        "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                    }
                });
                const data = await res.json();

                if (data.status === "success") {
                    const n = data.data;
                    setNovel(n);
                    setFormData({
                        title: n.title || "",
                        summary: n.summary || "",
                        author: n.author || "",
                        status: n.status || "ongoing",
                        is_published: n.is_published || false,
                        is_featured: n.is_featured || false,
                        source_url: n.source_url || "", // Load
                    });
                }
            } catch (error) {
                console.error("Novel yüklenemedi:", error);
                alert("Novel bulunamadı!");
            } finally {
                setLoading(false);
            }
        };

        fetchNovel();
    }, [novelId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const form = new FormData();
            form.append("title", formData.title);
            form.append("summary", formData.summary);
            form.append("author", formData.author); // Novel'e özel
            form.append("status", formData.status);
            form.append("is_published", formData.is_published.toString());
            form.append("is_featured", formData.is_featured.toString());
            if (formData.source_url) form.append("source_url", formData.source_url); // Append

            if (coverImage) {
                form.append("cover_image", coverImage);
            }

            const res = await fetch(`${API}/api/admin/novels/${novelId}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                },
                body: form,
            });

            const data = await res.json();

            if (data.status === "success" || res.ok) {
                alert("Novel güncellendi!");
                router.push("/admin/novels");
            } else {
                alert("Hata: " + (data.detail || "Bilinmeyen hata"));
            }
        } catch (error) {
            alert("Güncelleme hatası: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6">
                <p>Yükleniyor...</p>
            </div>
        );
    }

    if (!novel) {
        return (
            <div className="p-6">
                <p className="text-red-600">Novel bulunamadı!</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Novel Düzenle: {novel.title}</h1>

            <form onSubmit={handleSubmit} className="bg-white p-6 rounded-lg shadow space-y-6">
                {/* Başlık */}
                <div>
                    <label className="block text-sm font-medium mb-2">Başlık *</label>
                    <input
                        type="text"
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Yazar */}
                <div>
                    <label className="block text-sm font-medium mb-2">Yazar *</label>
                    <input
                        type="text"
                        required
                        value={formData.author}
                        onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Özet */}
                <div>
                    <label className="block text-sm font-medium mb-2">Özet</label>
                    <textarea
                        rows={5}
                        value={formData.summary}
                        onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Durum */}
                <div>
                    <label className="block text-sm font-medium mb-2">Durum</label>
                    <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg"
                    >
                        <option value="ongoing">Devam Ediyor</option>
                        <option value="completed">Tamamlandı</option>
                    </select>
                </div>

                {/* Yayın Durumu */}
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="is_published"
                        checked={formData.is_published}
                        onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                        className="w-5 h-5"
                    />
                    <label htmlFor="is_published" className="font-medium">
                        Yayında (Kullanıcılara görünür)
                    </label>
                </div>

                {/* ÖNE ÇIKAN */}
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="is_featured"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="w-5 h-5"
                    />
                    <label htmlFor="is_featured" className="font-medium">
                        ⭐ Öne Çıkan (Listelerde üstte görünür)
                    </label>
                </div>

                {/* Source URL */}
                <div>
                    <label className="block text-sm font-medium mb-2">Kaynak URL (Opsiyonel)</label>
                    <input
                        type="url"
                        value={formData.source_url}
                        onChange={(e) => setFormData({ ...formData, source_url: e.target.value })}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="https://orijinal-kaynak.com/..."
                    />
                </div>

                {/* Kapak Resmi */}
                <div>
                    <label className="block text-sm font-medium mb-2">Kapak Resmi</label>
                    {novel.cover_image && (
                        <div className="mb-2">
                            <img
                                src={`${API}/${novel.cover_image}`}
                                alt="Mevcut Kapak"
                                className="h-24 rounded border"
                            />
                            <p className="text-xs text-gray-500 mt-1">Mevcut kapak</p>
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setCoverImage(e.target.files[0])}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                        Yeni resim yüklerseniz eskisi değiştirilir
                    </p>
                </div>

                {/* Butonlar */}
                <div className="flex gap-4">
                    <button
                        type="submit"
                        disabled={submitting}
                        className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                        {submitting ? "Kaydediliyor..." : "Güncelle"}
                    </button>
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="bg-gray-200 px-8 py-3 rounded-lg hover:bg-gray-300"
                    >
                        İptal
                    </button>
                </div>
            </form>
        </div>
    );
}
