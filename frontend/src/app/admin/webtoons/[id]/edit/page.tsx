"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function EditWebtoonPage({ params }) {
    const router = useRouter();
    const [webtoon, setWebtoon] = useState(null);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        title: "",
        summary: "",
        status: "ongoing",
        is_published: false,
        is_featured: false, // SLIDER İÇİN
    });

    const [coverImage, setCoverImage] = useState(null);
    const [bannerImage, setBannerImage] = useState(null);

    const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const webtoonId = params.id;

    // Webtoon verilerini yükle
    useEffect(() => {
        const fetchWebtoon = async () => {
            try {
                const res = await fetch(`${API}/api/admin/webtoons/${webtoonId}`, {
                    headers: {
                        "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                    }
                });
                const data = await res.json();

                if (data.status === "success") {
                    const w = data.data;
                    setWebtoon(w);
                    setFormData({
                        title: w.title || "",
                        summary: w.summary || "",
                        status: w.status || "ongoing",
                        is_published: w.is_published || false,
                        is_featured: w.is_featured || false,
                    });
                }
            } catch (error) {
                console.error("Webtoon yüklenemedi:", error);
                alert("Webtoon bulunamadı!");
            } finally {
                setLoading(false);
            }
        };

        fetchWebtoon();
    }, [webtoonId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const form = new FormData();
            form.append("title", formData.title);
            form.append("summary", formData.summary);
            form.append("status", formData.status);
            form.append("is_published", formData.is_published.toString());
            form.append("is_featured", formData.is_featured.toString());

            if (coverImage) {
                form.append("cover_image", coverImage);
            }
            if (bannerImage) {
                form.append("banner_image", bannerImage);
            }

            const res = await fetch(`${API}/api/admin/webtoons/${webtoonId}`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("admin_token")}`
                },
                body: form,
            });

            const data = await res.json();

            if (data.status === "success") {
                alert("Webtoon güncellendi!");
                router.push("/admin/webtoons");
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

    if (!webtoon) {
        return (
            <div className="p-6">
                <p className="text-red-600">Webtoon bulunamadı!</p>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-4xl">
            <h1 className="text-3xl font-bold mb-6">Webtoon Düzenle: {webtoon.title}</h1>

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

                {/* ÖNE ÇIKAN (SLIDER) */}
                <div className="flex items-center gap-3">
                    <input
                        type="checkbox"
                        id="is_featured"
                        checked={formData.is_featured}
                        onChange={(e) => setFormData({ ...formData, is_featured: e.target.checked })}
                        className="w-5 h-5"
                    />
                    <label htmlFor="is_featured" className="font-medium">
                        ⭐ Öne Çıkan (Ana sayfada slider'da göster)
                    </label>
                </div>

                {/* Kapak Resmi */}
                <div>
                    <label className="block text-sm font-medium mb-2">Kapak Resmi</label>
                    {webtoon.cover_image && (
                        <div className="mb-2">
                            <img
                                src={`${API}/${webtoon.cover_image}`}
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

                {/* Banner Resmi */}
                <div>
                    <label className="block text-sm font-medium mb-2">Banner Resmi (Slider için)</label>
                    {webtoon.banner_image && (
                        <div className="mb-2">
                            <img
                                src={`${API}/${webtoon.banner_image}`}
                                alt="Mevcut Banner"
                                className="h-24 rounded border"
                            />
                            <p className="text-xs text-gray-500 mt-1">Mevcut banner</p>
                        </div>
                    )}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setBannerImage(e.target.files[0])}
                        className="w-full px-4 py-2 border rounded-lg"
                    />
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
