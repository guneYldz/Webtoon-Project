"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { API } from "@/api";

const LAST_SEEN_KEY = "duyuru_last_seen";

function timeAgo(value) {
  try {
    const date = new Date(value);
    const seconds = (Date.now() - date.getTime()) / 1000;
    if (seconds < 60) return "az önce";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} dk önce`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} sa önce`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} gün önce`;
    return date.toLocaleDateString("tr-TR");
  } catch {
    return "";
  }
}

export default function NotificationBell({ user }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 12, width: 320 });
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const guest = !user || !token;
  const label = guest ? "Duyurular" : "Bildirimler";

  useEffect(() => setMounted(true), []);

  const loadGuestCount = async () => {
    try {
      const res = await fetch(`${API}/notifications/announcements?limit=20`);
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];
      const seen = parseInt(localStorage.getItem(LAST_SEEN_KEY) || "0", 10);
      setCount(list.filter((item) => new Date(item.created_at).getTime() > seen).length);
    } catch {}
  };

  const loadUnread = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/notifications/unread-count`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCount(data.count || 0);
      }
    } catch {}
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      if (guest) {
        const res = await fetch(`${API}/notifications/announcements?limit=30`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          const seen = parseInt(localStorage.getItem(LAST_SEEN_KEY) || "0", 10);
          setItems(
            list.map((item) => ({
              id: item.id,
              type: "announcement",
              title: item.title,
              message: item.message,
              image: item.image,
              link: `/duyurular#duyuru-${item.id}`,
              is_read: new Date(item.created_at).getTime() <= seen,
              created_at: item.created_at,
            }))
          );
        }
      } else {
        const res = await fetch(`${API}/notifications/?limit=40`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setItems(Array.isArray(data) ? data : []);
        }
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const markRead = async () => {
    if (guest) {
      localStorage.setItem(LAST_SEEN_KEY, String(Date.now()));
      setCount(0);
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } else if (token && count !== 0) {
      try {
        await fetch(`${API}/notifications/mark-all-read`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        setCount(0);
        setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
      } catch {}
    }
  };

  useEffect(() => {
    if (guest) {
      loadGuestCount();
      const timer = setInterval(loadGuestCount, 120000);
      return () => clearInterval(timer);
    }
    loadUnread();
    const timer = setInterval(loadUnread, 60000);
    return () => clearInterval(timer);
  }, [user]);

  const placePanel = () => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.min(360, window.innerWidth - 24);
    let left = rect.right - width;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));
    setPos({ top: rect.bottom + 10, left, width });
  };

  useEffect(() => {
    function onDown(event) {
      if (
        panelRef.current &&
        !panelRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }
    function onResize() {
      if (open) placePanel();
    }
    if (open) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("touchstart", onDown);
      window.addEventListener("resize", onResize);
      window.addEventListener("scroll", onResize, true);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onResize, true);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    if (next) placePanel();
    setOpen(next);
    if (next) {
      await loadItems();
      await markRead();
    }
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={toggle}
        className="relative p-2 rounded-full text-gray-400 hover:text-gray-200 hover:bg-white/5 transition"
        aria-label={label}
        title={label}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6">
          <path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 3.2.8 4.6 1.5 5.8.3.5-.1 1.2-.7 1.2H5.7c-.6 0-1-.7-.7-1.2.7-1.2 1.5-2.6 1.5-5.8z" />
          <path d="M10 4.2a2 2 0 0 1 4 0" />
          <path d="M10.2 16.5a1.8 1.8 0 0 0 3.6 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-[#1a1a1a] shadow">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && mounted && createPortal(
        <div
          ref={panelRef}
          className="fixed max-h-[70vh] bg-[#1e1e1e] border border-gray-700 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col"
          style={{ top: `${pos.top}px`, left: `${pos.left}px`, width: `${pos.width}px` }}
        >
          <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between shrink-0">
            <h3 className="text-sm font-bold text-white">{label}</h3>
            <span className="text-xs text-gray-500">{items.length} kayıt</span>
          </div>
          <div className="overflow-y-auto flex-1 overscroll-contain">
            {loading && items.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">Yükleniyor...</p>
            ) : items.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-10 italic">
                {guest ? "Henüz duyuru yok." : "Henüz bildirimin yok."}
              </p>
            ) : (
              items.map((item) => {
                const inner = (
                  <div className={`px-4 py-3 border-b border-gray-800/60 hover:bg-white/[0.03] transition ${item.is_read ? "" : "bg-purple-500/5"}`}>
                    <div className="flex items-start gap-3">
                      <span className="text-lg shrink-0 mt-0.5">{item.type === "announcement" ? "📢" : "💬"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-100 leading-snug">{item.title}</p>
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed break-words line-clamp-3">{item.message}</p>
                        {item.image && (
                          <img src={`${API}/${item.image}`} alt="" className="mt-2 w-full max-h-24 object-cover rounded-lg border border-gray-800" />
                        )}
                        <p className="text-[11px] text-gray-600 mt-1.5">{timeAgo(item.created_at)}</p>
                      </div>
                      {!item.is_read && <span className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1.5" />}
                    </div>
                  </div>
                );
                const href = item.link || (item.type === "announcement" ? `/duyurular#duyuru-${item.id}` : null);
                return href ? (
                  <Link key={`${item.type}-${item.id}`} href={href} onClick={() => setOpen(false)}>
                    {inner}
                  </Link>
                ) : (
                  <div key={`${item.type}-${item.id}`}>{inner}</div>
                );
              })
            )}
          </div>
          {guest && (
            <div className="px-4 py-2.5 border-t border-gray-800 shrink-0">
              <Link href="/duyurular" onClick={() => setOpen(false)} className="block text-center text-xs font-bold text-purple-400 hover:text-purple-300">
                Tüm duyuruları gör →
              </Link>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
