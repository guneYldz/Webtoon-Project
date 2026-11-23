"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FolderUp, UploadCloud, FileImage } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAdminToken } from "@/lib/apiClient";
import { seriesTypeLabel } from "@/lib/seriesType";
import {
  defaultChapterTitle,
  formatChapterNumber,
  isAutoChapterTitle,
} from "@/lib/chapterTitle";
import { Button, Skeleton, Tabs, TabsList, TabsTrigger } from "@/components/ui";
import {
  AdminPageHeader,
  adminCardClass,
  adminInputClass,
  adminSelectClass,
  adminLabelClass,
} from "../_components/AdminUi";

function naturalSortFiles(fileList) {
  return Array.from(fileList || []).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );
}

function BolumEkle() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("webtoon_id") || "";
  const typeFilter = (searchParams.get("series_type") || "").toUpperCase();

  const [loading, setLoading] = useState(false);
  const [webtoons, setWebtoons] = useState([]);
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
      const token = getAdminToken();
      let list = [];
      try {
        if (token) {
          const res = await apiFetch("/admin/webtoon/list", { auth: "admin" });
          if (res.ok) {
            const data = await res.json();
            list = Array.isArray(data) ? data : data.data || [];
          }
        }
        if (!list.length) {
          const res = await apiFetch("/webtoons/?limit=1000");
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
  }, []);

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

  const addLog = (msg) => setBulkLogs((prev) => [...prev, msg]);

  async function uploadOneEpisode(webtoonId, epTitle, epNum, epFiles) {
    const formData = new FormData();
    formData.append("webtoon_id", webtoonId);
    formData.append("title", defaultChapterTitle(epTitle, epNum));
    formData.append("episode_number", epNum);

    const sortedFiles = naturalSortFiles(epFiles);
    for (let i = 0; i < sortedFiles.length; i++) {
      formData.append("resimler", sortedFiles[i]);
    }

    const response = await apiFetch("/episodes/ekle", {
      method: "POST",
      auth: "admin",
      body: formData,
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || "API Hatası");
    }
    return response.json();
  }

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWebtoon || !files || files.length === 0) {
      toast.error("Lütfen seri ve görselleri seçin.");
      return;
    }

    setLoading(true);
    try {
      const epTitle = defaultChapterTitle(title, episodeNumber);
      await uploadOneEpisode(selectedWebtoon, epTitle, episodeNumber, files);
      toast.success("Bölüm başarıyla yüklendi!");
      setTitle("");
      setEpisodeNumber("");
      setFiles(null);
    } catch (error) {
      toast.error(error.message || "Bölüm yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (!selectedWebtoon || !files || files.length === 0) {
      toast.error("Lütfen seri ve ana klasörü seçin.");
      return;
    }

    setLoading(true);
    setBulkLogs([]);

    const episodesMap = {};
    Array.from(files).forEach((file) => {
      const pathParts = (file.webkitRelativePath || "").split("/");
      if (pathParts.length < 2) return;
      const folderName = pathParts[pathParts.length - 2];
      if (!file.type.startsWith("image/")) return;
      if (!episodesMap[folderName]) episodesMap[folderName] = [];
      episodesMap[folderName].push(file);
    });

    const folderNames = Object.keys(episodesMap).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    let successCount = 0;
    addLog(`Toplam ${folderNames.length} bölüm klasörü bulundu. Yükleme başlıyor...`);

    for (const folderName of folderNames) {
      const numberMatch = folderName.match(/(\d+(\.\d+)?)/);
      const epNum = numberMatch ? numberMatch[0] : null;

      if (!epNum) {
        addLog(`"${folderName}" klasöründen bölüm numarası okunamadı, atlanıyor.`);
        continue;
      }

      addLog(`Bölüm ${epNum} (${folderName}) yükleniyor...`);
      try {
        await uploadOneEpisode(
          selectedWebtoon,
          `Bölüm ${formatChapterNumber(epNum)}`,
          epNum,
          episodesMap[folderName]
        );
        addLog(`✓ Bölüm ${epNum} başarıyla yüklendi.`);
        successCount++;
      } catch (error) {
        addLog(`✗ Bölüm ${epNum} yüklenemedi: ${error.message}`);
      }
    }

    setLoading(false);
    toast.success(`İşlem tamamlandı: ${successCount}/${folderNames.length} bölüm yüklendi.`);
  };

  const typeHref = (t) => {
    const params = new URLSearchParams();
    if (t) params.set("series_type", t);
    if (selectedWebtoon) params.set("webtoon_id", selectedWebtoon);
    const qs = params.toString();
    return qs ? `/admin/bolum-ekle?${qs}` : "/admin/bolum-ekle";
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AdminPageHeader
        title={pageTitle}
        description="Tek bölüm yükleyin veya bölüm klasörlerini topluca içe aktarın (sayfalar doğal sıralanır)."
      />

      <div className={`${adminCardClass} p-6 space-y-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-subtle">
          <div className="flex flex-wrap gap-2">
            <Link
              href={typeHref("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                !typeFilter
                  ? "bg-brand-soft border-brand-border text-white"
                  : "bg-canvas border-subtle text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Tümü
            </Link>
            <Link
              href={typeHref("WEBTOON")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                typeFilter === "WEBTOON"
                  ? "bg-sky-500/20 border-sky-500/40 text-sky-300"
                  : "bg-canvas border-subtle text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Webtoon
            </Link>
            <Link
              href={typeHref("MANGA")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                typeFilter === "MANGA"
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                  : "bg-canvas border-subtle text-ink-secondary hover:text-ink-primary"
              }`}
            >
              Manga
            </Link>
          </div>

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList>
              <TabsTrigger value="single">Tek Bölüm</TabsTrigger>
              <TabsTrigger value="bulk">Toplu (Klasör)</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <form
          onSubmit={mode === "single" ? handleSingleSubmit : handleBulkSubmit}
          className="space-y-5"
        >
          <div>
            <label className={adminLabelClass}>
              {typeFilter === "MANGA"
                ? "Hangi Manga?"
                : typeFilter === "WEBTOON"
                ? "Hangi Webtoon?"
                : "Hangi Webtoon / Manga?"}
            </label>
            <select
              value={selectedWebtoon}
              onChange={(e) => setSelectedWebtoon(e.target.value)}
              className={`${adminSelectClass} w-full`}
              required
            >
              <option value="">Seçiniz...</option>
              {visibleWebtoons.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title} (
                  {seriesTypeLabel(w.type, w.typeLabel) === "MANGA"
                    ? "Manga"
                    : "Webtoon"}
                  )
                </option>
              ))}
            </select>
            {visibleWebtoons.length === 0 && (
              <p className="text-xs text-ink-muted mt-1.5">
                Bu türe ait seri bulunamadı.
              </p>
            )}
          </div>

          {mode === "single" ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={adminLabelClass}>Bölüm No *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="1"
                    value={episodeNumber}
                    onChange={(e) => onEpisodeNumberChange(e.target.value)}
                    className={adminInputClass}
                    required
                  />
                </div>
                <div>
                  <label className={adminLabelClass}>Bölüm Başlığı</label>
                  <input
                    type="text"
                    placeholder="Bölüm 1"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={adminInputClass}
                  />
                  <p className="text-[11px] text-ink-muted mt-1">
                    Boş bırakırsanız otomatik “Bölüm {episodeNumber || "1"}” olur.
                  </p>
                </div>
              </div>

              <div>
                <label className={adminLabelClass}>Sayfa Görselleri (Çoklu) *</label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-subtle hover:border-brand/50 rounded-xl p-5 cursor-pointer bg-canvas/60 transition text-center">
                  <FileImage className="h-7 w-7 text-ink-muted mb-2" />
                  <span className="text-xs text-ink-secondary">
                    {files && files.length > 0
                      ? `${files.length} görsel seçildi`
                      : "Görselleri seçin (1.jpg, 2.jpg...)"}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={(e) => setFiles(e.target.files)}
                    className="sr-only"
                    required
                  />
                </label>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-subtle bg-canvas/60 p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-ink-primary">
                <FolderUp className="h-4 w-4 text-brand" />
                <span>Ana Klasörü Seçin</span>
              </div>
              <p className="text-xs text-ink-secondary">
                İçinde &ldquo;Bölüm 1&rdquo;, &ldquo;Bölüm 2&rdquo; gibi alt
                klasörler bulunan ana klasörü seçin. Bölüm numaraları ve sayfa
                sıraları otomatik çözümlenir.
              </p>
              <input
                type="file"
                {...{ webkitdirectory: "", directory: "" }}
                onChange={(e) => setFiles(e.target.files)}
                className="w-full text-xs text-ink-secondary file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-subtle file:bg-elevated file:text-ink-primary file:font-semibold"
                required
              />

              <div className="bg-canvas p-3 rounded-xl h-40 overflow-y-auto text-xs font-mono text-emerald-300 border border-subtle space-y-1">
                {bulkLogs.length === 0 ? (
                  <span className="text-ink-muted">İşlem bekleniyor...</span>
                ) : (
                  bulkLogs.map((log, i) => <div key={i}>{log}</div>)
                )}
              </div>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            className="w-full"
          >
            <UploadCloud className="h-4 w-4" />
            {mode === "single" ? "Bölümü Yayınla" : "Toplu Yüklemeyi Başlat"}
          </Button>
        </form>
      </div>
    </div>
  );
}

export default function BolumEklePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <BolumEkle />
    </Suspense>
  );
}
