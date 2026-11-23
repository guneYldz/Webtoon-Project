"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Megaphone, Calendar, User, ArrowRight, Inbox } from "lucide-react";
import { apiFetch, resolveMediaUrl } from "@/lib/apiClient";
import { Skeleton } from "@/components/ui";

export default function DuyurularPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/notifications/announcements");
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Duyurular yüklenemedi:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (loading || items.length === 0) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash) return;
    const el = document.querySelector(hash);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-brand");
        setTimeout(() => el.classList.remove("ring-2", "ring-brand"), 2500);
      }, 100);
    }
  }, [loading, items]);

  return (
    <div className="min-h-screen pb-16 font-sans">
      <div className="bg-surface/80 border-b border-subtle pt-8 pb-6 px-4 sm:px-6 mb-8">
        <div className="container mx-auto max-w-3xl">
          <h1 className="text-2xl sm:text-3xl font-black text-ink-primary flex items-center gap-3 tracking-tight">
            <span className="bg-brand/15 border border-brand/30 text-brand w-10 h-10 rounded-xl flex items-center justify-center shadow-sm">
              <Megaphone className="h-5 w-5" />
            </span>
            <span>Duyurular</span>
          </h1>
          <p className="text-ink-secondary text-sm mt-1.5">
            Site güncellemeleri, yeni seri duyuruları ve ekip haberleri burada yayınlanır.
          </p>
        </div>
      </div>

      <div className="container mx-auto max-w-3xl px-4 sm:px-6">
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-subtle bg-surface p-6 space-y-3"
              >
                <Skeleton className="h-6 w-2/3 rounded-md" />
                <Skeleton className="h-4 w-1/4 rounded-md" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-subtle bg-surface/60">
            <Inbox className="h-10 w-10 text-ink-muted mb-3" />
            <h2 className="text-base font-bold text-ink-primary">
              Henüz duyuru yayınlanmadı
            </h2>
            <p className="text-sm text-ink-secondary mt-1">
              Yeni duyurular eklendiğinde burada listelenecektir.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((a) => (
              <article
                key={a.id}
                id={`duyuru-${a.id}`}
                className="bg-surface hover:bg-surface/95 border border-subtle rounded-2xl p-6 scroll-mt-24 transition-all shadow-lg"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand/15 border border-brand/30 flex items-center justify-center text-brand shrink-0">
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <h2 className="text-lg font-bold text-ink-primary">
                        {a.title}
                      </h2>
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(a.created_at).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {a.author && (
                      <p className="inline-flex items-center gap-1 text-xs text-ink-muted mb-3">
                        <User className="h-3 w-3 text-brand" />
                        <span>@{a.author}</span>
                      </p>
                    )}

                    <p className="text-ink-secondary text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {a.message}
                    </p>

                    {a.image && (
                      <a
                        href={resolveMediaUrl(a.image)}
                        target="_blank"
                        rel="noreferrer"
                        className="block mt-4"
                      >
                        <img
                          src={resolveMediaUrl(a.image)}
                          alt={a.title}
                          className="w-full max-h-[28rem] object-contain rounded-xl border border-subtle bg-canvas/70"
                        />
                      </a>
                    )}

                    {a.link && (
                      <Link
                        href={a.link}
                        className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-brand hover:text-purple-300 transition-colors"
                      >
                        <span>İlgili sayfaya git</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
