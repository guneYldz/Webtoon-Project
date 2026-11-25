"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Heart, Loader2, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getUserToken } from "@/lib/apiClient";

const LIBRARY_STATUS_OPTIONS = [
  { value: "reading", label: "Okuyorum" },
  { value: "plan_to_read", label: "Okuyacağım" },
  { value: "completed", label: "Tamamladım" },
  { value: "dropped", label: "Bıraktım" },
];

export default function FavoriteButton({ type, id, className = "" }) {
  const router = useRouter();
  const [isFavorite, setIsFavorite] = useState(false);
  const [status, setStatus] = useState("reading");
  const [notifyNewChapters, setNotifyNewChapters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [updatingMeta, setUpdatingMeta] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!id || !type) {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const checkStatus = async () => {
      const token = getUserToken();
      if (!token) {
        if (!cancelled) setChecking(false);
        return;
      }

      try {
        let res = await apiFetch(`/favorites/check/${type}/${id}`, {
          method: "GET",
          auth: "user",
          cache: "no-store",
        });

        if (res.status === 404) {
          const queryParam =
            type === "novel" ? `novel_id=${id}` : `webtoon_id=${id}`;
          res = await apiFetch(`/favorites/kontrol?${queryParam}`, {
            method: "GET",
            auth: "user",
            cache: "no-store",
          });
        }

        if (res.ok && !cancelled) {
          const data = await res.json();
          const fav = Boolean(data?.is_favorited ?? data?.is_favorite);
          setIsFavorite(fav);
          if (data?.status) setStatus(data.status);
          if (data?.notify_new_chapters !== undefined) {
            setNotifyNewChapters(Boolean(data.notify_new_chapters));
          }
        }
      } catch (err) {
        console.error("Favori kontrol hatası:", err);
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    checkStatus();
    return () => {
      cancelled = true;
    };
  }, [id, type]);

  const toggleFavorite = async () => {
    const token = getUserToken();
    if (!token) {
      toast.info("Favorilere eklemek için giriş yapmalısın.", {
        action: {
          label: "Giriş Yap",
          onClick: () => router.push("/login"),
        },
      });
      return;
    }

    if (!id || loading) return;

    setLoading(true);
    const previousState = isFavorite;
    setIsFavorite(!isFavorite);

    const payload =
      type === "novel"
        ? { novel_id: id, status, notify_new_chapters: notifyNewChapters }
        : { webtoon_id: id, status, notify_new_chapters: notifyNewChapters };

    try {
      const res = await apiFetch("/favorites/toggle", {
        method: "POST",
        auth: "user",
        json: payload,
      });

      if (res.status === 401) {
        setIsFavorite(previousState);
        toast.info("Oturumun sona erdi, lütfen tekrar giriş yap.", {
          action: {
            label: "Giriş Yap",
            onClick: () => router.push("/login"),
          },
        });
        return;
      }

      if (!res.ok) {
        setIsFavorite(previousState);
        toast.error("Favori işlemi başarısız oldu.");
        return;
      }

      const data = await res.json();
      const nextFav =
        data?.is_favorited !== undefined
          ? Boolean(data.is_favorited)
          : data?.is_favorite !== undefined
          ? Boolean(data.is_favorite)
          : !previousState;

      setIsFavorite(nextFav);
      if (data?.status) setStatus(data.status);
      if (data?.notify_new_chapters !== undefined) {
        setNotifyNewChapters(Boolean(data.notify_new_chapters));
      }

      toast.success(
        nextFav ? "Favorilere eklendi." : "Favorilerden çıkarıldı."
      );
    } catch (err) {
      console.error("Favori hatası:", err);
      setIsFavorite(previousState);
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setLoading(false);
    }
  };

  const updateFavoriteMeta = async (patch) => {
    if (!id || updatingMeta) return;
    setUpdatingMeta(true);

    const prevStatus = status;
    const prevNotify = notifyNewChapters;
    if (patch.status !== undefined) setStatus(patch.status);
    if (patch.notify_new_chapters !== undefined) {
      setNotifyNewChapters(patch.notify_new_chapters);
    }

    const payload = {
      ...(type === "novel" ? { novel_id: id } : { webtoon_id: id }),
      ...patch,
    };

    try {
      const res = await apiFetch("/favorites/guncelle", {
        method: "PATCH",
        auth: "user",
        json: payload,
      });

      if (!res.ok) {
        setStatus(prevStatus);
        setNotifyNewChapters(prevNotify);
        toast.error("Tercih güncellenemedi.");
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (data?.status) setStatus(data.status);
      if (data?.notify_new_chapters !== undefined) {
        setNotifyNewChapters(Boolean(data.notify_new_chapters));
      }

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
      setStatus(prevStatus);
      setNotifyNewChapters(prevNotify);
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setUpdatingMeta(false);
    }
  };

  const defaultBase =
    "h-11 px-5 rounded-xl font-semibold text-sm border transition-all duration-200 ease-smooth inline-flex items-center justify-center gap-2 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60";

  const stateClass = className
    ? `${className} ${
        isFavorite
          ? "!bg-rose-600/90 !border-rose-400/60 !text-white !shadow-md !shadow-rose-950/40"
          : ""
      }`
    : `${defaultBase} ${
        isFavorite
          ? "bg-rose-500/20 border-rose-500/50 text-rose-200 hover:bg-rose-500/30 shadow-sm shadow-rose-950/30"
          : "bg-elevated/90 border-white/15 text-ink-primary hover:border-rose-400/50 hover:text-rose-200 hover:bg-white/[0.06]"
      }`;

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleFavorite}
        disabled={loading || checking || !id}
        aria-pressed={isFavorite}
        className={`group inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${stateClass}`}
      >
        {loading || checking ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden="true" />
            <span>{checking ? "Kontrol ediliyor..." : "İşleniyor..."}</span>
          </>
        ) : isFavorite ? (
          <>
            <Heart
              className="h-4 w-4 fill-rose-400 text-rose-400 transition-transform duration-200 group-hover:scale-110 shrink-0"
              aria-hidden="true"
            />
            <span>Favorilerde</span>
          </>
        ) : (
          <>
            <Heart
              className="h-4 w-4 text-current transition-transform duration-200 group-hover:scale-110 shrink-0"
              aria-hidden="true"
            />
            <span>Favorilere Ekle</span>
          </>
        )}
      </button>

      {isFavorite && !checking && (
        <div className="inline-flex items-center gap-1.5">
          <select
            value={status}
            disabled={updatingMeta}
            onChange={(e) => updateFavoriteMeta({ status: e.target.value })}
            aria-label="Okuma durumu seç"
            className="h-11 rounded-xl border border-white/15 bg-elevated/90 px-3 text-xs sm:text-sm font-semibold text-ink-primary hover:border-brand/50 focus:border-brand focus:outline-none transition disabled:opacity-50"
          >
            {LIBRARY_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={updatingMeta}
            onClick={() =>
              updateFavoriteMeta({ notify_new_chapters: !notifyNewChapters })
            }
            title={
              notifyNewChapters
                ? "Yeni bölüm bildirimleri açık (sessize almak için tıkla)"
                : "Yeni bölüm bildirimleri sessizde (açmak için tıkla)"
            }
            aria-label={
              notifyNewChapters
                ? "Yeni bölüm bildirimlerini kapat"
                : "Yeni bölüm bildirimlerini aç"
            }
            className={`inline-flex h-11 w-11 items-center justify-center rounded-xl border transition disabled:opacity-50 ${
              notifyNewChapters
                ? "border-brand/50 bg-brand/15 text-brand hover:bg-brand/25"
                : "border-white/15 bg-elevated/90 text-ink-muted hover:text-ink-primary hover:border-white/30"
            }`}
          >
            {notifyNewChapters ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
