"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Trash2, ExternalLink } from "lucide-react";
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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

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
  }, [page, seriType, search, router]);

  useEffect(() => {
    fetchComments();
  }, [page, seriType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchComments();
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
        title="Yorumlar"
        description={`Toplam ${(pagination.total || 0).toLocaleString("tr-TR")} yorum`}
      />

      <div className={`${adminCardClass} p-4 mb-6`}>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
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
          <table className="w-full min-w-[800px] text-left">
            <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3.5">ID</th>
                <th className="px-4 py-3.5">Kullanıcı</th>
                <th className="px-4 py-3.5">Seri</th>
                <th className="px-4 py-3.5">Bölüm</th>
                <th className="px-4 py-3.5">Yorum</th>
                <th className="px-4 py-3.5">Tarih</th>
                <th className="px-4 py-3.5 text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {comments.map((c) => (
                <tr key={c.id} className="hover:bg-white/[0.02]">
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
                        variant={c.seri_type === "webtoon" ? "webtoon" : "novel"}
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
                        <span>{c.bolum_title || "Bölüm"}</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      c.bolum_title || "—"
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-sm text-ink-secondary max-w-xs">
                    <p className="line-clamp-2 break-words">{c.content}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-ink-muted whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3.5 text-right">
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
                  </td>
                </tr>
              ))}
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
