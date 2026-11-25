"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Heart, Compass, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiClient";
import SeriesCard, { SeriesCardSkeleton } from "@/components/SeriesCard";
import {
  Badge,
  buttonClasses,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";

const FORMAT_TABS = [
  { value: "ALL", label: "Tüm Formatlar" },
  { value: "WEBTOON", label: "Webtoon & Manga" },
  { value: "NOVEL", label: "Novel" },
];

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

export default function FavoritesPage() {
  const router = useRouter();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formatFilter, setFormatFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [updatingKey, setUpdatingKey] = useState(null);

  useEffect(() => {
    const fetchFavorites = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        router.push("/login");
        return;
      }

      try {
        const res = await apiFetch("/favorites/listele", { auth: "user" });
        if (res.ok) {
          const data = await res.json();
          setFavorites(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Favoriler çekilemedi:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [router]);

  const statusCounts = useMemo(() => {
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
    return favorites.filter((fav) => {
      const novel = isNovelFavorite(fav);
      if (formatFilter === "NOVEL" && !novel) return false;
      if (formatFilter === "WEBTOON" && novel) return false;

      const currentStatus = fav.status || "reading";
      if (statusFilter !== "ALL" && currentStatus !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [favorites, formatFilter, statusFilter]);

  const handleUpdateFavoriteMeta = async (fav, patch) => {
    const novel = isNovelFavorite(fav);
    const seriesId = getFavoriteSeriesId(fav);
    if (!seriesId) return;

    const itemKey = `${novel ? "novel" : "webtoon"}:${seriesId}`;
    setUpdatingKey(itemKey);

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
      setUpdatingKey(null);
    }
  };

  return (
    <div className="min-h-screen pb-16 font-sans">
      {/* HEADER */}
      <div className="bg-surface/80 border-b border-subtle pt-8 pb-6 px-4 sm:px-6 mb-8">
        <div className="container mx-auto max-w-7xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-ink-primary flex items-center gap-3 tracking-tight">
                <span className="bg-rose-500/15 border border-rose-500/30 text-rose-400 w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
                  <Heart className="h-5 w-5 fill-rose-500/20" />
                </span>
                <span>Kütüphanem & Favoriler</span>
                <Badge variant="default" size="md" className="ml-1">
                  {favorites.length} Seri
                </Badge>
              </h1>
              <p className="text-ink-secondary text-sm mt-1.5">
                Takip ettiğin serilerin okuma durumunu ve yeni bölüm bildirimlerini yönet.
              </p>
            </div>

            <Tabs value={formatFilter} onValueChange={setFormatFilter}>
              <TabsList variant="pills">
                {FORMAT_TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {/* STATUS FILTER PILLS */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
            {STATUS_FILTER_PILLS.map((pill) => {
              const active = statusFilter === pill.value;
              const count = statusCounts[pill.value] ?? 0;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setStatusFilter(pill.value)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition whitespace-nowrap ${
                    active
                      ? "bg-brand text-white border-brand shadow-sm shadow-brand/30"
                      : "bg-elevated/70 text-ink-secondary border-subtle hover:text-ink-primary hover:border-hover"
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
        </div>
      </div>

      {/* CONTENT */}
      <div className="container mx-auto max-w-7xl px-4 sm:px-6">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 sm:gap-x-5">
            {Array.from({ length: 6 }).map((_, idx) => (
              <SeriesCardSkeleton key={idx} />
            ))}
          </div>
        ) : filteredFavorites.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-7 sm:gap-x-5">
            {filteredFavorites.map((fav, index) => {
              const novel = isNovelFavorite(fav);
              const seriesId = getFavoriteSeriesId(fav);
              const itemKey = `${novel ? "novel" : "webtoon"}:${seriesId}`;
              const currentStatus = fav.status || "reading";
              const notifyEnabled = fav.notify_new_chapters !== false;
              const isBusy = updatingKey === itemKey;

              return (
                <div
                  key={`${fav.type}-${fav.id || index}`}
                  className="flex flex-col gap-2"
                >
                  <SeriesCard series={fav} />

                  {/* Library Status Selector & Per-Series Bell Toggle */}
                  <div className="flex items-center gap-1.5">
                    <select
                      value={currentStatus}
                      disabled={isBusy}
                      onChange={(e) =>
                        handleUpdateFavoriteMeta(fav, {
                          status: e.target.value,
                        })
                      }
                      aria-label={`${fav.title} okuma durumu`}
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
                        handleUpdateFavoriteMeta(fav, {
                          notify_new_chapters: !notifyEnabled,
                        })
                      }
                      title={
                        notifyEnabled
                          ? "Yeni bölüm bildirimleri açık (kapatmak için tıkla)"
                          : "Yeni bölüm bildirimleri sessizde (açmak için tıkla)"
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
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border border-dashed border-subtle rounded-3xl bg-surface/60">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-400 mb-4">
              <Heart className="h-6 w-6" />
            </div>
            <h2 className="text-xl text-ink-primary font-bold mb-2">
              {favorites.length === 0
                ? "Henüz Favori Serin Yok"
                : "Bu Filtrede Seri Bulunamadı"}
            </h2>
            <p className="text-ink-secondary text-sm mb-6 max-w-md mx-auto">
              {favorites.length === 0
                ? "Beğendiğin webtoon, manga veya novelleri seri sayfasından favorilerine ekleyerek kendi okuma kütüphaneni oluşturabilirsin."
                : "Seçtiğin okuma durumu veya format filtresine uygun seri bulunmuyor."}
            </p>
            {favorites.length === 0 ? (
              <Link
                href="/kesfet"
                className={buttonClasses({ variant: "primary", size: "lg" })}
              >
                <Compass className="h-4 w-4" />
                <span>Serileri Keşfet</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setFormatFilter("ALL");
                }}
                className={buttonClasses({ variant: "secondary", size: "md" })}
              >
                Filtreleri Sıfırla
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
