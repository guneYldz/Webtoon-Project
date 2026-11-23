"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Trash2, Eye, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAdminToken } from "@/lib/apiClient";
import { seriesTypeLabel } from "@/lib/seriesType";
import { Button, Skeleton, buttonClasses } from "@/components/ui";
import {
  AdminPageHeader,
  AdminConfirmDialog,
  adminCardClass,
  adminSelectClass,
  adminLabelClass,
} from "../_components/AdminUi";

export default function WebtoonChaptersPage() {
  const [webtoons, setWebtoons] = useState([]);
  const [selectedWebtoon, setSelectedWebtoon] = useState("");
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draftWarning, setDraftWarning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchWebtoons = async () => {
      try {
        const token = getAdminToken();
        if (token) {
          const adminRes = await apiFetch("/admin/webtoon/list", {
            auth: "admin",
            cache: "no-store",
          });
          if (adminRes.ok) {
            const data = await adminRes.json();
            setWebtoons(Array.isArray(data) ? data : data.data || []);
            return;
          }
        }
        const res = await apiFetch("/webtoons/?limit=1000");
        if (res.ok) {
          const data = await res.json();
          setWebtoons(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Webtoon listesi çekilemedi:", err);
      }
    };
    fetchWebtoons();
  }, []);

  useEffect(() => {
    if (!selectedWebtoon) {
      setChapters([]);
      setDraftWarning(false);
      return;
    }

    const fetchChapters = async () => {
      setLoading(true);
      setDraftWarning(false);
      try {
        const res = await apiFetch(`/webtoons/${selectedWebtoon}`, {
          cache: "no-store",
        });

        if (res.status === 404) {
          setChapters([]);
          setDraftWarning(true);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          const episodes = data.episodes || [];
          const sorted = [...episodes].sort(
            (a, b) => Number(b.episode_number) - Number(a.episode_number)
          );
          setChapters(sorted);
        }
      } catch (err) {
        console.error("Bölümler çekilemedi:", err);
        toast.error("Bölümler yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, [selectedWebtoon]);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/episodes/${deleteTarget.id}`, {
        method: "DELETE",
        auth: "admin",
      });

      if (res.ok) {
        setChapters((prev) => prev.filter((c) => c.id !== deleteTarget.id));
        toast.success("Bölüm silindi.");
        setDeleteTarget(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || "Bölüm silinemedi.");
      }
    } catch (err) {
      console.error("Silme hatası:", err);
      toast.error("Bir hata oluştu.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Webtoon / Manga Bölümleri"
        description="Seri seçerek yayınlanmış bölümleri görüntüleyin veya silin."
        actions={
          <Link
            href={
              selectedWebtoon
                ? `/admin/bolum-ekle?webtoon_id=${selectedWebtoon}`
                : "/admin/bolum-ekle"
            }
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            <Plus className="h-4 w-4" />
            Bölüm Ekle
          </Link>
        }
      />

      <div className={`${adminCardClass} p-5 mb-6`}>
        <label className={adminLabelClass}>Webtoon / Manga Seçin</label>
        <select
          className={`${adminSelectClass} w-full`}
          value={selectedWebtoon}
          onChange={(e) => setSelectedWebtoon(e.target.value)}
        >
          <option value="">-- Bir seri seçin --</option>
          {webtoons.map((w) => (
            <option key={w.id} value={w.id}>
              {w.title} (
              {seriesTypeLabel(w.type, w.typeLabel) === "MANGA"
                ? "Manga"
                : "Webtoon"}
              ){w.is_published === false ? " [Taslak]" : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedWebtoon && (
        <div className={`${adminCardClass} overflow-hidden`}>
          <div className="p-5 border-b border-subtle flex justify-between items-center gap-3">
            <h2 className="text-base font-bold text-ink-primary">
              Bölümler ({chapters.length})
            </h2>
            <Link
              href={`/admin/bolum-ekle?webtoon_id=${selectedWebtoon}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Plus className="h-3.5 w-3.5" />
              Bu Seriye Bölüm Ekle
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : draftWarning ? (
            <div className="p-8 text-center space-y-2">
              <AlertCircle className="h-7 w-7 text-amber-400 mx-auto" />
              <p className="text-sm text-ink-primary font-medium">
                Bu seri henüz Taslak durumunda (yayınlanmamış).
              </p>
              <p className="text-xs text-ink-muted">
                Bölüm listesini görmek için seriyi{" "}
                <Link
                  href={`/admin/webtoons/${selectedWebtoon}/edit`}
                  className="text-brand hover:underline"
                >
                  düzenlemeden
                </Link>{" "}
                yayına alabilirsiniz.
              </p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="p-10 text-center text-ink-muted text-sm">
              Bu seriye ait bölüm bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-5 py-3.5">Bölüm No</th>
                    <th className="px-5 py-3.5">Başlık</th>
                    <th className="px-5 py-3.5">Yayın Tarihi</th>
                    <th className="px-5 py-3.5">Okunma</th>
                    <th className="px-5 py-3.5 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {chapters.map((chapter) => (
                    <tr key={chapter.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 text-sm font-bold text-sky-400 tabular-nums">
                        #{chapter.episode_number}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-ink-primary">
                        {chapter.title}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-ink-muted">
                        {chapter.created_at
                          ? new Date(chapter.created_at).toLocaleDateString("tr-TR")
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-ink-secondary tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-ink-muted" />
                          {(chapter.view_count || 0).toLocaleString("tr-TR")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(chapter)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Sil
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Bölümü Sil"
        description={`Bölüm ${deleteTarget?.episode_number || ""} kalıcı olarak silinecek. Emin misiniz?`}
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}
