"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  apiFetch,
  getAdminToken,
  PUBLIC_API_URL,
  resolveMediaUrl,
} from "@/lib/apiClient";
import { Skeleton } from "@/components/ui";
import {
  Button,
  TypedCategoryPicker as CategoryPicker,
  AdminPageHeader,
  adminCardClass,
  adminInputClass,
  adminTextareaClass,
  adminSelectClass,
  adminLabelClass,
} from "../../../_components/AdminUi";

export default function EditWebtoonPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [webtoon, setWebtoon] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    summary: "",
    status: "ongoing",
    is_published: false,
    is_featured: false,
    source_url: "",
    series_type: "WEBTOON",
  });

  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [bannerImage, setBannerImage] = useState<File | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [token, setToken] = useState("");

  const webtoonId = params.id;

  useEffect(() => {
    setToken(getAdminToken() || "");

    const fetchWebtoon = async () => {
      try {
        const res = await apiFetch(`/admin/webtoons/${webtoonId}`, {
          auth: "admin",
          cache: "no-store",
        });
        const data = await res.json();

        if (data.status === "success" && data.data) {
          const w = data.data;
          setWebtoon(w);
          const rawType = String(w.type || "WEBTOON").toUpperCase();
          setFormData({
            title: w.title || "",
            summary: w.summary || "",
            status: w.status || "ongoing",
            is_published: Boolean(w.is_published),
            is_featured: Boolean(w.is_featured),
            source_url: w.source_url || "",
            series_type: rawType.includes("MANGA") ? "MANGA" : "WEBTOON",
          });
          setSelectedCategoryIds((w.categories || []).map((c: any) => c.id));
        } else {
          toast.error("Seri bulunamadı.");
        }
      } catch (error) {
        console.error("Webtoon yüklenemedi:", error);
        toast.error("Seri yüklenirken hata oluştu.");
      } finally {
        setLoading(false);
      }
    };

    fetchWebtoon();
  }, [webtoonId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const form = new FormData();
      form.append("title", formData.title);
      form.append("summary", formData.summary);
      form.append("status", formData.status);
      form.append("is_published", String(formData.is_published));
      form.append("is_featured", String(formData.is_featured));
      form.append("source_url", formData.source_url || "");
      form.append("series_type", formData.series_type || "WEBTOON");
      form.append("category_ids", selectedCategoryIds.join(","));

      if (coverImage) form.append("cover_image", coverImage);
      if (bannerImage) form.append("banner_image", bannerImage);

      const res = await apiFetch(`/admin/webtoons/${webtoonId}`, {
        method: "PUT",
        auth: "admin",
        body: form,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.status === "success") {
        toast.success("Seri güncellendi.");
        router.push("/admin/webtoons");
      } else {
        toast.error(data.detail || "Güncelleme başarısız oldu.");
      }
    } catch (error: any) {
      toast.error(error?.message || "Güncelleme hatası.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    );
  }

  if (!webtoon) {
    return (
      <div className="max-w-4xl mx-auto text-center py-12">
        <p className="text-rose-400 mb-4">Webtoon bulunamadı!</p>
        <Button variant="secondary" onClick={() => router.back()}>
          Geri Dön
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <AdminPageHeader
        title={`${formData.series_type === "MANGA" ? "Manga" : "Webtoon"} Düzenle`}
        description={webtoon.title}
        actions={
          <Button variant="secondary" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
            Geri
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className={`${adminCardClass} p-6 space-y-6`}>
        <div>
          <label className={adminLabelClass}>Başlık *</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            className={adminInputClass}
          />
        </div>

        <div>
          <label className={adminLabelClass}>Özet</label>
          <textarea
            rows={5}
            value={formData.summary}
            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
            className={adminTextareaClass}
          />
        </div>

        <div>
          <label className={adminLabelClass}>Kategoriler</label>
          <CategoryPicker
            api={PUBLIC_API_URL}
            token={token}
            selectedIds={selectedCategoryIds}
            onChange={setSelectedCategoryIds}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={adminLabelClass}>Tür</label>
            <select
              value={formData.series_type}
              onChange={(e) =>
                setFormData({ ...formData, series_type: e.target.value })
              }
              className={`${adminSelectClass} w-full`}
            >
              <option value="WEBTOON">Webtoon</option>
              <option value="MANGA">Manga</option>
            </select>
          </div>

          <div>
            <label className={adminLabelClass}>Durum</label>
            <select
              value={formData.status}
              onChange={(e) =>
                setFormData({ ...formData, status: e.target.value })
              }
              className={`${adminSelectClass} w-full`}
            >
              <option value="ongoing">Devam Ediyor</option>
              <option value="completed">Tamamlandı</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-canvas border border-subtle cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_published}
              onChange={(e) =>
                setFormData({ ...formData, is_published: e.target.checked })
              }
              className="w-4 h-4 accent-brand rounded"
            />
            <span className="text-sm font-medium text-ink-primary">
              Yayında (Kullanıcılara görünür)
            </span>
          </label>

          <label className="flex items-center gap-3 p-3.5 rounded-xl bg-canvas border border-subtle cursor-pointer">
            <input
              type="checkbox"
              checked={formData.is_featured}
              onChange={(e) =>
                setFormData({ ...formData, is_featured: e.target.checked })
              }
              className="w-4 h-4 accent-brand rounded"
            />
            <span className="text-sm font-medium text-ink-primary">
              Öne Çıkan (Ana sayfa vitrininde göster)
            </span>
          </label>
        </div>

        <div>
          <label className={adminLabelClass}>Kaynak URL (Opsiyonel)</label>
          <input
            type="url"
            value={formData.source_url}
            onChange={(e) =>
              setFormData({ ...formData, source_url: e.target.value })
            }
            className={adminInputClass}
            placeholder="https://orijinal-kaynak.com/..."
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className={adminLabelClass}>Kapak Resmi</label>
            {webtoon.cover_image && (
              <div className="mb-3">
                <img
                  src={resolveMediaUrl(webtoon.cover_image)}
                  alt="Mevcut Kapak"
                  className="h-28 rounded-xl border border-subtle object-cover"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
              className="w-full text-xs text-ink-secondary file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-subtle file:bg-elevated file:text-ink-primary file:font-semibold hover:file:bg-white/10"
            />
          </div>

          <div>
            <label className={adminLabelClass}>Banner Resmi (Slider)</label>
            {webtoon.banner_image && (
              <div className="mb-3">
                <img
                  src={resolveMediaUrl(webtoon.banner_image)}
                  alt="Mevcut Banner"
                  className="h-28 w-full rounded-xl border border-subtle object-cover"
                />
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBannerImage(e.target.files?.[0] || null)}
              className="w-full text-xs text-ink-secondary file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-subtle file:bg-elevated file:text-ink-primary file:font-semibold hover:file:bg-white/10"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-subtle">
          <Button type="submit" variant="primary" loading={submitting}>
            <Save className="h-4 w-4" />
            Güncelle
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            İptal
          </Button>
        </div>
      </form>
    </div>
  );
}
