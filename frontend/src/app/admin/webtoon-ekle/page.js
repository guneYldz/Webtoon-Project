"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WebtoonEkle() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const [formData, setFormData] = useState({
    ad: "",
    ozet: "",
    durum: "Devam Ediyor",
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // Resim önizlemesi için

  // Yazı alanları değişince çalışır
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Dosya seçilince çalışır
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile)); // Önizleme URL'i oluştur
    }
  };

  // Form gönderilince çalışır
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("admin_token");
    if (!token) {
      alert("Önce giriş yapmalısın!");
      router.push("/admin/login"); // Updated to admin login path
      return;
    }

    const data = new FormData();
    data.append("baslik", formData.ad);
    data.append("ozet", formData.ozet);
    // Status backend'de default 'ongoing' ama istersen backend'e ekleyebilirsin

    if (file) {
      data.append("resim", file);
    } else {
      alert("Lütfen bir kapak resmi seç!");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API}/webtoons/ekle`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Yükleme başarısız");
      }

      alert("✅ Webtoon Başarıyla Eklendi!");
      router.push("/");
    } catch (err) {
      console.error(err);
      alert("❌ Hata: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center py-10 px-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-lg border border-gray-700">

        <h1 className="text-3xl font-bold mb-6 text-blue-400 flex items-center gap-2 border-b border-gray-700 pb-4">
          📚 Yeni Webtoon Ekle
        </h1>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* İsim */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Webtoon Adı</label>
            <input
              type="text"
              name="ad"
              onChange={handleChange}
              required
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Örn: Solo Leveling"
            />
          </div>

          {/* Özet */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Özet / Konu</label>
            <textarea
              name="ozet"
              onChange={handleChange}
              required
              rows="4"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Hikaye ne hakkında?"
            ></textarea>
          </div>

          {/* Durum */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Durum</label>
            <select
              name="durum"
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Devam Ediyor">Devam Ediyor</option>
              <option value="Tamamlandı">Tamamlandı</option>
              <option value="Sezon Finali">Sezon Finali</option>
            </select>
          </div>

          {/* Kapak Resmi */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Kapak Resmi</label>
            <div className="relative border-2 border-dashed border-gray-600 rounded-lg p-4 hover:bg-gray-750 transition text-center cursor-pointer">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                required
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                {preview ? (
                  <img src={preview} alt="Önizleme" className="h-32 object-cover rounded shadow-md mb-2" />
                ) : (
                  <span className="text-4xl mb-2">🖼️</span>
                )}
                <span className="text-sm text-gray-400">{file ? file.name : "Resim Seç veya Sürükle"}</span>
              </div>
            </div>
          </div>

          {/* Buton */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow-lg transition transform hover:scale-[1.02] ${loading
              ? "bg-gray-600 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-500 hover:shadow-blue-500/30"
              }`}
          >
            {loading ? "Yükleniyor..." : "✨ Webtoon'u Oluştur"}
          </button>

        </form>
      </div>
    </div>
  );
}