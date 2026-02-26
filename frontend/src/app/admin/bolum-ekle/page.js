"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function BolumEkle() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [webtoons, setWebtoons] = useState([]);

  const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

  // Mod Seçimi: 'single' (Tek Bölüm) veya 'bulk' (Toplu Klasör)
  const [mode, setMode] = useState("single");

  // Form Verileri (Tekil Yükleme İçin)
  const [selectedWebtoon, setSelectedWebtoon] = useState("");
  const [title, setTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [files, setFiles] = useState(null);

  // Toplu Yükleme Verileri
  const [bulkLogs, setBulkLogs] = useState([]); // İşlem kayıtları

  // Webtoonları Çek
  useEffect(() => {
    fetch(`${API}/webtoons/`)
      .then((res) => res.json())
      .then((data) => setWebtoons(data))
      .catch((err) => console.error("Webtoonlar çekilemedi:", err));
  }, [API]);

  // --- TEKİL YÜKLEME FONKSİYONU ---
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWebtoon || !files) {
      alert("Lütfen webtoon ve resim seçin.");
      return;
    }

    setLoading(true);
    try {
      await uploadOneEpisode(selectedWebtoon, title, episodeNumber, files);
      alert("✅ Bölüm Başarıyla Yüklendi!");
    } catch (error) {
      alert("❌ Hata: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  // --- TOPLU YÜKLEME FONKSİYONU ---
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWebtoon || !files) {
      alert("Lütfen webtoon ve bir ANA KLASÖR seçin.");
      return;
    }

    setLoading(true);
    setBulkLogs([]); // Logları temizle

    // 1. Dosyaları Klasörlere Göre Grupla
    const episodesMap = {};

    // files bir FileList objesidir, array'e çevirip dönelim
    Array.from(files).forEach((file) => {
      // webkitRelativePath örnek: "Solo Leveling/Chapter 1/page1.jpg"
      const pathParts = file.webkitRelativePath.split("/");

      // En az 2 derinlik olmalı (Ana Klasör / Bölüm Klasörü / Resim)
      if (pathParts.length < 2) return;

      // Bölüm Klasörünün Adı (Örn: "Chapter 1" veya sadece "1")
      // Sondan bir önceki parça klasör adıdır
      const folderName = pathParts[pathParts.length - 2];

      // Resim dosyası mı?
      if (!file.type.startsWith("image/")) return;

      if (!episodesMap[folderName]) {
        episodesMap[folderName] = [];
      }
      episodesMap[folderName].push(file);
    });

    const folderNames = Object.keys(episodesMap);
    let successCount = 0;

    addLog(`📂 Toplam ${folderNames.length} bölüm klasörü bulundu. Yükleme başlıyor...`);

    // 2. Her Klasörü Sırayla Yükle
    for (const folderName of folderNames) {
      // Klasör adından numarayı ayıklamaya çalış (Örn: "Chapter 55" -> 55)
      const numberMatch = folderName.match(/(\d+(\.\d+)?)/);
      const epNum = numberMatch ? numberMatch[0] : null;

      if (!epNum) {
        addLog(`⚠️ "${folderName}" klasöründen bölüm numarası okunamadı, atlanıyor.`);
        continue;
      }

      addLog(`⏳ Bölüm ${epNum} (${folderName}) yükleniyor...`);

      try {
        const epFiles = episodesMap[folderName];
        // API'ye Gönder
        await uploadOneEpisode(selectedWebtoon, `Bölüm ${epNum}`, epNum, epFiles);
        addLog(`✅ Bölüm ${epNum} başarıyla yüklendi!`);
        successCount++;
      } catch (error) {
        addLog(`❌ Bölüm ${epNum} yüklenemedi: ${error.message}`);
      }
    }

    setLoading(false);
    alert(`İşlem Tamamlandı! ${successCount}/${folderNames.length} bölüm yüklendi.`);
  };

  // --- YARDIMCI: API İSTEĞİ ATAN FONKSİYON ---
  async function uploadOneEpisode(webtoonId, epTitle, epNum, epFiles) {
    const token = sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("admin_token") ||
      sessionStorage.getItem("token");
    const formData = new FormData();

    formData.append("webtoon_id", webtoonId);
    formData.append("title", epTitle);
    formData.append("episode_number", epNum);

    // Resimleri ekle
    for (let i = 0; i < epFiles.length; i++) {
      formData.append("resimler", epFiles[i]);
    }

    const response = await fetch(`${API}/episodes/ekle`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        // Content-Type'ı elle koyma, FormData otomatik boundary ekler
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "API Hatası");
    }
    return await response.json();
  }

  // Log ekleme yardımcısı
  const addLog = (msg) => setBulkLogs(prev => [...prev, msg]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center py-10 px-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-2xl border border-gray-700">

        <h1 className="text-3xl font-bold mb-6 text-green-400 border-b border-gray-700 pb-4 flex justify-between items-center">
          <span>🎬 Bölüm Yükle</span>

          {/* Mod Değiştirme Butonları */}
          <div className="text-sm flex gap-2">
            <button
              onClick={() => setMode("single")}
              className={`px-3 py-1 rounded transition ${mode === "single" ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              Tek Bölüm
            </button>
            <button
              onClick={() => setMode("bulk")}
              className={`px-3 py-1 rounded transition ${mode === "bulk" ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              Toplu (Klasör)
            </button>
          </div>
        </h1>

        <form onSubmit={mode === "single" ? handleSingleSubmit : handleBulkSubmit} className="space-y-6">

          {/* Webtoon Seçimi (Ortak) */}
          <div>
            <label className="block text-gray-400 font-medium mb-1">Hangi Webtoon?</label>
            <select
              value={selectedWebtoon}
              onChange={(e) => setSelectedWebtoon(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
              required
            >
              <option value="">Seçiniz...</option>
              {webtoons.map((w) => (
                <option key={w.id} value={w.id}>{w.title}</option>
              ))}
            </select>
          </div>

          {/* --- TEKİL MOD ALANLARI --- */}
          {mode === "single" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Bölüm No</label>
                  <input
                    type="number"
                    placeholder="1"
                    value={episodeNumber}
                    onChange={(e) => setEpisodeNumber(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Bölüm Başlığı</label>
                  <input
                    type="text"
                    placeholder="Örn: Başlangıç"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                    required
                  />
                </div>
              </div>

              {/* Tekil Resim Seçimi */}
              <div>
                <label className="block text-gray-400 font-medium mb-1">Resimler (Çoklu Seç)</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => setFiles(e.target.files)}
                  className="w-full bg-gray-700 text-gray-300 p-2 rounded border border-gray-600 cursor-pointer"
                  required
                />
              </div>
            </>
          )}

          {/* --- TOPLU MOD ALANLARI --- */}
          {mode === "bulk" && (
            <div className="bg-gray-750 p-4 rounded-lg border border-dashed border-gray-600">
              <label className="block text-green-400 font-bold mb-2">📂 Ana Klasörü Seç</label>
              <p className="text-sm text-gray-400 mb-3">
                İçinde "Bölüm 1", "Bölüm 2" gibi klasörler olan ana klasörü seçin. Sistem klasör isimlerinden bölüm numarasını anlayacaktır.
              </p>
              <input
                type="file"
                // 👇 BU ÖZELLİK KLASÖR SEÇMEYİ SAĞLAR
                {...{ webkitdirectory: "", directory: "" }}
                onChange={(e) => setFiles(e.target.files)}
                className="w-full bg-gray-700 text-gray-300 p-2 rounded border border-gray-600 cursor-pointer"
                required
              />

              {/* Log Ekranı */}
              <div className="mt-4 bg-black p-3 rounded h-40 overflow-y-auto text-xs font-mono text-green-300 border border-gray-700">
                {bulkLogs.length === 0 ? "İşlem bekleniyor..." : bulkLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}

          {/* Gönder Butonu */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-lg shadow-lg transition transform hover:scale-[1.02] ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-500 hover:shadow-green-500/30"
              }`}
          >
            {loading ? "İşleniyor..." : (mode === "single" ? "Bölümü Yayınla 🚀" : "Toplu Yüklemeyi Başlat 🚀")}
          </button>

        </form>
      </div>
    </div>
  );
}