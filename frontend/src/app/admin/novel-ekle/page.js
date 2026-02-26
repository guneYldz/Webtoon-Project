"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NovelEkle() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

  // Form Verileri
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState("");
  const [cover, setCover] = useState(null);

  // Başlık yazıldığında otomatik slug oluşturma (Opsiyonel ama kullanışlı)
  const handleTitleChange = (val) => {
    setTitle(val);
    const generatedSlug = val
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setSlug(generatedSlug);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cover) {
      alert("Lütfen bir kapak resmi seçin.");
      return;
    }

    setLoading(true);
    const token = sessionStorage.getItem("admin_token");
    const formData = new FormData();

    formData.append("title", title);
    formData.append("slug", slug);
    formData.append("author", author);
    formData.append("summary", summary);
    formData.append("cover", cover); // Dosya objesi

    try {
      const response = await fetch(`${API}/novels/ekle`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Roman eklenirken bir hata oluştu.");
      }

      alert("✅ Yeni Roman Başarıyla Oluşturuldu!");
      router.push("/admin/novel-bolum-ekle"); // Hemen bölüm ekleme sayfasına yönlendir
    } catch (error) {
      alert("❌ Hata: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center py-10 px-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700">

        <h1 className="text-3xl font-bold mb-6 text-purple-400 border-b border-gray-700 pb-4">
          📚 Yeni Roman (Novel) Oluştur
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Başlık ve Slug */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-gray-400 font-medium mb-1">Roman Adı</label>
              <input
                type="text"
                placeholder="Örn: Solo Leveling"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-gray-400 font-medium mb-1">URL (Slug)</label>
              <input
                type="text"
                placeholder="solo-leveling"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
                required
              />
            </div>
          </div>

          {/* Yazar */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Yazar</label>
            <input
              type="text"
              placeholder="Yazar adı"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          {/* Özet */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Roman Özeti</label>
            <textarea
              rows="4"
              placeholder="Romanın konusunu kısaca yazın..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-purple-500 outline-none resize-none"
              required
            ></textarea>
          </div>

          {/* Kapak Resmi */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Kapak Resmi (JPEG/PNG)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCover(e.target.files[0])}
              className="w-full bg-gray-700 text-gray-300 p-2 rounded border border-gray-600 cursor-pointer"
              required
            />
          </div>

          {/* Gönder Butonu */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow-lg transition transform hover:scale-[1.02] ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-purple-600 hover:bg-purple-500 hover:shadow-purple-500/30"
              }`}
          >
            {loading ? "Oluşturuluyor..." : "Romanı Kaydet 🚀"}
          </button>

        </form>
      </div>
    </div>
  );
}
