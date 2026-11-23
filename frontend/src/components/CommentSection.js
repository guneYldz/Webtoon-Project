"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Reply,
  Send,
  Eye,
  EyeOff,
  AlertTriangle,
  ArrowUpDown,
  Trash2,
  ChevronDown,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, resolveMediaUrl, getUserToken } from "@/lib/apiClient";
import { Button, Badge, Skeleton } from "@/components/ui";

const SPOILER_PREFIX = "[SPOILER]";
const PAGE_SIZE = 15;

function parseSpoilerContent(rawContent) {
  const text = String(rawContent || "");
  if (text.startsWith(SPOILER_PREFIX)) {
    return {
      isSpoiler: true,
      body: text.slice(SPOILER_PREFIX.length).trimStart(),
    };
  }
  return { isSpoiler: false, body: text };
}

function Avatar({ username, image, sizeClass = "w-9 h-9", textClass = "text-xs" }) {
  const avatar = image ? (
    <img
      src={resolveMediaUrl(image)}
      alt={username || "Kullanıcı"}
      className={`${sizeClass} rounded-full object-cover shrink-0 border border-white/10`}
    />
  ) : (
    <div
      className={`${sizeClass} rounded-full bg-accent-soft border border-accent-border flex items-center justify-center text-accent font-bold ${textClass} shrink-0`}
    >
      {username ? username[0].toUpperCase() : "?"}
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

function CommentText({ content }) {
  const [revealed, setRevealed] = useState(false);
  const { isSpoiler, body } = parseSpoilerContent(content);

  if (!isSpoiler) {
    return (
      <p className="text-ink-secondary text-sm leading-relaxed break-words whitespace-pre-line">
        {body}
      </p>
    );
  }

  return (
    <div className="mt-1">
      {!revealed ? (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full text-left rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/15 transition flex items-center justify-between gap-2"
        >
          <span className="inline-flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            Spoiler içeren yorum — görüntülemek için tıkla
          </span>
          <Eye className="h-3.5 w-3.5 shrink-0 text-amber-300" />
        </button>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Badge variant="outline" size="sm" className="text-amber-300 border-amber-500/30">
              Spoiler
            </Badge>
            <button
              type="button"
              onClick={() => setRevealed(false)}
              className="text-[11px] text-ink-muted hover:text-ink-primary inline-flex items-center gap-1"
            >
              <EyeOff className="h-3 w-3" />
              Gizle
            </button>
          </div>
          <p className="text-ink-secondary text-sm leading-relaxed break-words whitespace-pre-line">
            {body}
          </p>
        </div>
      )}
    </div>
  );
}

export default function CommentSection({
  type,
  itemId,
  episodeId = null,
  chapterId = null,
  onCountChange = null,
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySpoiler, setReplySpoiler] = useState(false);
  const [sortOrder, setSortOrder] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [highlightedId, setHighlightedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const loadComments = useCallback(async () => {
    let path = "";
    if (type === "webtoon" && episodeId) {
      path = `/comments/webtoon/${episodeId}`;
    } else if (type === "novel" && chapterId) {
      path = `/comments/novel/${chapterId}`;
    } else {
      setLoading(false);
      return;
    }

    try {
      const res = await apiFetch(path, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : [];
        setComments(list);
        if (typeof onCountChangeRef.current === "function") {
          onCountChangeRef.current(list.length);
        }
      }
    } catch (err) {
      console.error("Yorumlar yüklenirken hata:", err);
    } finally {
      setLoading(false);
    }
  }, [type, episodeId, chapterId]);

  useEffect(() => {
    const token = getUserToken();
    setIsAuthenticated(Boolean(token));

    if (token) {
      apiFetch("/auth/me", { auth: "user", cache: "no-store" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data) setCurrentUser(data);
        })
        .catch(() => {});
    } else {
      setCurrentUser(null);
    }

    setLoading(true);
    loadComments();
  }, [itemId, episodeId, chapterId, loadComments]);

  const { rootComments, repliesByParent } = useMemo(() => {
    const roots = comments.filter((c) => !c.parent_id);
    roots.sort((a, b) => {
      const da = new Date(a.created_at).getTime();
      const db = new Date(b.created_at).getTime();
      return sortOrder === "oldest" ? da - db : db - da;
    });

    const repliesMap = {};
    comments.forEach((c) => {
      if (c.parent_id) {
        if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
        repliesMap[c.parent_id].push(c);
      }
    });
    Object.values(repliesMap).forEach((list) =>
      list.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    );

    return { rootComments: roots, repliesByParent: repliesMap };
  }, [comments, sortOrder]);

  // Deep-link #comment-ID scroll + React highlight
  useEffect(() => {
    if (loading || comments.length === 0 || typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;

    const targetIdNum = Number(hash.replace("#comment-", ""));
    if (!Number.isFinite(targetIdNum)) return;

    const targetComment = comments.find((c) => c.id === targetIdNum);
    if (targetComment) {
      const rootId = targetComment.parent_id || targetComment.id;
      const rootIndex = rootComments.findIndex((c) => c.id === rootId);
      if (rootIndex >= visibleCount) {
        setVisibleCount(rootIndex + 5);
      }
    }

    const timer = setTimeout(() => {
      const el = document.getElementById(`comment-${targetIdNum}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(targetIdNum);
        setTimeout(() => setHighlightedId(null), 2600);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [loading, comments, rootComments, visibleCount]);

  const submitComment = async (rawContent, spoilerFlag, parentId = null) => {
    const trimmed = rawContent.trim();
    if (!trimmed) return false;

    const token = getUserToken();
    if (!token) {
      toast.info("Yorum yazmak için giriş yapmalısın.");
      return false;
    }

    const finalContent = spoilerFlag ? `${SPOILER_PREFIX} ${trimmed}` : trimmed;
    const payload = { content: finalContent };
    if (parentId) payload.parent_id = parentId;
    if (type === "webtoon") {
      payload.webtoon_episode_id = episodeId;
    } else {
      payload.novel_chapter_id = chapterId;
    }

    try {
      const res = await apiFetch("/comments/", {
        method: "POST",
        auth: "user",
        json: payload,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadComments();
        toast.success(parentId ? "Yanıtın eklendi." : "Yorumun yayınlandı.");
        return true;
      }

      toast.error(data.detail || "Yorum gönderilirken bir hata oluştu.");
      return false;
    } catch (err) {
      console.error("Yorum hatası:", err);
      toast.error("Sunucuyla bağlantı kurulamadı.");
      return false;
    }
  };

  const handleCommentSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !newComment.trim()) return;
    setSubmitting(true);
    const ok = await submitComment(newComment, isSpoiler);
    if (ok) {
      setNewComment("");
      setIsSpoiler(false);
    }
    setSubmitting(false);
  };

  const handleReplySubmit = async (e, parentId) => {
    e.preventDefault();
    if (replySubmitting || !replyText.trim()) return;
    setReplySubmitting(true);
    const ok = await submitComment(replyText, replySpoiler, parentId);
    if (ok) {
      setReplyText("");
      setReplySpoiler(false);
      setReplyingTo(null);
    }
    setReplySubmitting(false);
  };

  const handleDeleteComment = async (commentId) => {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      const res = await apiFetch(`/comments/${commentId}`, {
        method: "DELETE",
        auth: "user",
      });
      if (res.ok) {
        toast.success("Yorum silindi.");
        await loadComments();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Yorum silinemedi.");
      }
    } catch {
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setDeletingId(null);
    }
  };

  const canModerate =
    currentUser?.role === "admin" || currentUser?.role === "editor";

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    try {
      return new Date(dateStr).toLocaleDateString("tr-TR", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return "";
    }
  };

  const visibleRoots = rootComments.slice(0, visibleCount);
  const hasMore = rootComments.length > visibleCount;

  const renderReplyForm = (parentId) => (
    <form
      onSubmit={(e) => handleReplySubmit(e, parentId)}
      className="mt-3 rounded-xl border border-subtle bg-canvas/80 p-3 space-y-2.5"
    >
      <textarea
        className="w-full bg-surface text-ink-primary p-3 rounded-lg border border-subtle outline-none focus:border-accent-border transition resize-none min-h-[76px] text-sm placeholder:text-ink-muted"
        placeholder="Yanıtını yaz..."
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        autoFocus
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="inline-flex items-center gap-2 text-xs text-ink-secondary cursor-pointer select-none">
          <input
            type="checkbox"
            checked={replySpoiler}
            onChange={(e) => setReplySpoiler(e.target.checked)}
            className="rounded border-white/20 bg-surface accent-brand"
          />
          <span>Spoiler içerir</span>
        </label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setReplyingTo(null);
              setReplyText("");
              setReplySpoiler(false);
            }}
          >
            Vazgeç
          </Button>
          <Button
            type="submit"
            variant="accent"
            size="sm"
            loading={replySubmitting}
            disabled={!replyText.trim()}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Yanıtla
          </Button>
        </div>
      </div>
    </form>
  );

  const renderCommentBody = (c, isReply = false, rootId = null) => {
    const replyTarget = rootId || c.id;
    const formKey = c.id;

    return (
      <div className="flex gap-3 sm:gap-3.5">
        <Avatar
          username={c.user_username}
          image={c.user_profile_image}
          sizeClass={isReply ? "w-8 h-8" : "w-9 h-9"}
          textClass={isReply ? "text-xs" : "text-sm"}
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <Link
                href={`/kullanici/${encodeURIComponent(c.user_username)}`}
                className="text-accent font-semibold text-sm hover:underline truncate"
              >
                {c.user_username}
              </Link>
              <span className="text-xs text-ink-muted">
                {formatDate(c.created_at)}
              </span>
            </div>

            {canModerate && (
              <button
                type="button"
                onClick={() => handleDeleteComment(c.id)}
                disabled={deletingId === c.id}
                className="text-xs text-ink-muted hover:text-rose-400 transition inline-flex items-center gap-1"
                title="Yorumu sil"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sil</span>
              </button>
            )}
          </div>

          <CommentText content={c.content} />

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                setReplyingTo(replyingTo === formKey ? null : formKey);
                setReplyText("");
                setReplySpoiler(false);
              }}
              className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-accent transition"
            >
              <Reply className="h-3.5 w-3.5" aria-hidden="true" />
              Yanıtla
            </button>
          )}

          {replyingTo === formKey && renderReplyForm(replyTarget)}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <section className="space-y-4 py-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-5 w-8 rounded-full" />
        </div>
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </section>
    );
  }

  return (
    <section className="pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-5 w-5 text-accent" aria-hidden="true" />
          <h3 className="text-lg md:text-xl font-bold text-ink-primary">
            Yorumlar
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent border border-accent-border tabular-nums">
            {comments.length}
          </span>
        </div>

        {rootComments.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setSortOrder((prev) => (prev === "newest" ? "oldest" : "newest"))
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:border-hover hover:text-ink-primary transition"
          >
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
            {sortOrder === "newest" ? "En Yeni" : "En Eski"}
          </button>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="bg-surface p-6 rounded-2xl border border-dashed border-white/15 text-center mb-8">
          <Lock className="h-5 w-5 text-ink-muted mx-auto mb-2" aria-hidden="true" />
          <p className="text-ink-secondary mb-4 text-sm">
            Yorum yapmak ve tartışmaya katılmak için giriş yapmalısın.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center h-9 px-5 rounded-xl bg-accent text-[#0B0B0F] font-semibold text-sm hover:brightness-110 transition"
          >
            Giriş Yap
          </Link>
        </div>
      ) : (
        <form
          onSubmit={handleCommentSubmit}
          className="mb-8 rounded-2xl border border-subtle bg-surface p-4 space-y-3"
        >
          <textarea
            className="w-full bg-canvas/70 text-ink-primary p-3.5 rounded-xl border border-subtle outline-none focus:border-accent-border transition resize-none min-h-[104px] text-sm placeholder:text-ink-muted"
            placeholder="Bölüm hakkında düşüncelerini paylaş..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            required
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs text-ink-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isSpoiler}
                onChange={(e) => setIsSpoiler(e.target.checked)}
                className="rounded border-white/20 bg-canvas accent-brand"
              />
              <span>Spoiler içerir</span>
            </label>

            <Button
              type="submit"
              variant="accent"
              size="sm"
              loading={submitting}
              disabled={!newComment.trim()}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Gönder
            </Button>
          </div>
        </form>
      )}

      <div className="space-y-3.5">
        {rootComments.length === 0 ? (
          <div className="rounded-2xl border border-subtle bg-surface/60 py-10 text-center">
            <p className="text-ink-muted text-sm">
              Henüz yorum yapılmamış. İlk yorumu sen yap!
            </p>
          </div>
        ) : (
          visibleRoots.map((c) => {
            const isHighlighted = highlightedId === c.id;
            return (
              <div
                key={c.id}
                id={`comment-${c.id}`}
                className={`bg-surface p-4 sm:p-5 rounded-2xl border transition-all scroll-mt-24 ${
                  isHighlighted
                    ? "border-accent ring-2 ring-accent/40"
                    : "border-subtle hover:border-hover"
                }`}
              >
                {renderCommentBody(c)}

                {repliesByParent[c.id] && repliesByParent[c.id].length > 0 && (
                  <div className="mt-4 ml-5 sm:ml-10 space-y-2.5 border-l border-white/10 pl-3.5 sm:pl-4">
                    {repliesByParent[c.id].map((r) => {
                      const replyHighlighted = highlightedId === r.id;
                      return (
                        <div
                          key={r.id}
                          id={`comment-${r.id}`}
                          className={`bg-canvas/70 p-3.5 rounded-xl border transition-all scroll-mt-24 ${
                            replyHighlighted
                              ? "border-accent ring-2 ring-accent/40"
                              : "border-subtle"
                          }`}
                        >
                          {renderCommentBody(r, true, c.id)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}

        {hasMore && (
          <div className="pt-3 text-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              Daha Fazla Göster ({rootComments.length - visibleCount} kaldı)
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
