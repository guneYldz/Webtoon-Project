"use client";

import { useState } from "react";
import { Megaphone, ImagePlus, Trash2, Send } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/apiClient";
import {
  Button,
  AdminPageHeader,
  AdminConfirmDialog,
  adminCardClass,
  adminInputClass,
  adminTextareaClass,
  adminLabelClass,
} from "../_components/AdminUi";

export default function AnnouncementsAdminPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onPickImage = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setImage(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error("Başlık ve mesaj alanları zorunludur.");
      return;
    }
    setConfirmOpen(true);
  };

  const executeSend = async () => {
    setLoading(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("message", message.trim());
      if (link.trim()) form.append("link", link.trim());
      if (image) form.append("image", image);

      const res = await apiFetch("/admin/announcements", {
        method: "POST",
        auth: "admin",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "success") {
        toast.success(data.message || "Duyuru tüm kullanıcılara gönderildi.");
        setTitle("");
        setMessage("");
        setLink("");
        onPickImage(null);
        setConfirmOpen(false);
      } else {
        toast.error(data.detail || "Duyuru gönderilemedi.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Bağlantı hatası oluştu.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AdminPageHeader
        title="Duyuru Gönder"
        description="Yayınlanan duyurular tüm aktif üyelerin bildirim ziline iletilir ve Duyurular sayfasında listelenir."
      />

      <form onSubmit={handleSubmit} className={`${adminCardClass} p-6 space-y-5`}>
        <div>
          <label className={adminLabelClass}>Başlık</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            placeholder="Örn: Yeni özellik yayında!"
            className={adminInputClass}
            required
          />
        </div>

        <div>
          <label className={adminLabelClass}>Mesaj</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            placeholder="Duyuru metnini yazın..."
            className={`${adminTextareaClass} resize-y`}
            required
          />
        </div>

        <div>
          <label className={adminLabelClass}>Fotoğraf (Opsiyonel)</label>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-subtle hover:border-brand/50 rounded-xl p-5 cursor-pointer bg-canvas/60 transition text-center">
            <ImagePlus className="h-6 w-6 text-ink-muted mb-2" />
            <span className="text-xs text-ink-secondary">
              {image ? image.name : "JPG, PNG, WEBP veya GIF seçin"}
            </span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => onPickImage(e.target.files?.[0] || null)}
              className="hidden"
            />
          </label>

          {preview && (
            <div className="mt-3 rounded-xl border border-subtle bg-canvas p-3">
              <img
                src={preview}
                alt="Önizleme"
                className="max-h-56 rounded-lg object-contain mx-auto"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onPickImage(null)}
                  className="text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Fotoğrafı Kaldır
                </Button>
              </div>
            </div>
          )}
        </div>

        <div>
          <label className={adminLabelClass}>Yönlendirme Linki (Opsiyonel)</label>
          <input
            type="text"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="/novel/shadow-slave veya https://..."
            className={adminInputClass}
          />
          <p className="text-xs text-ink-muted mt-1">
            Bildirime tıklandığında kullanıcı bu adrese yönlendirilir.
          </p>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full">
          <Megaphone className="h-4 w-4" />
          Tüm Kullanıcılara Gönder
        </Button>
      </form>

      <AdminConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Duyuruyu Yayınla"
        description="Bu duyuru tüm aktif kullanıcılara bildirim olarak gönderilecek. Devam etmek istiyor musunuz?"
        confirmLabel="Evet, Gönder"
        variant="primary"
        loading={loading}
        onConfirm={executeSend}
      />
    </div>
  );
}
