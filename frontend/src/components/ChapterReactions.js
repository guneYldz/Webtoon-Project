"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/api";

const REACTIONS = [
  { key: "upvote", emoji: "👍", label: "Beğen" },
  { key: "funny", emoji: "😄", label: "Komik" },
  { key: "love", emoji: "😍", label: "Sevdim" },
  { key: "surprised", emoji: "😮", label: "Şaşırtıcı" },
  { key: "angry", emoji: "😡", label: "Kızgın" },
  { key: "sad", emoji: "😢", label: "Üzücü" },
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
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API}/reactions/${type}/${targetId}`, { headers })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        setCounts({ ...emptyCounts(), ...(data.counts || {}) });
        setTotal(data.total || 0);
        setMine(data.mine || null);
      })
      .catch(() => {});
  }, [type, targetId]);

  const onPick = async (key) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token) {
      router.push("/login");
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`${API}/reactions/${type}/${targetId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reaction: key }),
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      setCounts({ ...emptyCounts(), ...(data.counts || {}) });
      setTotal(data.total || 0);
      setMine(data.mine || null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="w-full py-10 px-2">
      <div className="text-center mb-6">
        <h3 className="text-xl md:text-2xl font-black text-white tracking-tight">
          Ne düşünüyorsun?
        </h3>
        <p className="text-gray-400 text-sm mt-1">
          {total} tepki
        </p>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-x-2 gap-y-4 max-w-md sm:max-w-2xl mx-auto w-full px-1">
        {REACTIONS.map((r) => {
          const selected = mine === r.key;
          return (
            <button
              key={r.key}
              type="button"
              onClick={() => onPick(r.key)}
              disabled={busy}
              className="flex flex-col items-center gap-1.5 min-w-0 w-full group"
              aria-pressed={selected}
              aria-label={r.label}
            >
              <span
                className={`flex items-center justify-center gap-1 px-2 py-2 rounded-full border backdrop-blur-md transition w-full max-w-[5.75rem] ${
                  selected
                    ? "bg-blue-600/20 border-blue-500 text-white shadow-[0_0_16px_rgba(59,130,246,0.35)]"
                    : "bg-black/50 border-white/10 text-gray-200 hover:border-gray-500 hover:bg-black/70"
                }`}
              >
                <span className="text-lg leading-none">{r.emoji}</span>
                <span className="text-sm font-bold tabular-nums">{counts[r.key] || 0}</span>
              </span>
              <span className={`text-xs font-semibold text-center leading-tight ${selected ? "text-white" : "text-gray-400 group-hover:text-gray-200"}`}>
                {r.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
