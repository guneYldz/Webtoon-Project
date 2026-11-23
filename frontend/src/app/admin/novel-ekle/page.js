"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAdminToken } from "@/lib/apiClient";
import { Button } from "@/components/ui";
import {
  AdminPageHeader,
  adminCardClass,
  adminInputClass,
  adminTextareaClass,
  adminLabelClass,
} from "../_components/AdminUi";

function toTurkishSlug(val) {
  return String(val || "")
    .toLowerCase()
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NovelEkle() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [author, setAuthor] = useState("");
  const [summary, setSummary] = useState("");
  const [cover, setCover] = useState(null);
  const [preview, setPreview] = useState(null);

  const handleTitleChange = (val) => {
    setTitle(val);
    setSlug(toTurkishSlug(val));
  };

  const handleFileChange = (file) => {
    if (preview) URL.revokeObjectURL(preview);
    setCover(file || null);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) {
      toast.error("Önce admin girişi yapmalısınız.");
      router.push("/login-admin");
      return;
    }

    if (!cover) {
      toast.error("Lütfen bir kapak resmi seçin.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("slug", slug);
    formData.append("author", author);
    formData.append("summary", summary);
    formData.append("cover", cover);

    try {
      const response = await apiFetch("/novels/ekle", {
        method: "POST",
        auth: "admin",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || "Roman eklenirken bir hata oluştu.");
      }

      toast.success("Yeni roman başarıyla oluşturuldu!");
      router.push("/admin/novel-bolum-ekle");
    } catch (error) {
      toast.error(error.message || "Roman eklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AdminPageHeader
        title="Yeni Roman (Novel) Oluştur"
        description="Novel başlığı, slug ve kapak görselini ekleyip bölüm yüklemeye geçin."
      />

      <form onSubmit={handleSubmit} className={`${adminCardClass} p-6 space-y-5`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={adminLabelClass}>Roman Adı *</label>
            <input
              type="text"
              placeholder="Örn: Shadow Slave"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className={adminInputClass}
              required
            />
          </div>

          <div>
            <label className={adminLabelClass}>URL (Slug) *</label>
            <input
              type="text"
              placeholder="shadow-slave"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className={adminInputClass}
              required
            />
          </div>
        </div>

        <div>
          <label className={adminLabelClass}>Yazar</label>
          <input
            type="text"
            placeholder="Yazar adı"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className={adminInputClass}
          />
        </div>

        <div>
          <label className={adminLabelClass}>Roman Özeti *</label>
          <textarea
            rows={4}
            placeholder="Romanın konusunu yazın..."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className={adminTextareaClass}
            required
          />
        </div>

        <div>
          <label className={adminLabelClass}>Kapak Resmi *</label>
          <label className="relative border-2 border-dashed border-subtle hover:border-brand/50 rounded-xl p-6 text-center cursor-pointer bg-canvas/60 transition flex flex-col items-center justify-center">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
              className="sr-only"
            />
            {preview ? (
              <img
                src={preview}
                alt="Önizleme"
                className="h-36 object-cover rounded-lg shadow-md mb-2 border border-subtle"
              />
            ) : (
              <ImagePlus className="h-8 w-8 text-ink-muted mb-2" />
            )}
            <span className="text-xs text-ink-secondary">
              {cover ? cover.name : "Kapak görseli seçin (JPEG/PNG/WEBP)"}
            </span>
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          <Sparkles className="h-4 w-4" />
          Romanı Kaydet
        </Button>
      </form>
    </div>
  );
}
