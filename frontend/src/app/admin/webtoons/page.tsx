"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  Plus,
  FilePlus2,
  Pencil,
  Trash2,
  Star,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, clearAdminToken, getAdminToken } from "@/lib/apiClient";
import { seriesTypeLabel } from "@/lib/seriesType";
import {
  badgeVariantFromSeriesType,
  Skeleton,
  buttonClasses,
} from "@/components/ui";
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

export default function WebtoonsListPage() {
  const router = useRouter();
  const [webtoons, setWebtoons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({});
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchWebtoons = useCallback(async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) {
      router.replace("/login-admin");
      return;
    }

    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.append("search", search);
      if (statusFilter) params.append("status", statusFilter);
      if (publishedFilter !== "") params.append("is_published", publishedFilter);

      const res = await apiFetch(`/admin/webtoons?${params}`, {
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
        if (data.status === "success" && data.data) {
          setWebtoons(data.data);
          setPagination(data.pagination || {});
        } else if (Array.isArray(data)) {
          setWebtoons(data);
          setPagination({
            page: 1,
            limit: data.length,
            total: data.length,
            pages: 1,
          });
        }
      }
    } catch (error) {
      console.error("Webtoon listesi yüklenemedi:", error);
      toast.error("Webtoon listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, publishedFilter, search, router]);

  useEffect(() => {
    fetchWebtoons();
  }, [page, statusFilter, publishedFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWebtoons();
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/admin/webtoons/${deleteTarget.id}`, {
        method: "DELETE",
        auth: "admin",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Seri silindi.");
        setDeleteTarget(null);
        fetchWebtoons();
      } else {
        toast.error(data.detail || "Seri silinemedi.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Silme hatası.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Webtoon & Manga"
        description="Tüm webtoon ve manga serilerini arayın, düzenleyin veya yeni seri ekleyin."
        actions={
          <>
            <Link
              href="/admin/bolum-ekle"
              className={buttonClasses({ variant: "secondary", size: "md" })}
            >
              <FilePlus2 className="h-4 w-4" />
              Bölüm Ekle
            </Link>
            <Link
              href="/admin/webtoon-ekle"
              className={buttonClasses({ variant: "primary", size: "md" })}
            >
              <Plus className="h-4 w-4" />
              Webtoon / Manga Ekle
            </Link>
          </>
        }
      />

      <div className={`${adminCardClass} p-4 mb-6`}>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Başlık veya özet ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${adminInputClass} pl-10`}
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className={adminSelectClass}
          >
            <option value="">Tüm Durumlar</option>
            <option value="ongoing">Devam Ediyor</option>
            <option value="completed">Tamamlandı</option>
          </select>

          <select
            value={publishedFilter}
            onChange={(e) => {
              setPublishedFilter(e.target.value);
              setPage(1);
            }}
            className={adminSelectClass}
          >
            <option value="">Tüm Yayınlar</option>
            <option value="true">Yayında</option>
            <option value="false">Taslak</option>
          </select>

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
          <table className="w-full min-w-[780px] text-left">
            <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Başlık</th>
                <th className="px-5 py-3.5">Tür</th>
                <th className="px-5 py-3.5">Durum</th>
                <th className="px-5 py-3.5">Vitrin</th>
                <th className="px-5 py-3.5">Yayın</th>
                <th className="px-5 py-3.5">Okunma</th>
                <th className="px-5 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {webtoons.map((w) => {
                const label = seriesTypeLabel(w.type, w.typeLabel);
                return (
                  <tr key={w.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 text-xs text-ink-muted tabular-nums">
                      #{w.id}
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-sm font-semibold text-ink-primary truncate">
                        {w.title}
                      </p>
                      <p className="text-xs text-ink-muted truncate">
                        {w.summary}
                      </p>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={badgeVariantFromSeriesType(label)}>
                        {label === "MANGA" ? "Manga" : "Webtoon"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge
                        variant={w.status === "ongoing" ? "ongoing" : "completed"}
                        dot
                      >
                        {w.status === "ongoing" ? "Devam Ediyor" : "Tamamlandı"}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {w.is_featured ? (
                        <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          Öne Çıkan
                        </span>
                      ) : (
                        <span className="text-ink-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {w.is_published ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Yayında
                        </span>
                      ) : (
                        <span className="text-ink-muted">Taslak</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-secondary tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Eye className="h-3.5 w-3.5 text-ink-muted" />
                        {(w.view_count || 0).toLocaleString("tr-TR")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/admin/webtoons/${w.id}/edit`}
                          className={buttonClasses({ variant: "ghost", size: "sm" })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Düzenle
                        </Link>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteTarget(w)}
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

          {webtoons.length === 0 && (
            <div className="text-center py-10 text-ink-muted text-sm">
              Henüz webtoon veya manga bulunamadı.
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
        title="Seriyi Sil"
        description={`"${deleteTarget?.title || ""}" serisini ve tüm bölümlerini kalıcı olarak silmek istiyor musunuz?`}
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}
