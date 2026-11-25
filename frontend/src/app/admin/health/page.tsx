"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  RefreshCw,
  ImageOff,
  FileWarning,
  AlertOctagon,
  BookX,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, clearAdminToken, getAdminToken } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui";
import {
  Badge,
  Button,
  AdminPageHeader,
  adminCardClass,
} from "../_components/AdminUi";

type HealthTab = "broken_images" | "suspicious_chapters" | "missing_covers";

export default function AdminHealthScannerPage() {
  const router = useRouter();
  const [scanning, setScanning] = useState(true);
  const [activeTab, setActiveTab] = useState<HealthTab>("broken_images");
  const [report, setReport] = useState<any>({
    summary: {
      broken_images: 0,
      short_chapters: 0,
      refusal_chapters: 0,
      missing_covers: 0,
      scanned_at: null,
    },
    broken_images: [],
    suspicious_chapters: [],
    missing_covers: [],
  });

  const runHealthScan = useCallback(
    async (showToast = false) => {
      const token = getAdminToken();
      if (!token) {
        router.replace("/login-admin");
        return;
      }

      setScanning(true);
      try {
        const res = await apiFetch("/admin/health-scan", {
          auth: "admin",
          cache: "no-store",
        });

        if (res.status === 401) {
          clearAdminToken();
          toast.error("Oturum süresi doldu.");
          router.replace("/login-admin");
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setReport({
            summary: data?.summary || {
              broken_images: 0,
              short_chapters: 0,
              refusal_chapters: 0,
              missing_covers: 0,
              scanned_at: new Date().toISOString(),
            },
            broken_images: Array.isArray(data?.broken_images)
              ? data.broken_images
              : [],
            suspicious_chapters: Array.isArray(data?.suspicious_chapters)
              ? data.suspicious_chapters
              : [],
            missing_covers: Array.isArray(data?.missing_covers)
              ? data.missing_covers
              : [],
          });
          if (showToast) {
            toast.success("Sistem sağlık taraması tamamlandı.");
          }
        } else {
          toast.error("Sağlık taraması çalıştırılamadı.");
        }
      } catch (err) {
        console.error("Sağlık taraması hatası:", err);
        toast.error("Sunucuyla bağlantı kurulamadı.");
      } finally {
        setScanning(false);
      }
    },
    [router]
  );

  useEffect(() => {
    runHealthScan(false);
  }, [runHealthScan]);

  const summary = report.summary || {};
  const totalIssues =
    Number(summary.broken_images || 0) +
    Number(summary.short_chapters || 0) +
    Number(summary.refusal_chapters || 0) +
    Number(summary.missing_covers || 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <AdminPageHeader
        title="Sağlık Tarayıcısı (Diagnostics)"
        description={
          summary.scanned_at
            ? `Son tarama: ${new Date(summary.scanned_at).toLocaleString(
                "tr-TR"
              )}`
            : "Bozuk bölüm görsellerini, eksik kapakları ve şüpheli AI çevirilerini tespit edin."
        }
        actions={
          <Button
            variant="primary"
            size="md"
            loading={scanning}
            onClick={() => runHealthScan(true)}
          >
            <RefreshCw className="h-4 w-4" />
            <span>Sistemi Tara</span>
          </Button>
        }
      />

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={`${adminCardClass} p-5 flex items-center gap-4`}>
          <div className="h-11 w-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <ImageOff className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Bozuk Görseller
            </p>
            <p className="text-2xl font-black text-ink-primary tabular-nums mt-0.5">
              {scanning ? "—" : summary.broken_images || 0}
            </p>
          </div>
        </div>

        <div className={`${adminCardClass} p-5 flex items-center gap-4`}>
          <div className="h-11 w-11 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <FileWarning className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Kısa Bölümler
            </p>
            <p className="text-2xl font-black text-ink-primary tabular-nums mt-0.5">
              {scanning ? "—" : summary.short_chapters || 0}
            </p>
          </div>
        </div>

        <div className={`${adminCardClass} p-5 flex items-center gap-4`}>
          <div className="h-11 w-11 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
            <AlertOctagon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Çeviri Reddi
            </p>
            <p className="text-2xl font-black text-ink-primary tabular-nums mt-0.5">
              {scanning ? "—" : summary.refusal_chapters || 0}
            </p>
          </div>
        </div>

        <div className={`${adminCardClass} p-5 flex items-center gap-4`}>
          <div className="h-11 w-11 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0">
            <BookX className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
              Eksik Kapaklar
            </p>
            <p className="text-2xl font-black text-ink-primary tabular-nums mt-0.5">
              {scanning ? "—" : summary.missing_covers || 0}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-subtle pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("broken_images")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition ${
            activeTab === "broken_images"
              ? "bg-brand text-white border-brand shadow-sm"
              : "bg-surface text-ink-secondary border-subtle hover:text-ink-primary"
          }`}
        >
          <ImageOff className="h-3.5 w-3.5" />
          <span>Bozuk Görseller ({report.broken_images.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("suspicious_chapters")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition ${
            activeTab === "suspicious_chapters"
              ? "bg-brand text-white border-brand shadow-sm"
              : "bg-surface text-ink-secondary border-subtle hover:text-ink-primary"
          }`}
        >
          <FileWarning className="h-3.5 w-3.5" />
          <span>
            Şüpheli Novel Bölümleri ({report.suspicious_chapters.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("missing_covers")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold border transition ${
            activeTab === "missing_covers"
              ? "bg-brand text-white border-brand shadow-sm"
              : "bg-surface text-ink-secondary border-subtle hover:text-ink-primary"
          }`}
        >
          <BookX className="h-3.5 w-3.5" />
          <span>Eksik Kapaklar ({report.missing_covers.length})</span>
        </button>
      </div>

      {/* Tab Content */}
      {scanning ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <Skeleton key={idx} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : totalIssues === 0 ? (
        <div
          className={`${adminCardClass} py-16 px-4 text-center flex flex-col items-center justify-center`}
        >
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-ink-primary">
            Sistem Tamamen Sağlıklı
          </h3>
          <p className="text-xs text-ink-secondary mt-1 max-w-md">
            Yapılan taramada eksik kapak, bozuk bölüm görseli veya şüpheli çeviri
            tespit edilmedi.
          </p>
        </div>
      ) : (
        <div className={`${adminCardClass} overflow-x-auto`}>
          {activeTab === "broken_images" && (
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3.5">Seri</th>
                  <th className="px-4 py-3.5">Bölüm</th>
                  <th className="px-4 py-3.5">Sayfa / Görsel Yolu</th>
                  <th className="px-4 py-3.5">Sorun</th>
                  <th className="px-4 py-3.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {report.broken_images.map((item: any, idx: number) => (
                  <tr
                    key={`${item.image_id || idx}`}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3.5 text-sm font-medium text-ink-primary">
                      {item.webtoon_title ||
                        item.series_title ||
                        `Webtoon #${item.webtoon_id || "?"}`}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-secondary">
                      Bölüm {item.episode_number ?? item.episode_id ?? "—"}
                    </td>
                    <td className="px-4 py-3.5 text-xs font-mono text-ink-muted truncate max-w-xs">
                      {item.image_url || item.path || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <Badge variant="new" size="sm">
                        {item.reason || "Dosya Yok / 0 Byte"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href="/admin/webtoon-bolumleri"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        <span>Bölümlere Git</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "suspicious_chapters" && (
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3.5">Novel</th>
                  <th className="px-4 py-3.5">Bölüm</th>
                  <th className="px-4 py-3.5">Karakter Uzunluğu</th>
                  <th className="px-4 py-3.5">Tespit</th>
                  <th className="px-4 py-3.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {report.suspicious_chapters.map((item: any, idx: number) => (
                  <tr
                    key={`${item.chapter_id || idx}`}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3.5 text-sm font-medium text-ink-primary">
                      {item.novel_title ||
                        item.series_title ||
                        `Novel #${item.novel_id || "?"}`}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-secondary">
                      Bölüm {item.chapter_number ?? "—"} — {item.title || ""}
                    </td>
                    <td className="px-4 py-3.5 text-xs tabular-nums text-ink-muted">
                      {item.char_length ?? item.length ?? 0} kr.
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      <Badge
                        variant={
                          item.issue_type === "refusal" ? "new" : "outline"
                        }
                        size="sm"
                        className={
                          item.issue_type === "refusal"
                            ? ""
                            : "text-amber-300 border-amber-500/40 bg-amber-500/15"
                        }
                      >
                        {item.issue_type === "refusal"
                          ? "AI Çeviri Reddi"
                          : item.reason || "Kısa İçerik (<1200 kr)"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href="/admin/novel-bolumleri"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        <span>Bölümlere Git</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "missing_covers" && (
            <table className="w-full min-w-[720px] text-left">
              <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3.5">Tür</th>
                  <th className="px-4 py-3.5">Seri Başlığı</th>
                  <th className="px-4 py-3.5">Kayıtlı Kapak Yolu</th>
                  <th className="px-4 py-3.5">Durum</th>
                  <th className="px-4 py-3.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {report.missing_covers.map((item: any, idx: number) => {
                  const isNovel =
                    String(item.type || "").toLowerCase() === "novel";
                  const editHref = isNovel
                    ? `/admin/novels/${item.id}/edit`
                    : `/admin/webtoons/${item.id}/edit`;

                  return (
                    <tr
                      key={`${item.type}-${item.id || idx}`}
                      className="hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3.5 text-xs">
                        <Badge
                          variant={isNovel ? "novel" : "webtoon"}
                          size="sm"
                        >
                          {isNovel ? "NOVEL" : "WEBTOON"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-sm font-medium text-ink-primary">
                        {item.title || `#${item.id}`}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-ink-muted truncate max-w-xs">
                        {item.cover_image || "Boş"}
                      </td>
                      <td className="px-4 py-3.5 text-xs">
                        <Badge variant="new" size="sm">
                          {item.reason || "Kapak Eksik"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          href={editHref}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          <span>Seriyi Düzenle</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
