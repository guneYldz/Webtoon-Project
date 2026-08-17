"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { API } from "@/api";

export default function DuyurularPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API}/notifications/announcements`);
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

  // Bildirimden #duyuru-ID ile gelindiyse o karta kaydır
  useEffect(() => {
    if (loading || items.length === 0) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash) return;
    const el = document.querySelector(hash);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-purple-500");
        setTimeout(() => el.classList.remove("ring-2", "ring-purple-500"), 2500);
      }, 100);
    }
  }, [loading, items]);

  return (
    <div className="min-h-screen text-gray-200 pb-20">
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <div className="mb-10 border-b border-gray-800 pb-4">
          <h1 className="text-3xl font-black text-white flex items-center gap-3">
            <span className="text-2xl">📢</span> Duyurular
          </h1>
          <p className="text-gray-500 text-sm mt-2">
            Site güncellemeleri ve ekip duyuruları burada yayınlanır.
          </p>
        </div>

        {loading ? (
          <p className="text-purple-400 font-bold italic">Yükleniyor...</p>
        ) : items.length === 0 ? (
          <p className="text-gray-600 italic">Henüz duyuru yok.</p>
        ) : (
          <div className="space-y-5">
            {items.map((a) => (
              <article
                key={a.id}
                id={`duyuru-${a.id}`}
                className="bg-[#121212] border border-gray-800 rounded-2xl p-6 scroll-mt-24 transition"
              >
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-xl shrink-0">
                    📢
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-lg font-bold text-white">{a.title}</h2>
                      <span className="text-xs text-gray-600">
                        {new Date(a.created_at).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mb-3">@{a.author}</p>
                    <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {a.message}
                    </p>
                    {a.link && (
                      <Link
                        href={a.link}
                        className="inline-block mt-4 text-sm font-bold text-blue-400 hover:underline"
                      >
                        İlgili sayfaya git →
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
