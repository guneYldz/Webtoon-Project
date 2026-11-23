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
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, clearAdminToken, getAdminToken } from "@/lib/apiClient";
import { Skeleton, buttonClasses } from "@/components/ui";
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

export default function NovelsListPage() {
  const router = useRouter();
  const [novels, setNovels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [publishedFilter, setPublishedFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({});
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchNovels = useCallback(async () => {
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

      const res = await apiFetch(`/admin/novels?${params}`, {
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
          setNovels(data.data);
          setPagination(data.pagination || {});
        } else if (Array.isArray(data)) {
          setNovels(data);
          setPagination({
            page: 1,
            limit: data.length,
            total: data.length,
            pages: 1,
          });
        }
      }
    } catch (error) {
      console.error("Novel listesi yüklenemedi:", error);
      toast.error("Novel listesi yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, publishedFilter, search, router]);

  useEffect(() => {
    fetchNovels();
  }, [page, statusFilter, publishedFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchNovels();
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/admin/novels/${deleteTarget.id}`, {
        method: "DELETE",
        auth: "admin",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Novel silindi.");
        setDeleteTarget(null);
        fetchNovels();
      } else {
        toast.error(data.detail || "Novel silinemedi.");
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
        title="Noveller"
        description="Tüm web novel serilerini yönetin, düzenleyin veya yeni bölüm ekleyin."
        actions={
          <>
            <Link
              href="/admin/novel-bolum-ekle"
              className={buttonClasses({ variant: "secondary", size: "md" })}
            >
              <FilePlus2 className="h-4 w-4" />
              Bölüm Ekle
            </Link>
            <Link
              href="/admin/novel-ekle"
              className={buttonClasses({ variant: "primary", size: "md" })}
            >
              <Plus className="h-4 w-4" />
              Yeni Novel
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
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Başlık</th>
                <th className="px-5 py-3.5">Yazar</th>
                <th className="px-5 py-3.5">Durum</th>
                <th className="px-5 py-3.5">Vitrin</th>
                <th className="px-5 py-3.5">Yayın</th>
                <th className="px-5 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {novels.map((novel) => (
                <tr key={novel.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 text-xs text-ink-muted tabular-nums">
                    #{novel.id}
                  </td>
                  <td className="px-5 py-3.5 max-w-xs">
                    <p className="text-sm font-semibold text-ink-primary truncate">
                      {novel.title}
                    </p>
                    <p className="text-xs text-ink-muted truncate">
                      {novel.summary}
                    </p>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-ink-secondary">
                    {novel.author || "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge
                      variant={novel.status === "ongoing" ? "ongoing" : "completed"}
                      dot
                    >
                      {novel.status === "ongoing" ? "Devam Ediyor" : "Tamamlandı"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    {novel.is_featured ? (
                      <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
                        <Star className="h-3.5 w-3.5 fill-current" />
                        Öne Çıkan
                      </span>
                    ) : (
                      <span className="text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs">
                    {novel.is_published ? (
                      <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Yayında
                      </span>
                    ) : (
                      <span className="text-ink-muted">Taslak</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Link
                        href={`/admin/novels/${novel.id}/edit`}
                        className={buttonClasses({ variant: "ghost", size: "sm" })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Düzenle
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(novel)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Sil
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {novels.length === 0 && (
            <div className="text-center py-10 text-ink-muted text-sm">
              Henüz novel eklenmemiş.
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
        title="Novel'ı Sil"
        description={`"${deleteTarget?.title || ""}" romanını ve tüm bölümlerini kalıcı olarak silmek istiyor musunuz?`}
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}
