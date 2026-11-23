"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ImagePlus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, getAdminToken } from "@/lib/apiClient";
import { Button, Skeleton } from "@/components/ui";
import {
  AdminPageHeader,
  adminCardClass,
  adminInputClass,
  adminTextareaClass,
  adminSelectClass,
  adminLabelClass,
} from "../_components/AdminUi";

function WebtoonEkle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typeFromUrl = (searchParams.get("series_type") || "WEBTOON").toUpperCase();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    ad: "",
    ozet: "",
    durum: "Devam Ediyor",
    series_type: typeFromUrl === "MANGA" ? "MANGA" : "WEBTOON",
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);

  useEffect(() => {
    const t = (searchParams.get("series_type") || "").toUpperCase();
    if (t === "MANGA" || t === "WEBTOON") {
      setFormData((prev) =>
        prev.series_type === t ? prev : { ...prev, series_type: t }
      );
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (preview) URL.revokeObjectURL(preview);
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getAdminToken();
    if (!token) {
      toast.error("Önce admin girişi yapmalısınız.");
      router.push("/login-admin");
      return;
    }

    if (!file) {
      toast.error("Lütfen bir kapak resmi seçin.");
      return;
    }

    setLoading(true);
    const data = new FormData();
    data.append("baslik", formData.ad);
    data.append("ozet", formData.ozet);
    data.append("series_type", formData.series_type || "WEBTOON");
    data.append("resim", file);

    try {
      const response = await apiFetch("/webtoons/ekle", {
        method: "POST",
        auth: "admin",
        body: data,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Yükleme başarısız");
      }

      toast.success(
        formData.series_type === "MANGA"
          ? "Manga başarıyla oluşturuldu!"
          : "Webtoon başarıyla oluşturuldu!"
      );
      router.push("/admin/webtoons");
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Seri oluşturulamadı.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <AdminPageHeader
        title={formData.series_type === "MANGA" ? "Yeni Manga Ekle" : "Yeni Webtoon Ekle"}
        description="Seri bilgilerini doldurup kapak görselini yükleyin."
      />

      <form onSubmit={handleSubmit} className={`${adminCardClass} p-6 space-y-5`}>
        <div>
          <label className={adminLabelClass}>Seri Adı *</label>
          <input
            type="text"
            name="ad"
            value={formData.ad}
            onChange={handleChange}
            required
            className={adminInputClass}
            placeholder="Örn: Solo Leveling"
          />
        </div>

        <div>
          <label className={adminLabelClass}>Özet / Konu *</label>
          <textarea
            name="ozet"
            value={formData.ozet}
            onChange={handleChange}
            required
            rows={4}
            className={adminTextareaClass}
            placeholder="Hikaye ne hakkında?"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={adminLabelClass}>Tür</label>
            <select
              name="series_type"
              value={formData.series_type}
              onChange={handleChange}
              className={`${adminSelectClass} w-full`}
            >
              <option value="WEBTOON">Webtoon</option>
              <option value="MANGA">Manga</option>
            </select>
          </div>

          <div>
            <label className={adminLabelClass}>Durum</label>
            <select
              name="durum"
              value={formData.durum}
              onChange={handleChange}
              className={`${adminSelectClass} w-full`}
            >
              <option value="Devam Ediyor">Devam Ediyor</option>
              <option value="Tamamlandı">Tamamlandı</option>
              <option value="Sezon Finali">Sezon Finali</option>
            </select>
          </div>
        </div>

        <div>
          <label className={adminLabelClass}>Kapak Resmi *</label>
          <label className="relative border-2 border-dashed border-subtle hover:border-brand/50 rounded-xl p-6 text-center cursor-pointer bg-canvas/60 transition flex flex-col items-center justify-center">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
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
              {file ? file.name : "Kapak görseli seçin veya sürükleyin"}
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
          {formData.series_type === "MANGA" ? "Manga Oluştur" : "Webtoon Oluştur"}
        </Button>
      </form>
    </div>
  );
}

export default function WebtoonEklePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <WebtoonEkle />
    </Suspense>
  );
}
