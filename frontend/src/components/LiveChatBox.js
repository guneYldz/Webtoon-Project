"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import {
  MessageCircle,
  Send,
  Trash2,
  ChevronDown,
  ChevronUp,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  apiFetch,
  PUBLIC_API_URL,
  resolveMediaUrl,
  getUserToken,
} from "@/lib/apiClient";

const MAX_MESSAGE_LENGTH = 300;
const POLL_INTERVAL_MS = 4000;
const WS_PING_INTERVAL_MS = 30000;

function formatChatTime(isoStr, mounted) {
  if (!mounted || !isoStr) return "";
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function ChatAvatar({ username, profileImage }) {
  const avatar = profileImage ? (
    <img
      src={resolveMediaUrl(profileImage)}
      alt={username || "Kullanıcı"}
      className="w-7 h-7 rounded-full object-cover shrink-0 border border-white/10"
    />
  ) : (
    <div className="w-7 h-7 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center text-brand font-bold text-[11px] shrink-0">
      {username ? username.charAt(0).toUpperCase() : "?"}
    </div>
  );

  if (!username) return avatar;
  return (
    <Link
      href={`/kullanici/${encodeURIComponent(username)}`}
      className="shrink-0 hover:opacity-85 transition"
      title={`${username} profili`}
    >
      {avatar}
    </Link>
  );
}

export default function LiveChatBox() {
  const [messages, setMessages] = useState([]);
  const [onlineCount, setOnlineCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [deletingId, setDeletingId] = useState(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [wsConnected, setWsConnected] = useState(false);

  const scrollContainerRef = useRef(null);
  const lastIdRef = useRef(0);
  const nearBottomRef = useRef(true);

  const scrollToBottom = useCallback((force = false) => {
    const el = scrollContainerRef.current;
    if (!el) return;
    if (force || nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distance < 80;
  };

  const mergeIncomingMessages = useCallback(
    (incomingList, isInitial = false) => {
      if (!Array.isArray(incomingList) || incomingList.length === 0) return;
      setMessages((prev) => {
        const base = isInitial ? [] : [...prev];
        const seen = new Set(base.map((m) => Number(m.id)));
        let added = false;

        for (const msg of incomingList) {
          if (!msg || msg.id === undefined || msg.id === null) continue;
          const numId = Number(msg.id);
          if (!seen.has(numId)) {
            seen.add(numId);
            base.push(msg);
            added = true;
          }
          if (numId > lastIdRef.current) {
            lastIdRef.current = numId;
          }
        }

        if (!added && !isInitial) return prev;
        base.sort((a, b) => Number(a.id) - Number(b.id));
        return base.slice(-100);
      });

      setTimeout(() => scrollToBottom(isInitial), 30);
    },
    [scrollToBottom]
  );

  const syncAuthUser = useCallback(async () => {
    const token = getUserToken();
    setIsAuthenticated(Boolean(token));
    if (!token) {
      setCurrentUser(null);
      return;
    }
    try {
      const res = await apiFetch("/auth/me", {
        auth: "user",
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data);
      }
    } catch {
      // Ignore profile fetch error
    }
  }, []);

  // Initial history load + auth check
  useEffect(() => {
    setMounted(true);
    syncAuthUser();

    let cancelled = false;
    const loadInitial = async () => {
      try {
        const res = await apiFetch("/chat/messages?limit=50&after_id=0", {
          cache: "no-store",
        });
        if (res.ok && !cancelled) {
          const data = await res.json();
          const list = Array.isArray(data?.messages) ? data.messages : [];
          mergeIncomingMessages(list, true);
          if (typeof data?.online_count === "number") {
            setOnlineCount(Math.max(1, data.online_count));
          }
        }
      } catch {
        // Silent fail if chat endpoint not yet reachable
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadInitial();

    const onAuthChange = () => {
      syncAuthUser();
    };
    window.addEventListener("auth-change", onAuthChange);
    return () => {
      cancelled = true;
      window.removeEventListener("auth-change", onAuthChange);
    };
  }, [mergeIncomingMessages, syncAuthUser]);

  // WebSocket connection with 30s heartbeat and auto-reconnect
  useEffect(() => {
    if (typeof window === "undefined") return;
    let ws = null;
    let pingTimer = null;
    let reconnectTimer = null;
    let unmounted = false;

    const connectWs = () => {
      if (unmounted) return;
      try {
        const wsBase = PUBLIC_API_URL.replace(/^http/, "ws");
        ws = new WebSocket(`${wsBase}/chat/ws`);

        ws.onopen = () => {
          if (unmounted) return;
          setWsConnected(true);
          pingTimer = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send("ping");
            }
          }, WS_PING_INTERVAL_MS);
        };

        ws.onmessage = (event) => {
          if (unmounted) return;
          const raw = event.data;
          if (raw === "pong") return;
          try {
            const payload = JSON.parse(raw);
            if (payload?.type === "message" && payload.data) {
              mergeIncomingMessages([payload.data], false);
            } else if (
              payload?.type === "delete" &&
              payload.id !== undefined
            ) {
              const targetId = Number(payload.id);
              setMessages((prev) =>
                prev.filter((m) => Number(m.id) !== targetId)
              );
            } else if (
              payload?.type === "presence" &&
              typeof payload.online_count === "number"
            ) {
              setOnlineCount(Math.max(1, payload.online_count));
            }
          } catch {
            // Ignore malformed WS frame
          }
        };

        ws.onerror = () => {
          setWsConnected(false);
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (pingTimer) {
            clearInterval(pingTimer);
            pingTimer = null;
          }
          if (!unmounted) {
            reconnectTimer = setTimeout(connectWs, 5000);
          }
        };
      } catch {
        setWsConnected(false);
        if (!unmounted) {
          reconnectTimer = setTimeout(connectWs, 6000);
        }
      }
    };

    connectWs();

    return () => {
      unmounted = true;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        try {
          ws.close();
        } catch {
          // Ignore close error
        }
      }
    };
  }, [mergeIncomingMessages]);

  // Lightweight HTTP polling fallback when WS is not connected
  useEffect(() => {
    if (wsConnected || collapsed) return;

    const timer = setInterval(async () => {
      try {
        const afterId = lastIdRef.current || 0;
        const res = await apiFetch(
          `/chat/messages?limit=50&after_id=${afterId}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data?.messages) && data.messages.length > 0) {
          mergeIncomingMessages(data.messages, false);
        }
        if (typeof data?.online_count === "number") {
          setOnlineCount(Math.max(1, data.online_count));
        }
      } catch {
        // Ignore transient poll errors
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [wsConnected, collapsed, mergeIncomingMessages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || sending) return;

    if (Date.now() < cooldownUntil) {
      toast.warning(
        "Çok hızlı mesaj gönderiyorsunuz, lütfen birkaç saniye bekleyin."
      );
      return;
    }

    const token = getUserToken();
    if (!token) {
      toast.info("Sohbete katılmak için giriş yapmalısın.");
      return;
    }

    setSending(true);
    try {
      const res = await apiFetch("/chat/messages", {
        method: "POST",
        auth: "user",
        json: { content: trimmed },
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 429) {
        setCooldownUntil(Date.now() + 3000);
        toast.warning(
          data?.detail ||
            "Çok hızlı mesaj gönderiyorsunuz, lütfen birkaç saniye bekleyin."
        );
        return;
      }

      if (!res.ok) {
        toast.error(data?.detail || "Mesaj gönderilemedi.");
        return;
      }

      setInput("");
      setCooldownUntil(Date.now() + 3000);
      nearBottomRef.current = true;
      if (data && data.id !== undefined) {
        mergeIncomingMessages([data], false);
      }
    } catch {
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (deletingId) return;
    setDeletingId(messageId);

    try {
      const res = await apiFetch(`/chat/messages/${messageId}`, {
        method: "DELETE",
        auth: "user",
      });
      if (res.ok) {
        setMessages((prev) =>
          prev.filter((m) => Number(m.id) !== Number(messageId))
        );
        toast.success("Mesaj silindi.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data?.detail || "Mesaj silinemedi.");
      }
    } catch {
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setDeletingId(null);
    }
  };

  const canModerate =
    currentUser?.role === "admin" || currentUser?.role === "editor";

  return (
    <div className="bg-surface/90 rounded-2xl border border-subtle shadow-2xl overflow-hidden">
      {/* Compact Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-subtle bg-elevated/40">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircle className="h-4 w-4 text-brand shrink-0" />
          <h2 className="text-sm sm:text-base font-bold text-ink-primary truncate">
            Canlı Sohbet
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span>Canlı</span>
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onlineCount > 0 && (
            <span className="text-[11px] font-medium text-ink-muted tabular-nums">
              {onlineCount} çevrimiçi
            </span>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-subtle bg-surface text-ink-secondary hover:text-ink-primary hover:border-hover transition"
            aria-label={collapsed ? "Sohbeti genişlet" : "Sohbeti daralt"}
            title={collapsed ? "Sohbeti aç" : "Sohbeti gizle"}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Fixed Scrollable Message Stream */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-[290px] sm:h-[330px] overflow-y-auto p-3.5 space-y-2.5 bg-canvas/40"
          >
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-2 text-ink-muted text-xs">
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
                <span>Sohbet yükleniyor...</span>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-4">
                <MessageCircle className="h-7 w-7 text-ink-muted/60 mb-2" />
                <p className="text-xs font-semibold text-ink-secondary">
                  Henüz mesaj yok
                </p>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Topluluğa ilk merhaba diyen sen ol!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOwn =
                  Boolean(currentUser) &&
                  ((msg.user_id !== undefined &&
                    currentUser.id !== undefined &&
                    Number(msg.user_id) === Number(currentUser.id)) ||
                    (msg.username &&
                      currentUser.username &&
                      msg.username === currentUser.username));
                const canDelete = canModerate || isOwn;
                const role = String(msg.role || "user").toLowerCase();

                return (
                  <div
                    key={msg.id}
                    className="group flex items-start gap-2.5 rounded-xl bg-surface/80 hover:bg-surface border border-subtle/70 p-2.5 transition"
                  >
                    <ChatAvatar
                      username={msg.username}
                      profileImage={msg.profile_image}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Link
                            href={`/kullanici/${encodeURIComponent(
                              msg.username || ""
                            )}`}
                            className="text-xs font-bold text-ink-primary hover:text-brand truncate transition"
                          >
                            {msg.username}
                          </Link>

                          {role === "admin" && (
                            <span className="rounded bg-purple-500/20 border border-purple-500/40 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-purple-300">
                              ADMIN
                            </span>
                          )}
                          {role === "editor" && (
                            <span className="rounded bg-sky-500/20 border border-sky-500/40 px-1.5 py-0.2 text-[9px] font-extrabold uppercase tracking-wider text-sky-300">
                              EDITOR
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[10px] text-ink-muted tabular-nums">
                            {formatChatTime(msg.created_at, mounted)}
                          </span>
                          {canDelete && (
                            <button
                              type="button"
                              disabled={deletingId === msg.id}
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="opacity-70 group-hover:opacity-100 text-ink-muted hover:text-rose-400 transition p-0.5"
                              title="Mesajı sil"
                              aria-label="Mesajı sil"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <p className="mt-0.5 text-xs text-ink-secondary break-words leading-relaxed">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Composer Footer */}
          <div className="p-3 border-t border-subtle bg-surface">
            {!isAuthenticated ? (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-canvas/80 border border-subtle px-3 py-2">
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
                  <Lock className="h-3.5 w-3.5 text-ink-muted shrink-0" />
                  <span>Sohbete katılmak için</span>
                </span>
                <Link
                  href="/login"
                  className="text-xs font-bold text-brand hover:text-purple-300 transition shrink-0"
                >
                  Giriş Yap →
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={input}
                    maxLength={MAX_MESSAGE_LENGTH}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Mesaj yaz..."
                    className="flex-1 min-w-0 h-9 rounded-xl border border-subtle bg-canvas px-3 text-xs text-ink-primary placeholder:text-ink-muted focus:border-brand focus:outline-none transition"
                  />
                  <button
                    type="submit"
                    disabled={sending || !input.trim()}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand hover:bg-brand-hover text-white disabled:opacity-40 transition shadow-sm"
                    aria-label="Mesaj gönder"
                    title="Gönder"
                  >
                    {sending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>

                {input.length > 200 && (
                  <div className="flex justify-end">
                    <span
                      className={`text-[10px] tabular-nums ${
                        input.length >= 290
                          ? "text-rose-400 font-semibold"
                          : "text-ink-muted"
                      }`}
                    >
                      {input.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                )}
              </form>
            )}
          </div>
        </>
      )}
    </div>
  );
}
