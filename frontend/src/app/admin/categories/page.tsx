"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, clearAdminToken, getAdminToken } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui";
import {
  Button,
  AdminPageHeader,
  AdminConfirmDialog,
  adminCardClass,
  adminInputClass,
} from "../_components/AdminUi";

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    const token = getAdminToken();
    if (!token) {
      router.replace("/login-admin");
      return;
    }

    try {
      const res = await apiFetch("/admin/categories", {
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
          setCategories(data.data || []);
        }
      }
    } catch (error) {
      console.error("Kategoriler yüklenemedi:", error);
      toast.error("Kategoriler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim() || creating) return;
    setCreating(true);

    try {
      const form = new FormData();
      form.append("name", newCategoryName.trim());

      const res = await apiFetch("/admin/categories", {
        method: "POST",
        auth: "admin",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Kategori eklendi.");
        setNewCategoryName("");
        fetchCategories();
      } else {
        toast.error(data.detail || "Kategori eklenemedi.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Hata oluştu.");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id: number) => {
    if (!editingName.trim()) return;
    try {
      const form = new FormData();
      form.append("name", editingName.trim());

      const res = await apiFetch(`/admin/categories/${id}`, {
        method: "PUT",
        auth: "admin",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Kategori güncellendi.");
        setEditingId(null);
        fetchCategories();
      } else {
        toast.error(data.detail || "Güncellenemedi.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Güncelleme hatası.");
    }
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(`/admin/categories/${deleteTarget.id}`, {
        method: "DELETE",
        auth: "admin",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Kategori silindi.");
        setDeleteTarget(null);
        fetchCategories();
      } else {
        toast.error(data.detail || "Silinemedi.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Silme hatası.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <AdminPageHeader
        title="Kategoriler"
        description="Serilere atanabilecek tür ve kategori etiketlerini yönetin."
      />

      <div className={`${adminCardClass} p-5 mb-6`}>
        <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Yeni kategori adı (örn: Aksiyon, Fantastik)..."
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className={adminInputClass}
            required
          />
          <Button
            type="submit"
            variant="primary"
            loading={creating}
            className="shrink-0"
          >
            <Plus className="h-4 w-4" />
            Kategori Ekle
          </Button>
        </form>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className={`${adminCardClass} overflow-hidden`}>
          <table className="w-full text-left">
            <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-5 py-3.5">ID</th>
                <th className="px-5 py-3.5">Kategori Adı</th>
                <th className="px-5 py-3.5 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-subtle">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-3.5 text-xs text-ink-muted tabular-nums">
                    #{cat.id}
                  </td>
                  <td className="px-5 py-3.5">
                    {editingId === cat.id ? (
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className={`${adminInputClass} max-w-xs h-8`}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-medium text-ink-primary">
                        {cat.name}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {editingId === cat.id ? (
                        <>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            onClick={() => handleUpdate(cat.id)}
                          >
                            <Check className="h-3.5 w-3.5" />
                            Kaydet
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                            İptal
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingId(cat.id);
                              setEditingName(cat.name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Düzenle
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                            onClick={() => setDeleteTarget(cat)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Sil
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {categories.length === 0 && (
            <div className="text-center py-10 text-ink-muted text-sm">
              Henüz kategori eklenmemiş.
            </div>
          )}
        </div>
      )}

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Kategoriyi Sil"
        description={`"${deleteTarget?.name || ""}" kategorisini silmek istediğinize emin misiniz?`}
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}
