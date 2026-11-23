"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ThumbsUp,
  Laugh,
  Heart,
  Sparkles,
  Flame,
  Frown,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getUserToken } from "@/lib/apiClient";

const REACTIONS = [
  { key: "upvote", icon: ThumbsUp, label: "Beğen", tint: "text-sky-400" },
  { key: "funny", icon: Laugh, label: "Komik", tint: "text-amber-400" },
  { key: "love", icon: Heart, label: "Sevdim", tint: "text-rose-400" },
  { key: "surprised", icon: Sparkles, label: "Şaşırtıcı", tint: "text-purple-400" },
  { key: "angry", icon: Flame, label: "Kızgın", tint: "text-orange-400" },
  { key: "sad", icon: Frown, label: "Üzücü", tint: "text-indigo-400" },
];

const emptyCounts = () =>
  REACTIONS.reduce((acc, r) => {
    acc[r.key] = 0;
    return acc;
  }, {});

export default function ChapterReactions({ type, targetId }) {
  const router = useRouter();
  const [counts, setCounts] = useState(emptyCounts);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!type || !targetId) return;
    let cancelled = false;

    const token = getUserToken();
    apiFetch(`/reactions/${type}/${targetId}`, {
      auth: token ? "user" : "none",
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data || cancelled) return;
        setCounts({ ...emptyCounts(), ...(data.counts || {}) });
        setTotal(data.total || 0);
        setMine(data.mine || null);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [type, targetId]);

  const onPick = async (key) => {
    const token = getUserToken();
    if (!token) {
      toast.info("Tepki vermek için giriş yapmalısın.", {
        action: {
          label: "Giriş Yap",
          onClick: () => router.push("/login"),
        },
      });
      return;
    }

    if (busy) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/reactions/${type}/${targetId}`, {
        method: "POST",
        auth: "user",
        json: { reaction: key },
      });

      if (res.status === 401) {
        toast.info("Oturumun sona erdi, lütfen tekrar giriş yap.", {
          action: {
            label: "Giriş Yap",
            onClick: () => router.push("/login"),
          },
        });
        return;
      }

      if (!res.ok) {
        toast.error("Tepki kaydedilemedi.");
        return;
      }

      const data = await res.json();
      setCounts({ ...emptyCounts(), ...(data.counts || {}) });
      setTotal(data.total || 0);
      setMine(data.mine || null);
    } catch {
      toast.error("Tepki gönderilirken bağlantı hatası oluştu.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="w-full py-8">
      <div className="text-center mb-6">
        <h3 className="text-lg md:text-xl font-bold text-ink-primary tracking-tight">
          Bu bölümü nasıl buldun?
        </h3>
        <p className="text-ink-muted text-xs mt-1 font-medium">
          {total.toLocaleString("tr-TR")} tepki
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 max-w-2xl mx-auto w-full">
        {REACTIONS.map((r) => {
          const Icon = r.icon;
          const selected = mine === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onPick(r.key)}
              disabled={busy}
              aria-pressed={selected}
              aria-label={r.label}
              className={`group flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 transition-all duration-200 ease-smooth focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 disabled:opacity-60 ${
                selected
                  ? "bg-accent-soft border-accent-border text-ink-primary shadow-sm"
                  : "bg-surface border-subtle text-ink-secondary hover:border-hover hover:bg-elevated hover:text-ink-primary"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <Icon
                  className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${
                    selected ? "text-accent" : r.tint
                  }`}
                  aria-hidden="true"
                />
                <span className="text-sm font-bold tabular-nums">
                  {counts[r.key] || 0}
                </span>
              </div>
              <span
                className={`text-[11px] font-medium leading-tight ${
                  selected ? "text-ink-primary" : "text-ink-muted group-hover:text-ink-secondary"
                }`}
              >
                {r.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
