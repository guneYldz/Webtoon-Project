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
  ThumbsUp,
  Pencil,
  Flag,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch, resolveMediaUrl, getUserToken } from "@/lib/apiClient";
import { Button, Badge, Skeleton } from "@/components/ui";

const SPOILER_PREFIX = "[SPOILER]";
const PAGE_SIZE = 20;

const SORT_OPTIONS = [
  { value: "newest", label: "En Yeni" },
  { value: "top", label: "En Beğenilen" },
  { value: "oldest", label: "En Eski" },
];

const REPORT_REASONS = [
  "Spoiler",
  "Hakaret / Küfür",
  "Spam",
  "Diğer",
];

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

function Avatar({
  username,
  image,
  sizeClass = "w-9 h-9",
  textClass = "text-xs",
}) {
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

function CommentText({ content, isSpoilerFlag = false }) {
  const [revealed, setRevealed] = useState(false);
  const parsed = parseSpoilerContent(content);
  const isSpoiler = Boolean(isSpoilerFlag || parsed.isSpoiler);
  const body = parsed.body;

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
            <Badge
              variant="outline"
              size="sm"
              className="text-amber-300 border-amber-500/30"
            >
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

function SpoilerToggleButton({ active, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!active)}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition select-none ${
        active
          ? "border-amber-500/50 bg-amber-500/15 text-amber-200 shadow-sm"
          : "border-subtle bg-canvas/70 text-ink-secondary hover:border-hover hover:text-ink-primary"
      }`}
    >
      <AlertTriangle
        className={`h-3.5 w-3.5 ${
          active ? "text-amber-400" : "text-ink-muted"
        }`}
      />
      <span>Spoiler</span>
    </button>
  );
}

export default function CommentSection({
  type,
  targetId = null,
  itemId = null,
  episodeId = null,
  chapterId = null,
  onCountChange = null,
}) {
  const [comments, setComments] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [newComment, setNewComment] = useState("");
  const [isSpoiler, setIsSpoiler] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replySubmitting, setReplySubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [replySpoiler, setReplySpoiler] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editSpoiler, setEditSpoiler] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [reportingId, setReportingId] = useState(null);
  const [reportSubmittingId, setReportSubmittingId] = useState(null);
  const [likingId, setLikingId] = useState(null);

  const [sortOrder, setSortOrder] = useState("newest");
  const [highlightedId, setHighlightedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  const resolvedTargetId = useMemo(() => {
    if (type === "webtoon") return episodeId ?? targetId ?? itemId;
    if (type === "novel") return chapterId ?? targetId ?? itemId;
    if (type === "series_webtoon") return targetId ?? itemId ?? episodeId;
    if (type === "series_novel") return targetId ?? itemId ?? chapterId;
    return targetId ?? episodeId ?? chapterId ?? itemId;
  }, [type, targetId, itemId, episodeId, chapterId]);

  const buildEndpointPath = useCallback(
    (offset = 0, sort = sortOrder) => {
      if (!resolvedTargetId) return "";
      let base = "";
      if (type === "webtoon") {
        base = `/comments/webtoon/${resolvedTargetId}`;
      } else if (type === "novel") {
        base = `/comments/novel/${resolvedTargetId}`;
      } else if (type === "series_webtoon") {
        base = `/comments/series/webtoon/${resolvedTargetId}`;
      } else if (type === "series_novel") {
        base = `/comments/series/novel/${resolvedTargetId}`;
      } else {
        return "";
      }
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
        sort,
      });
      return `${base}?${params.toString()}`;
    },
    [type, resolvedTargetId, sortOrder]
  );

  const loadComments = useCallback(
    async ({ append = false, offset = 0, sort = sortOrder } = {}) => {
      const path = buildEndpointPath(offset, sort);
      if (!path) {
        setLoading(false);
        return;
      }

      if (append) {
        setLoadingMore(true);
      }

      try {
        const hasToken = Boolean(getUserToken());
        const res = await apiFetch(path, {
          auth: hasToken ? "user" : "none",
          cache: "no-store",
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          const headerTotal = Number(res.headers.get("X-Total-Count"));

          setComments((prev) => {
            if (!append) return list;
            const seen = new Set(prev.map((item) => item.id));
            const merged = [...prev];
            for (const item of list) {
              if (!seen.has(item.id)) {
                seen.add(item.id);
                merged.push(item);
              }
            }
            return merged;
          });

          const nextTotal =
            Number.isFinite(headerTotal) && headerTotal >= 0
              ? headerTotal
              : append
              ? Math.max(totalCount, list.length)
              : list.length;

          setTotalCount(nextTotal);
          if (typeof onCountChangeRef.current === "function") {
            onCountChangeRef.current(nextTotal);
          }
        }
      } catch (err) {
        console.error("Yorumlar yüklenirken hata:", err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [buildEndpointPath, sortOrder, totalCount]
  );

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
  }, []);

  useEffect(() => {
    setLoading(true);
    loadComments({ append: false, offset: 0, sort: sortOrder });
  }, [resolvedTargetId, type, sortOrder]);

  const { rootComments, repliesByParent, allCommentsFlat } = useMemo(() => {
    const roots = [];
    const repliesMap = {};
    const flat = [];

    for (const c of comments) {
      flat.push(c);
      if (!c.parent_id) {
        roots.push(c);
        if (Array.isArray(c.replies) && c.replies.length > 0) {
          repliesMap[c.id] = [...c.replies];
          for (const r of c.replies) {
            flat.push(r);
          }
        }
      } else {
        if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
        const exists = repliesMap[c.parent_id].some((x) => x.id === c.id);
        if (!exists) {
          repliesMap[c.parent_id].push(c);
        }
      }
    }

    Object.values(repliesMap).forEach((list) =>
      list.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
    );

    return {
      rootComments: roots,
      repliesByParent: repliesMap,
      allCommentsFlat: flat,
    };
  }, [comments]);

  // Deep-link #comment-ID scroll + React highlight
  useEffect(() => {
    if (
      loading ||
      allCommentsFlat.length === 0 ||
      typeof window === "undefined"
    )
      return;
    const hash = window.location.hash;
    if (!hash.startsWith("#comment-")) return;

    const targetIdNum = Number(hash.replace("#comment-", ""));
    if (!Number.isFinite(targetIdNum)) return;

    const timer = setTimeout(() => {
      const el = document.getElementById(`comment-${targetIdNum}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedId(targetIdNum);
        setTimeout(() => setHighlightedId(null), 2600);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [loading, allCommentsFlat]);

  const updateCommentInState = useCallback((commentId, updater) => {
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          return updater(c);
        }
        if (Array.isArray(c.replies) && c.replies.length > 0) {
          const updatedReplies = c.replies.map((r) =>
            r.id === commentId ? updater(r) : r
          );
          return { ...c, replies: updatedReplies };
        }
        return c;
      })
    );
  }, []);

  const submitComment = async (rawContent, spoilerFlag, parentId = null) => {
    const trimmed = rawContent.trim();
    if (!trimmed) return false;

    const token = getUserToken();
    if (!token) {
      toast.info("Yorum yazmak için giriş yapmalısın.");
      return false;
    }

    const payload = {
      content: trimmed,
      is_spoiler: Boolean(spoilerFlag),
    };
    if (parentId) payload.parent_id = parentId;

    if (type === "webtoon") {
      payload.webtoon_episode_id = Number(resolvedTargetId);
    } else if (type === "novel") {
      payload.novel_chapter_id = Number(resolvedTargetId);
    } else if (type === "series_webtoon") {
      payload.webtoon_id = Number(resolvedTargetId);
    } else if (type === "series_novel") {
      payload.novel_id = Number(resolvedTargetId);
    }

    try {
      const res = await apiFetch("/comments/", {
        method: "POST",
        auth: "user",
        json: payload,
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadComments({ append: false, offset: 0, sort: sortOrder });
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

  const startEditing = (comment) => {
    const parsed = parseSpoilerContent(comment.content);
    setEditingId(comment.id);
    setEditText(parsed.body);
    setEditSpoiler(Boolean(comment.is_spoiler || parsed.isSpoiler));
    setReplyingTo(null);
  };

  const handleEditSubmit = async (e, commentId) => {
    e.preventDefault();
    const trimmed = editText.trim();
    if (editSubmitting || !trimmed) return;
    setEditSubmitting(true);

    try {
      const res = await apiFetch(`/comments/${commentId}`, {
        method: "PUT",
        auth: "user",
        json: {
          content: trimmed,
          is_spoiler: Boolean(editSpoiler),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        updateCommentInState(commentId, (old) => ({
          ...old,
          ...data,
          content: data.content ?? trimmed,
          is_spoiler:
            data.is_spoiler !== undefined
              ? Boolean(data.is_spoiler)
              : Boolean(editSpoiler),
          updated_at: data.updated_at || new Date().toISOString(),
        }));
        setEditingId(null);
        setEditText("");
        setEditSpoiler(false);
        toast.success("Yorum güncellendi.");
      } else {
        toast.error(data.detail || "Yorum güncellenemedi.");
      }
    } catch {
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggleLike = async (comment) => {
    const token = getUserToken();
    if (!token) {
      toast.info("Yorum beğenmek için giriş yapmalısın.");
      return;
    }
    if (likingId === comment.id) return;
    setLikingId(comment.id);

    const prevLiked = Boolean(comment.liked_by_me);
    const prevCount = Number(comment.likes_count || 0);
    const optimisticLiked = !prevLiked;
    const optimisticCount = Math.max(
      0,
      prevCount + (optimisticLiked ? 1 : -1)
    );

    updateCommentInState(comment.id, (old) => ({
      ...old,
      liked_by_me: optimisticLiked,
      likes_count: optimisticCount,
    }));

    try {
      const res = await apiFetch(`/comments/${comment.id}/like`, {
        method: "POST",
        auth: "user",
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        updateCommentInState(comment.id, (old) => ({
          ...old,
          liked_by_me:
            data.liked !== undefined ? Boolean(data.liked) : optimisticLiked,
          likes_count:
            typeof data.likes_count === "number"
              ? data.likes_count
              : optimisticCount,
        }));
      } else {
        updateCommentInState(comment.id, (old) => ({
          ...old,
          liked_by_me: prevLiked,
          likes_count: prevCount,
        }));
      }
    } catch {
      updateCommentInState(comment.id, (old) => ({
        ...old,
        liked_by_me: prevLiked,
        likes_count: prevCount,
      }));
    } finally {
      setLikingId(null);
    }
  };

  const handleReportComment = async (commentId, reason) => {
    const token = getUserToken();
    if (!token) {
      toast.info("Şikayet bildirmek için giriş yapmalısın.");
      return;
    }
    if (reportSubmittingId === commentId) return;
    setReportSubmittingId(commentId);

    try {
      const res = await apiFetch(`/comments/${commentId}/report`, {
        method: "POST",
        auth: "user",
        json: { reason },
      });
      if (res.ok) {
        updateCommentInState(commentId, (old) => ({
          ...old,
          is_reported_by_me: true,
        }));
        setReportingId(null);
        toast.success("Yorum incelenmek üzere bildirildi.");
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.detail || "Şikayet gönderilemedi.");
      }
    } catch {
      toast.error("Sunucuyla bağlantı kurulamadı.");
    } finally {
      setReportSubmittingId(null);
    }
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
        await loadComments({ append: false, offset: 0, sort: sortOrder });
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

  const hasMoreServer = rootComments.length < totalCount;
  const isSeriesSection =
    type === "series_webtoon" || type === "series_novel";

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
        <SpoilerToggleButton
          active={replySpoiler}
          onChange={setReplySpoiler}
        />
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

  const renderEditForm = (comment) => (
    <form
      onSubmit={(e) => handleEditSubmit(e, comment.id)}
      className="mt-2 rounded-xl border border-brand/40 bg-canvas/90 p-3 space-y-2.5"
    >
      <textarea
        className="w-full bg-surface text-ink-primary p-3 rounded-lg border border-subtle outline-none focus:border-brand transition resize-none min-h-[76px] text-sm"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        autoFocus
        required
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SpoilerToggleButton active={editSpoiler} onChange={setEditSpoiler} />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditingId(null);
              setEditText("");
              setEditSpoiler(false);
            }}
          >
            İptal
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={editSubmitting}
            disabled={!editText.trim()}
          >
            <Check className="h-3.5 w-3.5" />
            Kaydet
          </Button>
        </div>
      </div>
    </form>
  );

  const renderCommentBody = (c, isReply = false, rootId = null) => {
    const replyTarget = rootId || c.id;
    const formKey = c.id;
    const isOwnComment =
      Boolean(currentUser) &&
      ((c.user_id !== undefined &&
        c.user_id !== null &&
        currentUser.id !== undefined &&
        Number(c.user_id) === Number(currentUser.id)) ||
        (c.user_username &&
          currentUser.username &&
          c.user_username === currentUser.username));
    const canDelete = canModerate || isOwnComment;
    const isEdited = Boolean(c.updated_at);
    const likesCount = Number(c.likes_count || 0);
    const likedByMe = Boolean(c.liked_by_me);
    const reportedByMe = Boolean(c.is_reported_by_me);

    return (
      <div className="flex gap-3 sm:gap-3.5">
        <Avatar
          username={c.user_username}
          image={c.user_image || c.user_profile_image}
          sizeClass={isReply ? "w-8 h-8" : "w-9 h-9"}
          textClass={isReply ? "text-xs" : "text-sm"}
        />

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <Link
                href={`/kullanici/${encodeURIComponent(c.user_username)}`}
                className="text-accent font-semibold text-sm hover:underline truncate"
              >
                {c.user_username}
              </Link>
              {(c.user_role === "admin" || c.user_role === "editor") && (
                <Badge
                  variant={c.user_role === "admin" ? "new" : "manga"}
                  size="sm"
                  className="!text-[10px] !px-1.5 !py-0"
                >
                  {c.user_role === "admin" ? "Admin" : "Editör"}
                </Badge>
              )}
              <span className="text-xs text-ink-muted">
                {formatDate(c.created_at)}
              </span>
              {isEdited && (
                <span className="text-[11px] text-ink-muted italic">
                  (düzenlendi)
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              {isOwnComment && editingId !== c.id && (
                <button
                  type="button"
                  onClick={() => startEditing(c)}
                  className="text-xs text-ink-muted hover:text-ink-primary transition inline-flex items-center gap-1"
                  title="Yorumu düzenle"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Düzenle</span>
                </button>
              )}

              {canDelete && (
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
          </div>

          {editingId === c.id ? (
            renderEditForm(c)
          ) : (
            <CommentText
              content={c.content}
              isSpoilerFlag={Boolean(c.is_spoiler)}
            />
          )}

          {/* Action Row: Like, Reply, Report */}
          <div className="mt-2.5 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => handleToggleLike(c)}
              disabled={likingId === c.id}
              aria-pressed={likedByMe}
              className={`inline-flex items-center gap-1.5 text-xs font-semibold transition ${
                likedByMe
                  ? "text-brand"
                  : "text-ink-muted hover:text-ink-primary"
              }`}
              title="Beğen"
            >
              <ThumbsUp
                className={`h-3.5 w-3.5 ${
                  likedByMe ? "fill-brand/25 text-brand" : ""
                }`}
              />
              <span className="tabular-nums">{likesCount}</span>
            </button>

            {isAuthenticated && (
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(replyingTo === formKey ? null : formKey);
                  setReplyText("");
                  setReplySpoiler(false);
                  setEditingId(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted hover:text-accent transition"
              >
                <Reply className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Yanıtla</span>
              </button>
            )}

            {isAuthenticated && !isOwnComment && (
              <button
                type="button"
                disabled={reportedByMe}
                onClick={() =>
                  setReportingId(reportingId === c.id ? null : c.id)
                }
                className={`inline-flex items-center gap-1 text-xs transition ${
                  reportedByMe
                    ? "text-amber-400/80 cursor-default"
                    : "text-ink-muted hover:text-amber-300"
                }`}
                title={
                  reportedByMe
                    ? "Bu yorumu bildirdiniz"
                    : "Yorumu şikayet et"
                }
              >
                <Flag className="h-3 w-3" />
                <span>{reportedByMe ? "Bildirildi" : "Şikayet Et"}</span>
              </button>
            )}
          </div>

          {/* Quick Report Reason Picker */}
          {reportingId === c.id && !reportedByMe && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2">
              <span className="text-[11px] font-semibold text-amber-200 mr-1">
                Sebep seçin:
              </span>
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  disabled={reportSubmittingId === c.id}
                  onClick={() => handleReportComment(c.id, reason)}
                  className="px-2.5 py-1 rounded-lg bg-surface/90 hover:bg-elevated border border-subtle text-xs font-medium text-ink-primary transition"
                >
                  {reason}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReportingId(null)}
                className="ml-auto p-1 text-ink-muted hover:text-ink-primary"
                aria-label="Kapat"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
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
            {isSeriesSection ? "Seri Yorumları" : "Yorumlar"}
          </h3>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-accent-soft text-accent border border-accent-border tabular-nums">
            {totalCount || rootComments.length}
          </span>
        </div>

        <div className="inline-flex items-center gap-1.5">
          <ArrowUpDown
            className="h-3.5 w-3.5 text-ink-muted"
            aria-hidden="true"
          />
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            aria-label="Yorumları sırala"
            className="rounded-lg border border-subtle bg-surface px-3 py-1.5 text-xs font-semibold text-ink-secondary hover:border-hover focus:border-brand focus:text-ink-primary focus:outline-none transition"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="bg-surface p-6 rounded-2xl border border-dashed border-white/15 text-center mb-8">
          <Lock
            className="h-5 w-5 text-ink-muted mx-auto mb-2"
            aria-hidden="true"
          />
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
            placeholder={
              isSeriesSection
                ? "Bu seri hakkında düşüncelerini ve incelemeni paylaş..."
                : "Bölüm hakkında düşüncelerini paylaş..."
            }
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            required
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SpoilerToggleButton active={isSpoiler} onChange={setIsSpoiler} />

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
          rootComments.map((c) => {
            const isHighlighted = highlightedId === c.id;
            const replies = repliesByParent[c.id] || [];

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

                {replies.length > 0 && (
                  <div className="mt-4 ml-5 sm:ml-10 space-y-2.5 border-l border-white/10 pl-3.5 sm:pl-4">
                    {replies.map((r) => {
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

        {hasMoreServer && (
          <div className="pt-3 text-center">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={loadingMore}
              onClick={() =>
                loadComments({
                  append: true,
                  offset: rootComments.length,
                  sort: sortOrder,
                })
              }
            >
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
              Daha Fazla Yorum Göster (
              {Math.max(1, totalCount - rootComments.length)} kaldı)
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
