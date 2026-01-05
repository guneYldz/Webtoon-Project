"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WebtoonEkle() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ad: "",
    ozet: "",
    durum: "Devam Ediyor",
  });
  const [file, setFile] = useState(null);

  // Yazı alanları değişince çalışır
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // Dosya seçilince çalışır
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
       setFile(selectedFile);
    }
  };

  // Form gönderilince çalışır
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Önce giriş yapmalısın!");
      router.push("/login");
      return;
    }

    const data = new FormData();
    // Backend 'baslik', 'ozet', 'resim' bekliyor (Türkçe olarak)
    data.append("baslik", formData.ad);      
    data.append("ozet", formData.ozet);      
    // data.append("status", formData.durum); // Backend şimdilik bunu otomatik yapıyor
    
    if (file) {
      data.append("resim", file);            
    } else {
        alert("Lütfen bir kapak resmi seç!");
        setLoading(false);
        return;
    }

    try {
      // Backend rotası: /webtoons/ekle
      const response = await fetch("http://127.0.0.1:8000/webtoons/ekle", {
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

      alert("Webtoon Başarıyla Eklendi! 🎉");
      router.push("/"); 
    } catch (err) {
      console.error(err);
      alert("Hata: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center py-10 px-4">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">
          Yeni Webtoon Ekle 📚
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* İsim */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Webtoon Adı</label>
            <input
              type="text"
              name="ad"
              onChange={handleChange}
              required
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Örn: Solo Leveling"
            />
          </div>

          {/* Özet */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Özet / Konu</label>
            <textarea
              name="ozet"
              onChange={handleChange}
              required
              rows="4"
              className="w-full border p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Hikaye ne hakkında?"
            ></textarea>
          </div>

          {/* Durum */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Durum</label>
            <select
              name="durum"
              onChange={handleChange}
              className="w-full border p-2 rounded bg-white"
            >
              <option value="Devam Ediyor">Devam Ediyor</option>
              <option value="Tamamlandı">Tamamlandı</option>
              <option value="Sezon Finali">Sezon Finali</option>
            </select>
          </div>

          {/* Kapak Resmi */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Kapak Resmi</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              required
              className="w-full text-gray-600"
            />
          </div>

          {/* Buton */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded text-white font-bold transition ${
              loading ? "bg-gray-400 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {loading ? "Yükleniyor..." : "Webtoon'u Oluştur ✨"}
          </button>

        </form>
      </div>
    </div>
  );
}