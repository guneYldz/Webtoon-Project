"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Pencil, Trash2, Eye, AlertCircle, Save } from "lucide-react";
import { toast } from "sonner";
import {
  Editor,
  EditorProvider,
  Toolbar,
  BtnBold,
  BtnItalic,
  BtnUnderline,
  BtnLink,
  BtnStrikeThrough,
  BtnNumberedList,
  BtnBulletList,
} from "react-simple-wysiwyg";
import { apiFetch, getAdminToken } from "@/lib/apiClient";
import {
  Badge,
  Button,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  buttonClasses,
} from "@/components/ui";
import {
  AdminPageHeader,
  AdminConfirmDialog,
  adminCardClass,
  adminInputClass,
  adminSelectClass,
  adminLabelClass,
} from "../_components/AdminUi";

export default function NovelChaptersPage() {
  const [novels, setNovels] = useState([]);
  const [selectedNovelId, setSelectedNovelId] = useState("");
  const [novelSlug, setNovelSlug] = useState("");
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(false);
  const [draftWarning, setDraftWarning] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [editingChapter, setEditingChapter] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    content: "",
    chapter_number: "",
    is_published: true,
  });

  useEffect(() => {
    const fetchNovels = async () => {
      try {
        const token = getAdminToken();
        if (token) {
          const optRes = await apiFetch("/admin/options/novels", {
            auth: "admin",
            cache: "no-store",
          });
          if (optRes.ok) {
            const data = await optRes.json();
            const list = Array.isArray(data) ? data : data.data || [];
            if (list.length) {
              setNovels(list);
              return;
            }
          }
          const adminRes = await apiFetch("/admin/novels/list", {
            auth: "admin",
            cache: "no-store",
          });
          if (adminRes.ok) {
            const data = await adminRes.json();
            setNovels(Array.isArray(data) ? data : data.data || []);
            return;
          }
        }
        const res = await apiFetch("/novels/?limit=100");
        if (res.ok) {
          const data = await res.json();
          setNovels(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Novel listesi çekilemedi:", err);
      }
    };
    fetchNovels();
  }, []);

  useEffect(() => {
    if (!selectedNovelId) {
      setChapters([]);
      setNovelSlug("");
      setDraftWarning(false);
      return;
    }

    const fetchChapters = async () => {
      setLoading(true);
      setDraftWarning(false);
      try {
        const res = await apiFetch(`/novels/${selectedNovelId}`, {
          cache: "no-store",
        });

        if (res.status === 404) {
          setChapters([]);
          setDraftWarning(true);
          return;
        }

        if (res.ok) {
          const data = await res.json();
          setNovelSlug(data.slug);
          const sorted = [...(data.chapters || [])].sort(
            (a, b) => Number(b.chapter_number) - Number(a.chapter_number)
          );
          setChapters(sorted);
        }
      } catch (err) {
        console.error("Bölümler çekilemedi:", err);
        toast.error("Bölümler yüklenemedi.");
      } finally {
        setLoading(false);
      }
    };

    fetchChapters();
  }, [selectedNovelId]);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await apiFetch(
        `/novels/${novelSlug}/chapters/${deleteTarget.chapter_number}`,
        {
          method: "DELETE",
          auth: "admin",
        }
      );

      if (res.ok) {
        setChapters((prev) =>
          prev.filter((c) => c.chapter_number !== deleteTarget.chapter_number)
        );
        toast.success("Bölüm silindi.");
        setDeleteTarget(null);
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || "Bölüm silinemedi.");
      }
    } catch (err) {
      console.error("Silme hatası:", err);
      toast.error("Bir hata oluştu.");
    } finally {
      setDeleting(false);
    }
  };

  const handleEditClick = (chapter) => {
    setEditingChapter(chapter);
    setEditForm({
      title: chapter.title || "",
      content: chapter.content || "",
      chapter_number: chapter.chapter_number,
      is_published: chapter.is_published ?? true,
    });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editingChapter || updating) return;
    setUpdating(true);

    try {
      const formData = new FormData();
      formData.append("title", editForm.title);
      formData.append("content", editForm.content);
      formData.append("new_chapter_number", String(editForm.chapter_number));
      formData.append("is_published", String(editForm.is_published));

      const res = await apiFetch(
        `/novels/${novelSlug}/chapters/${editingChapter.chapter_number}`,
        {
          method: "PUT",
          auth: "admin",
          body: formData,
        }
      );

      if (res.ok) {
        const updatedChapter = await res.json();
        setChapters((prev) =>
          prev.map((c) =>
            c.id === editingChapter.id
              ? {
                  ...c,
                  ...(updatedChapter.data || {}),
                  title: editForm.title,
                  content: editForm.content,
                  is_published: editForm.is_published,
                  chapter_number: Number(editForm.chapter_number),
                }
              : c
          )
        );
        setEditingChapter(null);
        toast.success("Bölüm güncellendi.");
      } else {
        const errorData = await res.json().catch(() => ({}));
        toast.error(errorData.detail || "Güncelleme başarısız.");
      }
    } catch (err) {
      console.error("Güncelleme hatası:", err);
      toast.error("Bir hata oluştu.");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <AdminPageHeader
        title="Novel Bölümleri"
        description="Novel seçerek bölümleri zengin metin editörüyle düzenleyin veya silin."
        actions={
          <Link
            href={
              selectedNovelId
                ? `/admin/novel-bolum-ekle?novel_id=${selectedNovelId}`
                : "/admin/novel-bolum-ekle"
            }
            className={buttonClasses({ variant: "primary", size: "md" })}
          >
            <Plus className="h-4 w-4" />
            Bölüm Ekle
          </Link>
        }
      />

      <div className={`${adminCardClass} p-5 mb-6`}>
        <label className={adminLabelClass}>Novel Seçin</label>
        <select
          className={`${adminSelectClass} w-full`}
          value={selectedNovelId}
          onChange={(e) => setSelectedNovelId(e.target.value)}
        >
          <option value="">-- Bir novel seçin --</option>
          {novels.map((novel) => (
            <option key={novel.id} value={novel.id}>
              {novel.title}
              {novel.is_published === false ? " [Taslak]" : ""}
            </option>
          ))}
        </select>
      </div>

      {selectedNovelId && (
        <div className={`${adminCardClass} overflow-hidden`}>
          <div className="p-5 border-b border-subtle flex justify-between items-center gap-3">
            <h2 className="text-base font-bold text-ink-primary">
              Bölümler ({chapters.length})
            </h2>
            <Link
              href={`/admin/novel-bolum-ekle?novel_id=${selectedNovelId}`}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              <Plus className="h-3.5 w-3.5" />
              Bu Seriye Bölüm Ekle
            </Link>
          </div>

          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : draftWarning ? (
            <div className="p-8 text-center space-y-2">
              <AlertCircle className="h-7 w-7 text-amber-400 mx-auto" />
              <p className="text-sm text-ink-primary font-medium">
                Bu novel henüz Taslak durumunda (yayınlanmamış).
              </p>
              <p className="text-xs text-ink-muted">
                Bölümleri görmek için{" "}
                <Link
                  href={`/admin/novels/${selectedNovelId}/edit`}
                  className="text-brand hover:underline"
                >
                  düzenleme sayfasından
                </Link>{" "}
                yayına alabilirsiniz.
              </p>
            </div>
          ) : chapters.length === 0 ? (
            <div className="p-10 text-center text-ink-muted text-sm">
              Bu seriye ait bölüm bulunamadı.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-canvas/70 border-b border-subtle text-xs font-semibold uppercase tracking-wider text-ink-muted">
                  <tr>
                    <th className="px-5 py-3.5">Bölüm No</th>
                    <th className="px-5 py-3.5">Başlık</th>
                    <th className="px-5 py-3.5">Durum</th>
                    <th className="px-5 py-3.5">Okunma</th>
                    <th className="px-5 py-3.5 text-right">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {chapters.map((chapter) => (
                    <tr key={chapter.id} className="hover:bg-white/[0.02]">
                      <td className="px-5 py-3.5 text-sm font-bold text-purple-400 tabular-nums">
                        #{chapter.chapter_number}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-medium text-ink-primary">
                        {chapter.title}
                      </td>
                      <td className="px-5 py-3.5">
                        {chapter.is_published ? (
                          <Badge variant="ongoing">Yayında</Badge>
                        ) : (
                          <Badge variant="completed">Taslak</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-ink-secondary tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Eye className="h-3.5 w-3.5 text-ink-muted" />
                          {(chapter.view_count || 0).toLocaleString("tr-TR")}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(chapter)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Düzenle
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(chapter)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rich-Text Chapter Edit Dialog */}
      <Dialog
        open={Boolean(editingChapter)}
        onOpenChange={(open) => !open && setEditingChapter(null)}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bölümü Düzenle</DialogTitle>
            <DialogDescription>
              Bölüm numarası, başlık ve zengin metin içeriğini güncelleyin.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdate} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={adminLabelClass}>Bölüm No *</label>
                <input
                  type="number"
                  step="any"
                  required
                  className={adminInputClass}
                  value={editForm.chapter_number}
                  onChange={(e) =>
                    setEditForm({ ...editForm, chapter_number: e.target.value })
                  }
                />
              </div>

              <div>
                <label className={adminLabelClass}>Durum</label>
                <select
                  className={`${adminSelectClass} w-full`}
                  value={String(editForm.is_published)}
                  onChange={(e) =>
                    setEditForm({
                      ...editForm,
                      is_published: e.target.value === "true",
                    })
                  }
                >
                  <option value="true">Yayında</option>
                  <option value="false">Taslak (Gizli)</option>
                </select>
              </div>
            </div>

            <div>
              <label className={adminLabelClass}>Bölüm Başlığı *</label>
              <input
                type="text"
                required
                className={adminInputClass}
                value={editForm.title}
                onChange={(e) =>
                  setEditForm({ ...editForm, title: e.target.value })
                }
              />
            </div>

            <div>
              <label className={adminLabelClass}>İçerik *</label>
              <div className="text-zinc-900 bg-white rounded-xl overflow-hidden border border-subtle">
                <EditorProvider>
                  <Editor
                    value={editForm.content}
                    onChange={(e) =>
                      setEditForm({ ...editForm, content: e.target.value })
                    }
                    className="min-h-[300px] p-3"
                  >
                    <Toolbar>
                      <BtnBold />
                      <BtnItalic />
                      <BtnUnderline />
                      <BtnStrikeThrough />
                      <BtnLink />
                      <BtnNumberedList />
                      <BtnBulletList />
                    </Toolbar>
                  </Editor>
                </EditorProvider>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingChapter(null)}
              >
                İptal
              </Button>
              <Button type="submit" variant="primary" loading={updating}>
                <Save className="h-4 w-4" />
                Kaydet & Güncelle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AdminConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Bölümü Sil"
        description={`Bölüm ${deleteTarget?.chapter_number || ""} kalıcı olarak silinecek. Emin misiniz?`}
        confirmLabel="Sil"
        loading={deleting}
        onConfirm={executeDelete}
      />
    </div>
  );
}
