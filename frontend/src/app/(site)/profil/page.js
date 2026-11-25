"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Camera,
  MessageSquare,
  Heart,
  Settings,
  LogOut,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CornerDownRight,
  Calendar,
  Save,
  KeyRound,
  Bell,
  BellOff,
} from "lucide-react";
import { apiFetch, resolveMediaUrl, logoutUser } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";
import {
  Button,
  Badge,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";

const LIBRARY_STATUS_OPTIONS = [
  { value: "reading", label: "Okuyorum" },
  { value: "plan_to_read", label: "Okuyacağım" },
  { value: "completed", label: "Tamamladım" },
  { value: "dropped", label: "Bıraktım" },
];

const STATUS_FILTER_PILLS = [
  { value: "ALL", label: "Tümü" },
  ...LIBRARY_STATUS_OPTIONS,
];

function isNovelFavorite(fav) {
  return String(fav?.type || fav?.tag || "")
    .toUpperCase()
    .includes("NOVEL");
}

function getFavoriteSeriesId(fav) {
  if (isNovelFavorite(fav)) {
    return Number(fav?.novel_id ?? fav?.id);
  }
  return Number(fav?.webtoon_id ?? fav?.id);
}

function ProfileContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "yorumlar";

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  const [tab, setTab] = useState(
    ["yorumlar", "favoriler", "ayarlar"].includes(initialTab)
      ? initialTab
      : "yorumlar"
  );

  const [editForm, setEditForm] = useState({ username: "", email: "" });
  const [passForm, setPassForm] = useState({
    old_password: "",
    new_password: "",
  });
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);

  const [comments, setComments] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [favStatusFilter, setFavStatusFilter] = useState("ALL");
  const [updatingFavKey, setUpdatingFavKey] = useState(null);

  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && ["yorumlar", "favoriler", "ayarlar"].includes(t)) {
      setTab(t);
    }
  }, [searchParams]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/login");
      return;
    }
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await apiFetch("/auth/me", { auth: "user" });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        setEditForm({
          username: data.username || "",
          email: data.email || "",
        });
        fetchActivity(data.username);
      } else {
        localStorage.removeItem("token");
        router.push("/login");
      }
    } catch (err) {
      console.error(err);
      toast.error("Profil bilgileri yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivity = async (username) => {
    try {
      const [cRes, fRes] = await Promise.all([
        apiFetch(`/comments/kullanici/${encodeURIComponent(username)}`),
        apiFetch("/favorites/listele", { auth: "user" }),
      ]);
      if (cRes.ok) setComments(await cRes.json());
      if (fRes.ok) setFavorites(await fRes.json());
    } catch (err) {
      console.error("Aktivite yüklenemedi:", err);
    }
  };

  const favStatusCounts = useMemo(() => {
    const counts = {
      ALL: favorites.length,
      reading: 0,
      plan_to_read: 0,
      completed: 0,
      dropped: 0,
    };
    for (const fav of favorites) {
      const st = fav.status || "reading";
      if (counts[st] !== undefined) counts[st] += 1;
      else counts.reading += 1;
    }
    return counts;
  }, [favorites]);

  const filteredFavorites = useMemo(() => {
    if (favStatusFilter === "ALL") return favorites;
    return favorites.filter(
      (fav) => (fav.status || "reading") === favStatusFilter
    );
  }, [favorites, favStatusFilter]);

  const handleUpdateFavoriteMeta = async (fav, patch) => {
    const novel = isNovelFavorite(fav);
    const seriesId = getFavoriteSeriesId(fav);
    if (!seriesId) return;

    const itemKey = `${novel ? "novel" : "webtoon"}:${seriesId}`;
    setUpdatingFavKey(itemKey);

    const prevFavorites = favorites;
    setFavorites((curr) =>
      curr.map((item) => {
        if (
          isNovelFavorite(item) === novel &&
          getFavoriteSeriesId(item) === seriesId
        ) {
          return { ...item, ...patch };
        }
        return item;
      })
    );

    const payload = {
      ...(novel ? { novel_id: seriesId } : { webtoon_id: seriesId }),
      ...patch,
    };

    try {
      const res = await apiFetch("/favorites/guncelle", {
        method: "PATCH",
        auth: "user",
        json: payload,
      });

      if (!res.ok) {
        setFavorites(prevFavorites);
        toast.error("Kütüphane tercihi güncellenemedi.");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setFavorites((curr) =>
        curr.map((item) => {
          if (
            isNovelFavorite(item) === novel &&
            getFavoriteSeriesId(item) === seriesId
          ) {
            return {
              ...item,
              status: data.status ?? patch.status ?? item.status ?? "reading",
              notify_new_chapters:
                data.notify_new_chapters ??
                patch.notify_new_chapters ??
                item.notify_new_chapters ??
                true,
            };
          }
          return item;
        })
      );

      if (patch.status !== undefined) {
        const label =
          LIBRARY_STATUS_OPTIONS.find((o) => o.value === patch.status)?.label ||
          patch.status;
        toast.success(`Okuma durumu "${label}" olarak güncellendi.`);
      } else if (patch.notify_new_chapters !== undefined) {
        toast.success(
          patch.notify_new_chapters
            ? "Yeni bölüm bildirimleri açıldı."
            : "Bu seri için bildirimler sessize alındı."
        );
      }
    } catch {
      setFavorites(prevFavorites);
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setUpdatingFavKey(null);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await apiFetch("/auth/update-profile-image", {
        method: "POST",
        auth: "user",
        body: formData,
      });
      if (res.ok) {
        toast.success("Profil fotoğrafı güncellendi.");
        await fetchProfile();
        window.dispatchEvent(new Event("auth-change"));
      } else {
        toast.error("Fotoğraf yüklenirken bir hata oluştu.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Fotoğraf yüklenemedi.");
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await apiFetch("/auth/update-profile", {
        method: "PUT",
        auth: "user",
        json: editForm,
      });
      if (res.ok) {
        toast.success("Hesap bilgileriniz güncellendi.");
        await fetchProfile();
        window.dispatchEvent(new Event("auth-change"));
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Bilgiler güncellenemedi.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Bir bağlantı hatası oluştu.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!passForm.old_password || !passForm.new_password) {
      toast.error("Lütfen mevcut ve yeni şifrenizi girin.");
      return;
    }
    setSavingPass(true);
    try {
      const res = await apiFetch("/auth/change-password", {
        method: "POST",
        auth: "user",
        json: passForm,
      });
      if (res.ok) {
        toast.success("Şifreniz başarıyla değiştirildi.");
        setPassForm({ old_password: "", new_password: "" });
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || "Şifre değiştirilemedi.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Şifre değiştirilirken hata oluştu.");
    } finally {
      setSavingPass(false);
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    toast.success("Oturum kapatıldı.");
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-6">
        <Skeleton className="h-44 w-full rounded-3xl" />
        <Skeleton className="h-10 w-80 rounded-xl" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 font-sans">
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-10">
        {/* HORIZONTAL PROFILE HEADER BANNER */}
        <div className="relative rounded-3xl border border-subtle bg-surface/90 p-6 sm:p-8 mb-8 shadow-2xl overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-brand via-indigo-500 to-purple-400 opacity-75" />

          <div className="flex flex-col sm:flex-row items-center gap-6">
            {/* Avatar + Upload Trigger */}
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 shrink-0 group">
              <div className="w-full h-full rounded-full ring-2 ring-brand/60 ring-offset-4 ring-offset-surface overflow-hidden bg-elevated">
                {user?.profile_image ? (
                  <img
                    src={resolveMediaUrl(user.profile_image)}
                    alt={user.username || "Profil"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-black text-brand bg-brand/10">
                    {user?.username?.charAt(0).toUpperCase() || "U"}
                  </div>
                )}
              </div>
              <label
                className="absolute bottom-0 right-0 inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand hover:bg-brand-hover text-white cursor-pointer transition-all shadow-lg ring-2 ring-surface"
                title="Profil fotoğrafını değiştir"
              >
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={uploading}
                />
              </label>
            </div>

            {/* User Meta & Stats */}
            <div className="flex-1 text-center sm:text-left min-w-0">
              <div className="flex items-center gap-2.5 justify-center sm:justify-start flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-ink-primary truncate">
                  {user?.username}
                </h1>
                <Badge
                  variant={
                    user?.role === "admin"
                      ? "new"
                      : user?.role === "editor"
                      ? "manga"
                      : "webtoon"
                  }
                  size="md"
                >
                  {user?.role || "user"}
                </Badge>
              </div>

              <p className="text-ink-secondary text-sm mt-1 truncate">
                {user?.email}
              </p>

              <div className="flex items-center gap-6 mt-4 justify-center sm:justify-start">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black text-ink-primary leading-none">
                      {comments.length}
                    </p>
                    <p className="text-[11px] text-ink-muted uppercase tracking-wider">
                      Yorum
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/15 text-rose-400">
                    <Heart className="h-4 w-4" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black text-ink-primary leading-none">
                      {favorites.length}
                    </p>
                    <p className="text-[11px] text-ink-muted uppercase tracking-wider">
                      Favori
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex sm:flex-col gap-2.5 shrink-0 w-full sm:w-auto justify-center">
              <Button
                variant={tab === "ayarlar" ? "primary" : "secondary"}
                size="sm"
                onClick={() => setTab("ayarlar")}
                className="flex-1 sm:flex-initial"
              >
                <Settings className="h-4 w-4" />
                <span>Hesap Ayarları</span>
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleLogout}
                className="flex-1 sm:flex-initial"
              >
                <LogOut className="h-4 w-4" />
                <span>Çıkış Yap</span>
              </Button>
            </div>
          </div>
        </div>

        {/* TABS: YORUMLARIM | FAVORİLERİM | HESAP AYARLARI */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList
            variant="underline"
            className="w-full justify-start mb-6 overflow-x-auto"
          >
            <TabsTrigger value="yorumlar" variant="underline">
              <MessageSquare className="h-4 w-4" />
              <span>Yorumlarım ({comments.length})</span>
            </TabsTrigger>
            <TabsTrigger value="favoriler" variant="underline">
              <Heart className="h-4 w-4" />
              <span>Favorilerim ({favorites.length})</span>
            </TabsTrigger>
            <TabsTrigger value="ayarlar" variant="underline">
              <Settings className="h-4 w-4" />
              <span>Hesap Ayarları</span>
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: YORUMLARIM */}
          <TabsContent value="yorumlar">
            {comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-subtle bg-surface/50">
                <MessageSquare className="h-8 w-8 text-ink-muted mb-2.5" />
                <p className="text-sm font-semibold text-ink-primary">
                  Henüz yorum yapmadın
                </p>
                <p className="text-xs text-ink-secondary mt-1">
                  Okuduğun bölümlere ve serilere yaptığın yorumlar burada listelenir.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {comments.map((c) => (
                  <div
                    key={c.id}
                    className="bg-surface p-5 rounded-2xl border border-subtle hover:border-hover transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2 text-xs sm:text-sm flex-wrap">
                      {c.link ? (
                        <Link
                          href={c.link}
                          className="text-brand font-bold hover:text-purple-300 transition-colors"
                        >
                          {c.seri_title} — {c.bolum_title}
                        </Link>
                      ) : (
                        <span className="text-ink-secondary font-bold">
                          {c.seri_title || "Bilinmeyen bölüm"}
                        </span>
                      )}
                      {c.parent_id && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted bg-elevated px-2 py-0.5 rounded-full border border-subtle">
                          <CornerDownRight className="h-3 w-3" />
                          <span>Yanıt</span>
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 text-ink-muted text-xs ml-auto">
                        <Calendar className="h-3 w-3" />
                        {new Date(c.created_at).toLocaleDateString("tr-TR")}
                      </span>
                    </div>
                    <p className="text-ink-primary text-sm leading-relaxed break-words">
                      {c.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAB 2: FAVORİLERİM */}
          <TabsContent value="favoriler">
            {favorites.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center rounded-2xl border border-dashed border-subtle bg-surface/50">
                <Heart className="h-8 w-8 text-ink-muted mb-2.5" />
                <p className="text-sm font-semibold text-ink-primary">
                  Henüz favori serin yok
                </p>
                <p className="text-xs text-ink-secondary mt-1">
                  Beğendiğin serileri favorilerine ekleyerek buradan takip edebilirsin.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Status Filter Pills */}
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
                  {STATUS_FILTER_PILLS.map((pill) => {
                    const active = favStatusFilter === pill.value;
                    const count = favStatusCounts[pill.value] ?? 0;
                    return (
                      <button
                        key={pill.value}
                        type="button"
                        onClick={() => setFavStatusFilter(pill.value)}
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
                          active
                            ? "bg-brand text-white border-brand shadow-sm shadow-brand/30"
                            : "bg-surface text-ink-secondary border-subtle hover:text-ink-primary hover:border-hover"
                        }`}
                      >
                        <span>{pill.label}</span>
                        <span
                          className={`px-1.5 py-0.2 rounded-full text-[11px] tabular-nums ${
                            active
                              ? "bg-white/20 text-white"
                              : "bg-canvas/70 text-ink-muted"
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {filteredFavorites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-subtle bg-surface/50 py-12 text-center">
                    <p className="text-sm text-ink-secondary">
                      Bu okuma durumunda henüz seri bulunmuyor.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5">
                    {filteredFavorites.map((f, idx) => {
                      const novel = isNovelFavorite(f);
                      const seriesId = getFavoriteSeriesId(f);
                      const itemKey = `${novel ? "novel" : "webtoon"}:${seriesId}`;
                      const currentStatus = f.status || "reading";
                      const notifyEnabled = f.notify_new_chapters !== false;
                      const isBusy = updatingFavKey === itemKey;

                      return (
                        <div
                          key={`${f.type}-${f.id || idx}`}
                          className="flex flex-col gap-2"
                        >
                          <SeriesCard series={f} />

                          <div className="flex items-center gap-1.5">
                            <select
                              value={currentStatus}
                              disabled={isBusy}
                              onChange={(e) =>
                                handleUpdateFavoriteMeta(f, {
                                  status: e.target.value,
                                })
                              }
                              aria-label={`${f.title} okuma durumu`}
                              className="flex-1 min-w-0 h-8 rounded-lg border border-subtle bg-surface px-2.5 text-xs font-semibold text-ink-secondary hover:border-hover focus:border-brand focus:text-ink-primary focus:outline-none transition disabled:opacity-50"
                            >
                              {LIBRARY_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
                                handleUpdateFavoriteMeta(f, {
                                  notify_new_chapters: !notifyEnabled,
                                })
                              }
                              title={
                                notifyEnabled
                                  ? "Yeni bölüm bildirimleri açık"
                                  : "Yeni bölüm bildirimleri sessizde"
                              }
                              aria-label={
                                notifyEnabled
                                  ? "Yeni bölüm bildirimlerini kapat"
                                  : "Yeni bölüm bildirimlerini aç"
                              }
                              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-50 ${
                                notifyEnabled
                                  ? "border-brand/40 bg-brand/15 text-brand hover:bg-brand/25"
                                  : "border-subtle bg-surface text-ink-muted hover:text-ink-primary hover:border-hover"
                              }`}
                            >
                              {notifyEnabled ? (
                                <Bell className="h-3.5 w-3.5" />
                              ) : (
                                <BellOff className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* TAB 3: HESAP AYARLARI */}
          <TabsContent value="ayarlar">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Details Form */}
              <form
                onSubmit={handleUpdateProfile}
                className="rounded-2xl border border-subtle bg-surface p-6 space-y-4"
              >
                <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand">
                    <User className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink-primary">
                      Profil Bilgileri
                    </h2>
                    <p className="text-xs text-ink-secondary">
                      Kullanıcı adını ve e-posta adresini güncelle.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary mb-1.5">
                    Kullanıcı Adı
                  </label>
                  <div className="relative">
                    <User className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) =>
                        setEditForm({ ...editForm, username: e.target.value })
                      }
                      className="w-full rounded-xl border border-subtle bg-canvas py-2.5 pl-10 pr-4 text-sm text-ink-primary focus:border-brand focus:outline-none"
                      placeholder="Kullanıcı Adı"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary mb-1.5">
                    E-posta Adresi
                  </label>
                  <div className="relative">
                    <Mail className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) =>
                        setEditForm({ ...editForm, email: e.target.value })
                      }
                      className="w-full rounded-xl border border-subtle bg-canvas py-2.5 pl-10 pr-4 text-sm text-ink-primary focus:border-brand focus:outline-none"
                      placeholder="ornek@email.com"
                      required
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    loading={savingProfile}
                    className="w-full"
                  >
                    <Save className="h-4 w-4" />
                    <span>Değişiklikleri Kaydet</span>
                  </Button>
                </div>
              </form>

              {/* Password Change Form */}
              <form
                onSubmit={handleChangePassword}
                className="rounded-2xl border border-subtle bg-surface p-6 space-y-4"
              >
                <div className="flex items-center gap-2.5 pb-3 border-b border-subtle">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/15 text-brand">
                    <KeyRound className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-ink-primary">
                      Şifre ve Güvenlik
                    </h2>
                    <p className="text-xs text-ink-secondary">
                      Hesap güvenliği için şifreni düzenli olarak yenile.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary mb-1.5">
                    Mevcut Şifre
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showOldPass ? "text" : "password"}
                      value={passForm.old_password}
                      onChange={(e) =>
                        setPassForm({
                          ...passForm,
                          old_password: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-subtle bg-canvas py-2.5 pl-10 pr-10 text-sm text-ink-primary focus:border-brand focus:outline-none"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
                      aria-label="Şifreyi göster/gizle"
                    >
                      {showOldPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-ink-secondary mb-1.5">
                    Yeni Şifre
                  </label>
                  <div className="relative">
                    <Lock className="h-4 w-4 text-ink-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type={showNewPass ? "text" : "password"}
                      value={passForm.new_password}
                      onChange={(e) =>
                        setPassForm({
                          ...passForm,
                          new_password: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-subtle bg-canvas py-2.5 pl-10 pr-10 text-sm text-ink-primary focus:border-brand focus:outline-none"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPass((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-ink-primary"
                      aria-label="Yeni şifreyi göster/gizle"
                    >
                      {showNewPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    variant="secondary"
                    size="md"
                    loading={savingPass}
                    className="w-full"
                  >
                    <Lock className="h-4 w-4" />
                    <span>Şifreyi Güncelle</span>
                  </Button>
                </div>
              </form>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 py-10 space-y-6">
          <Skeleton className="h-44 w-full rounded-3xl" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[0, 1, 2, 3].map((i) => (
              <SeriesCardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}
