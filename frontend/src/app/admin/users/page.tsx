"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ShieldAlert, ShieldCheck, Ban, CheckCircle2 } from "lucide-react";
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

export default function UsersListPage() {
  const router = useRouter();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<any>({});
  const [banTarget, setBanTarget] = useState<any>(null);
  const [updatingBan, setUpdatingBan] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const token = getAdminToken();
    if (!token) {
      router.replace("/login-admin");
      return;
    }

    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.append("search", search);
      if (roleFilter) params.append("role", roleFilter);

      const res = await apiFetch(`/admin/users?${params}`, {
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
          setUsers(data.data || []);
          setPagination(data.pagination || {});
        }
      }
    } catch (error) {
      console.error("Kullanıcı listesi yüklenemedi:", error);
      toast.error("Kullanıcılar yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [page, roleFilter, search, router]);

  useEffect(() => {
    fetchUsers();
  }, [page, roleFilter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const executeToggleBan = async () => {
    if (!banTarget) return;
    setUpdatingBan(true);
    try {
      const form = new FormData();
      form.append("is_active", String(!banTarget.is_active));

      const res = await apiFetch(`/admin/users/${banTarget.id}`, {
        method: "PUT",
        auth: "admin",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Kullanıcı durumu güncellendi.");
        setBanTarget(null);
        fetchUsers();
      } else {
        toast.error(data.detail || "İşlem başarısız.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Hata oluştu.");
    } finally {
      setUpdatingBan(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Üyeler"
        description="Kayıtlı kullanıcı hesaplarını arayın ve erişim durumunu yönetin."
      />

      <div className={`${adminCardClass} p-4 mb-6`}>
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Kullanıcı adı veya e-posta ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${adminInputClass} pl-10`}
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              setPage(1);
            }}
            className={adminSelectClass}
          >
            <option value="">Tüm Roller</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
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
        <>
          <div className="md:hidden space-y-3">
            {users.map((user) => (
              <div key={user.id} className={`${adminCardClass} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-ink-primary truncate">
                      {user.username}
                    </p>
                    <p className="text-xs text-ink-secondary break-all">
                      {user.email}
                    </p>
                    <p className="text-[11px] text-ink-muted mt-1">
                      ID #{user.id}
                    </p>
                  </div>
                  <Badge variant={user.role === "admin" ? "novel" : "webtoon"}>
                    {user.role}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-subtle">
                  {user.is_active ? (
                    <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
                      <Ban className="h-3.5 w-3.5" />
                      Yasaklı
                    </span>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setBanTarget(user)}
                    className={user.is_active ? "text-rose-400" : "text-emerald-400"}
                  >
                    {user.is_active ? "Yasakla" : "Yasağı Kaldır"}
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="text-center py-10 text-ink-muted text-sm">
                Kullanıcı bulunamadı.
              </div>
            )}
          </div>

          <div className={`hidden md:block ${adminCardClass} overflow-x-auto`}>
            <table className="w-full min-w-[640px] text-left">
              <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-5 py-3.5">ID</th>
                  <th className="px-5 py-3.5">Kullanıcı Adı</th>
                  <th className="px-5 py-3.5">E-posta</th>
                  <th className="px-5 py-3.5">Rol</th>
                  <th className="px-5 py-3.5">Durum</th>
                  <th className="px-5 py-3.5 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-subtle">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-3.5 text-xs text-ink-muted tabular-nums">
                      #{user.id}
                    </td>
                    <td className="px-5 py-3.5 text-sm font-semibold text-ink-primary">
                      {user.username}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-ink-secondary">
                      {user.email}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant={user.role === "admin" ? "novel" : "webtoon"}>
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      {user.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-semibold">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-semibold">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Yasaklı
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setBanTarget(user)}
                        className={
                          user.is_active
                            ? "text-rose-400 hover:bg-rose-500/10"
                            : "text-emerald-400 hover:bg-emerald-500/10"
                        }
                      >
                        {user.is_active ? "Yasakla" : "Yasağı Kaldır"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && (
              <div className="text-center py-10 text-ink-muted text-sm">
                Kullanıcı bulunamadı.
              </div>
            )}
          </div>
        </>
      )}

      <AdminPagination
        page={page}
        totalPages={pagination.pages || 1}
        onPageChange={setPage}
      />

      <AdminConfirmDialog
        open={Boolean(banTarget)}
        onOpenChange={(open) => !open && setBanTarget(null)}
        title={banTarget?.is_active ? "Kullanıcıyı Yasakla" : "Yasağı Kaldır"}
        description={
          banTarget?.is_active
            ? `${banTarget?.username} kullanıcısının site erişimini yasaklamak istiyor musunuz?`
            : `${banTarget?.username} kullanıcısının yasağını kaldırmak istiyor musunuz?`
        }
        confirmLabel={banTarget?.is_active ? "Yasakla" : "Yasağı Kaldır"}
        variant={banTarget?.is_active ? "danger" : "primary"}
        loading={updatingBan}
        onConfirm={executeToggleBan}
      />
    </div>
  );
}
