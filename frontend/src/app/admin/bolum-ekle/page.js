"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { seriesTypeLabel } from "@/lib/seriesType";
import { defaultChapterTitle, formatChapterNumber, isAutoChapterTitle } from "@/lib/chapterTitle";

function BolumEkle() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("webtoon_id") || "";
  const typeFilter = (searchParams.get("series_type") || "").toUpperCase();

  const [loading, setLoading] = useState(false);
  const [webtoons, setWebtoons] = useState([]);

  const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

  const [mode, setMode] = useState("single");

  const [selectedWebtoon, setSelectedWebtoon] = useState(preselectedId);
  const [title, setTitle] = useState("");
  const [episodeNumber, setEpisodeNumber] = useState("");
  const [files, setFiles] = useState(null);

  const [bulkLogs, setBulkLogs] = useState([]);

  useEffect(() => {
    if (preselectedId) setSelectedWebtoon(preselectedId);
  }, [preselectedId]);

  useEffect(() => {
    const load = async () => {
      const token =
        sessionStorage.getItem("access_token") ||
        sessionStorage.getItem("admin_token") ||
        sessionStorage.getItem("token");
      let list = [];
      try {
        if (token) {
          const res = await fetch(`${API}/admin/webtoon/list`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            list = Array.isArray(data) ? data : data.data || [];
          }
        }
        if (!list.length) {
          const res = await fetch(`${API}/webtoons/?limit=1000`);
          if (res.ok) {
            const data = await res.json();
            list = Array.isArray(data) ? data : data.data || [];
          }
        }
      } catch (err) {
        console.error("Webtoonlar çekilemedi:", err);
      }
      setWebtoons(list);
    };
    load();
  }, [API]);

  const visibleWebtoons = webtoons.filter((w) => {
    if (typeFilter !== "WEBTOON" && typeFilter !== "MANGA") return true;
    return seriesTypeLabel(w.type, w.typeLabel) === typeFilter;
  });

  const pageTitle =
    typeFilter === "MANGA"
      ? "Manga Bölümü Yükle"
      : typeFilter === "WEBTOON"
        ? "Webtoon Bölümü Yükle"
        : "Webtoon / Manga Bölümü Yükle";

  const onEpisodeNumberChange = (value) => {
    setEpisodeNumber(value);
    if (!value) return;
    if (!title || isAutoChapterTitle(title)) {
      setTitle(`Bölüm ${formatChapterNumber(value)}`);
    }
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWebtoon || !files) {
      alert("Lütfen seri ve resim seçin.");
      return;
    }

    setLoading(true);
    try {
      const epTitle = defaultChapterTitle(title, episodeNumber);
      await uploadOneEpisode(selectedWebtoon, epTitle, episodeNumber, files);
      alert("✅ Bölüm Başarıyla Yüklendi!");
    } catch (error) {
      alert("❌ Hata: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWebtoon || !files) {
      alert("Lütfen seri ve bir ANA KLASÖR seçin.");
      return;
    }

    setLoading(true);
    setBulkLogs([]);

    const episodesMap = {};

    Array.from(files).forEach((file) => {
      const pathParts = file.webkitRelativePath.split("/");
      if (pathParts.length < 2) return;
      const folderName = pathParts[pathParts.length - 2];
      if (!file.type.startsWith("image/")) return;
      if (!episodesMap[folderName]) {
        episodesMap[folderName] = [];
      }
      episodesMap[folderName].push(file);
    });

    const folderNames = Object.keys(episodesMap);
    let successCount = 0;

    addLog(`📂 Toplam ${folderNames.length} bölüm klasörü bulundu. Yükleme başlıyor...`);

    for (const folderName of folderNames) {
      const numberMatch = folderName.match(/(\d+(\.\d+)?)/);
      const epNum = numberMatch ? numberMatch[0] : null;

      if (!epNum) {
        addLog(`⚠️ "${folderName}" klasöründen bölüm numarası okunamadı, atlanıyor.`);
        continue;
      }

      addLog(`⏳ Bölüm ${epNum} (${folderName}) yükleniyor...`);

      try {
        const epFiles = episodesMap[folderName];
        await uploadOneEpisode(selectedWebtoon, `Bölüm ${formatChapterNumber(epNum)}`, epNum, epFiles);
        addLog(`✅ Bölüm ${epNum} başarıyla yüklendi!`);
        successCount++;
      } catch (error) {
        addLog(`❌ Bölüm ${epNum} yüklenemedi: ${error.message}`);
      }
    }

    setLoading(false);
    alert(`İşlem Tamamlandı! ${successCount}/${folderNames.length} bölüm yüklendi.`);
  };

  async function uploadOneEpisode(webtoonId, epTitle, epNum, epFiles) {
    const token =
      sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("admin_token") ||
      sessionStorage.getItem("token");
    const formData = new FormData();

    formData.append("webtoon_id", webtoonId);
    formData.append("title", defaultChapterTitle(epTitle, epNum));
    formData.append("episode_number", epNum);

    for (let i = 0; i < epFiles.length; i++) {
      formData.append("resimler", epFiles[i]);
    }

    const response = await fetch(`${API}/episodes/ekle`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.detail || "API Hatası");
    }
    return await response.json();
  }

  const addLog = (msg) => setBulkLogs((prev) => [...prev, msg]);

  const typeHref = (t) => {
    const params = new URLSearchParams();
    if (t) params.set("series_type", t);
    if (selectedWebtoon) params.set("webtoon_id", selectedWebtoon);
    const qs = params.toString();
    return qs ? `/admin/bolum-ekle?${qs}` : "/admin/bolum-ekle";
  };

  return (
    <div className="bg-gray-900 text-gray-100 rounded-xl py-6 px-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-2xl mx-auto border border-gray-700">

        <h1 className="text-3xl font-bold mb-4 text-green-400 border-b border-gray-700 pb-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
          <span>🎬 {pageTitle}</span>

          <div className="text-sm flex gap-2">
            <button
              type="button"
              onClick={() => setMode("single")}
              className={`px-3 py-1 rounded transition ${mode === "single" ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              Tek Bölüm
            </button>
            <button
              type="button"
              onClick={() => setMode("bulk")}
              className={`px-3 py-1 rounded transition ${mode === "bulk" ? "bg-green-600 text-white" : "bg-gray-700 text-gray-400"}`}
            >
              Toplu (Klasör)
            </button>
          </div>
        </h1>

        <div className="flex flex-wrap gap-2 mb-6">
          <Link
            href={typeHref("")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${!typeFilter ? "bg-green-600 text-white" : "bg-gray-700 text-gray-300"}`}
          >
            Tümü
          </Link>
          <Link
            href={typeHref("WEBTOON")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${typeFilter === "WEBTOON" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300"}`}
          >
            Webtoon
          </Link>
          <Link
            href={typeHref("MANGA")}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${typeFilter === "MANGA" ? "bg-orange-600 text-white" : "bg-gray-700 text-gray-300"}`}
          >
            Manga
          </Link>
        </div>

        <form onSubmit={mode === "single" ? handleSingleSubmit : handleBulkSubmit} className="space-y-6">

          <div>
            <label className="block text-gray-400 font-medium mb-1">
              {typeFilter === "MANGA" ? "Hangi Manga?" : typeFilter === "WEBTOON" ? "Hangi Webtoon?" : "Hangi Webtoon / Manga?"}
            </label>
            <select
              value={selectedWebtoon}
              onChange={(e) => setSelectedWebtoon(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
              required
            >
              <option value="">Seçiniz...</option>
              {visibleWebtoons.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} ({seriesTypeLabel(w.type, w.typeLabel) === "MANGA" ? "Manga" : "Webtoon"})
                </option>
              ))}
            </select>
            {visibleWebtoons.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">Bu türe ait seri bulunamadı.</p>
            )}
          </div>

          {mode === "single" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Bölüm No</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="1"
                    value={episodeNumber}
                    onChange={(e) => onEpisodeNumberChange(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-gray-400 font-medium mb-1">Bölüm Başlığı</label>
                  <input
                    type="text"
                    placeholder="Bölüm 1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:ring-2 focus:ring-green-500 outline-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">Boş bırakırsan otomatik “Bölüm {episodeNumber || "1"}” olur.</p>
                </div>
              </div>

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

          {mode === "bulk" && (
            <div className="bg-gray-750 p-4 rounded-lg border border-dashed border-gray-600">
              <label className="block text-green-400 font-bold mb-2">📂 Ana Klasörü Seç</label>
              <p className="text-sm text-gray-400 mb-3">
                İçinde &quot;Bölüm 1&quot;, &quot;Bölüm 2&quot; gibi klasörler olan ana klasörü seçin. Sistem klasör isimlerinden bölüm numarasını anlayacaktır.
              </p>
              <input
                type="file"
                {...{ webkitdirectory: "", directory: "" }}
                onChange={(e) => setFiles(e.target.files)}
                className="w-full bg-gray-700 text-gray-300 p-2 rounded border border-gray-600 cursor-pointer"
                required
              />

              <div className="mt-4 bg-black p-3 rounded h-40 overflow-y-auto text-sm font-mono text-green-300 border border-gray-700">
                {bulkLogs.length === 0 ? "İşlem bekleniyor..." : bulkLogs.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            </div>
          )}

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

export default function BolumEklePage() {
  return (
    <Suspense fallback={<div className="text-gray-500 p-8">Yükleniyor...</div>}>
      <BolumEkle />
    </Suspense>
  );
}
