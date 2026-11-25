"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Trash2,
  ExternalLink,
  Flag,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, clearAdminToken, getAdminToken } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui";
import {
  Badge,
  Button,
  AdminPageHeader,
  AdminConfirmDialog,
  AdminPagination,
  adminCardClass,
  adminInputClass,
  adminSelectClass,
} from "../_components/AdminUi";

export default function CommentsAdminPage() {
  const router = useRouter();
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [seriType, setSeriType] = useState("");
  const [reportedOnly, setReportedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [dismissingId, setDismissingId] = useState<number | null>(null);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) {
      router.replace("/login-admin");
      return;
    }

    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.append("search", search);
      if (seriType) params.append("seri_type", seriType);
      if (reportedOnly) params.append("reported_only", "true");

      const res = await apiFetch(`/admin/comments?${params}`, {
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
        if (data.status === "success") {
          setComments(data.data || []);
          setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        }
      }
    } catch (error) {
      console.error("Yorum listesi yüklenemedi:", error);
      toast.error("Yorumlar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, seriType, reportedOnly, search, router]);

  useEffect(() => {
    fetchComments();
  }, [page, seriType, reportedOnly, fetchComments]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchComments();
  };

  const handleDismissReports = async (commentId: number) => {
    if (dismissingId) return;
    setDismissingId(commentId);
    try {
      const res = await apiFetch(
        `/admin/comments/${commentId}/dismiss-reports`,
        {
          method: "POST",
          auth: "admin",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success("Şikayetler kapatıldı.");
        fetchComments();
      } else {
        toast.error(data.detail || data.message || "Şikayet kapatılamadı.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Hata oluştu.");
    } finally {
      setDismissingId(null);
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/admin/comments/${deleteTarget.id}`, {
        method: "DELETE",
        auth: "admin",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success("Yorum ve yanıtları silindi.");
        setDeleteTarget(null);
        fetchComments();
      } else {
        toast.error(data.detail || data.message || "Silinemedi.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Hata oluştu.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Yorumlar & Moderasyon"
        description={`Toplam ${(pagination.total || 0).toLocaleString("tr-TR")} yorum`}
      />

      <div className={`${adminCardClass} p-4 mb-6 space-y-3`}>
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Kullanıcı adı veya yorum içeriği ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${adminInputClass} pl-10`}
            />
          </div>

          <select
            value={seriType}
            onChange={(e) => {
              setSeriType(e.target.value);
              setPage(1);
            }}
            className={adminSelectClass}
          >
            <option value="">Tüm Türler</option>
            <option value="novel">Novel</option>
            <option value="webtoon">Webtoon</option>
          </select>

          <button
            type="button"
            onClick={() => {
              setReportedOnly((prev) => !prev);
              setPage(1);
            }}
            aria-pressed={reportedOnly}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
              reportedOnly
                ? "border-rose-500/50 bg-rose-500/15 text-rose-200 shadow-sm"
                : "border-subtle bg-canvas text-ink-secondary hover:border-hover hover:text-ink-primary"
            }`}
          >
            <Flag
              className={`h-3.5 w-3.5 ${
                reportedOnly ? "text-rose-400" : "text-ink-muted"
              }`}
            />
            <span>Sadece Şikayet Edilenler</span>
          </button>

          <Button type="submit" variant="secondary">
            Ara
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={`${adminCardClass} overflow-x-auto`}>
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3.5">ID</th>
                <th className="px-4 py-3.5">Kullanıcı</th>
                <th className="px-4 py-3.5">Seri</th>
                <th className="px-4 py-3.5">Hedef / Bölüm</th>
                <th className="px-4 py-3.5">Yorum</th>
                <th className="px-4 py-3.5">Şikayet</th>
                <th className="px-4 py-3.5">Tarih</th>
                <th className="px-4 py-3.5 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {comments.map((c) => {
                const reportCount = Number(c.report_count || 0);
                return (
                  <tr
                    key={c.id}
                    className={`hover:bg-white/[0.02] ${
                      reportCount > 0 ? "bg-rose-500/[0.04]" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5 text-xs text-ink-muted tabular-nums">
                      #{c.id}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium">
                      <Link
                        href={`/kullanici/${encodeURIComponent(c.username)}`}
                        className="text-brand hover:underline"
                        target="_blank"
                      >
                        {c.username}
                      </Link>
                      {c.parent_id && (
                        <span className="ml-1.5 text-[11px] text-ink-muted">
                          (yanıt)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-ink-secondary">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            c.seri_type === "webtoon" ? "webtoon" : "novel"
                          }
                          size="sm"
                        >
                          {c.seri_type === "webtoon" ? "W" : "N"}
                        </Badge>
                        <span className="truncate max-w-[160px]">
                          {c.seri_title || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-secondary">
                      {c.link ? (
                        <Link
                          href={c.link}
                          className="inline-flex items-center gap-1 text-sky-400 hover:underline"
                          target="_blank"
                        >
                          <span>
                            {c.target_label || c.bolum_title || "Görüntüle"}
                          </span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      ) : (
                        c.target_label || c.bolum_title || "—"
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-ink-secondary max-w-xs">
                      <div className="space-y-1">
                        {c.is_spoiler && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                            <AlertTriangle className="h-3 w-3" />
                            Spoiler
                          </span>
                        )}
                        <p className="line-clamp-2 break-words">{c.content}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs">
                      {reportCount > 0 ? (
                        <div className="space-y-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-xs font-bold text-rose-300 tabular-nums">
                            <Flag className="h-3 w-3 text-rose-400" />
                            {reportCount} Şikayet
                          </span>
                          {c.latest_report_reason && (
                            <p className="text-[11px] text-ink-muted truncate max-w-[140px]">
                              Sebep: {c.latest_report_reason}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-ink-muted whitespace-nowrap">
                      {new Date(c.created_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {reportCount > 0 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            loading={dismissingId === c.id}
                            onClick={() => handleDismissReports(c.id)}
                            className="text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                            title="Şikayetleri kapat"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Şikayeti Kapat
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(c)}
                          className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {comments.length === 0 && (
            <div className="text-center py-10 text-ink-muted text-sm">
              Yorum bulunamadı.
            </div>
          )}
        </div>
      )}

      <AdminPagination
        page={page}
        totalPages={pagination.pages || 1}
        onPageChange={setPage}
      />

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Yorumu Sil"
        description="Bu yorumu ve varsa alt yanıtlarını kalıcı olarak silmek istediğinize emin misiniz?"
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}
