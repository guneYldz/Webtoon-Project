"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BolumEkle() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [webtoons, setWebtoons] = useState([]); // Webtoon listesi (Seçmek için)
  
  // Form Verileri
  const [selectedWebtoon, setSelectedWebtoon] = useState("");
  const [title, setTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [files, setFiles] = useState(null);

  // Sayfa açılınca Webtoonları çek (Dropdown için)
  useEffect(() => {
    fetch("http://127.0.0.1:8000/webtoons/")
      .then((res) => res.json())
      .then((data) => setWebtoons(data))
      .catch((err) => console.error("Webtoonlar çekilemedi:", err));
  }, []);

  const handleFileChange = (e) => {
    setFiles(e.target.files); // Çoklu dosya seçimi
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const token = localStorage.getItem("token");
    if (!token) {
      alert("Admin girişi yapmalısın!");
      router.push("/login");
      return;
    }

    if (!selectedWebtoon || !files) {
      alert("Lütfen bir webtoon ve resim dosyaları seçin.");
      setLoading(false);
      return;
    }

    try {
      // ADIM 1: Bölümü Oluştur (Başlık ve Numara)
      // Backend: POST /episodes/
      const createResponse = await fetch("http://127.0.0.1:8000/episodes/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          webtoon_id: selectedWebtoon,
          title: title,
          episode_number: episodeNumber,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.detail || "Bölüm oluşturulamadı.");
      }

      const episodeData = await createResponse.json();
      const newEpisodeId = episodeData.id; // Yeni oluşturulan bölümün ID'sini aldık
      console.log("Bölüm oluşturuldu ID:", newEpisodeId);

      // ADIM 2: Resimleri Yükle
      // Backend: POST /episodes/{id}/upload-images
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append("dosyalar", files[i]); // Backend 'dosyalar' adında liste bekliyor
      }

      const uploadResponse = await fetch(
        `http://127.0.0.1:8000/episodes/${newEpisodeId}/upload-images`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error("Resimler yüklenirken hata oluştu.");
      }

      alert("Bölüm ve Resimler Başarıyla Yüklendi! 🎉");
      router.push(`/webtoon/${selectedWebtoon}`); // O webtoon'un sayfasına git

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
          Yeni Bölüm Ekle 🎬
        </h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Webtoon Seçimi */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Hangi Webtoon?</label>
            <select
              value={selectedWebtoon}
              onChange={(e) => setSelectedWebtoon(e.target.value)}
              className="w-full border p-2 rounded bg-white"
              required
            >
              <option value="">Seçiniz...</option>
              {webtoons.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </div>

          {/* Bölüm Başlığı */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Bölüm Başlığı</label>
            <input
              type="text"
              placeholder="Örn: Bölüm 1: Başlangıç"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          </div>

          {/* Bölüm Numarası */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">Bölüm Numarası</label>
            <input
              type="number"
              placeholder="1"
              value={episodeNumber}
              onChange={(e) => setEpisodeNumber(e.target.value)}
              className="w-full border p-2 rounded"
              required
            />
          </div>

          {/* Resim Seçimi */}
          <div>
            <label className="block text-gray-700 font-medium mb-1">
              Bölüm Resimleri (Çoklu Seçim)
            </label>
            <input
              type="file"
              multiple // Birden fazla dosya seçmeye izin verir
              accept="image/*"
              onChange={handleFileChange}
              className="w-full text-gray-600 border p-2 rounded"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              * Ctrl tuşuna basılı tutarak birden fazla resim seçebilirsiniz.
            </p>
          </div>

          {/* Buton */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded text-white font-bold transition ${
              loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "Yükleniyor..." : "Bölümü Yayınla 🚀"}
          </button>

        </form>
      </div>
    </div>
  );
}