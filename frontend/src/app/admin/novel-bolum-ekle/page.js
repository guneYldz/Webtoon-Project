"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { UploadCloud } from "lucide-react";
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
  defaultChapterTitle,
  formatChapterNumber,
  isAutoChapterTitle,
} from "@/lib/chapterTitle";
import { Button, Skeleton } from "@/components/ui";
import {
  AdminPageHeader,
  adminCardClass,
  adminInputClass,
  adminSelectClass,
  adminLabelClass,
} from "../_components/AdminUi";

function NovelBolumEkle() {
  const searchParams = useSearchParams();
  const preselectedId = searchParams.get("novel_id") || "";

  const [loading, setLoading] = useState(false);
  const [novels, setNovels] = useState([]);
  const [selectedNovel, setSelectedNovel] = useState(preselectedId);
  const [title, setTitle] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (preselectedId) setSelectedNovel(preselectedId);
  }, [preselectedId]);

  useEffect(() => {
    const load = async () => {
      const token = getAdminToken();
      let list = [];
      try {
        if (token) {
          const res = await apiFetch("/admin/novel/list", { auth: "admin" });
          if (res.ok) {
            const data = await res.json();
            list = Array.isArray(data) ? data : data.data || [];
          }
        }
        if (!list.length) {
          const res = await apiFetch("/novels/?limit=1000");
          if (res.ok) {
            const data = await res.json();
            list = Array.isArray(data) ? data : data.data || [];
          }
        }
      } catch (err) {
        console.error("Romanlar çekilemedi:", err);
      }
      setNovels(list);
    };
    load();
  }, []);

  const onChapterNumberChange = (value) => {
    setChapterNumber(value);
    if (!value) return;
    if (!title || isAutoChapterTitle(title)) {
      setTitle(`Bölüm ${formatChapterNumber(value)}`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNovel || !content.trim()) {
      toast.error("Lütfen bir roman seçin ve içerik girin.");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("novel_id", selectedNovel);
    formData.append("chapter_number", chapterNumber);
    formData.append("title", defaultChapterTitle(title, chapterNumber));
    formData.append("content", content);

    try {
      const response = await apiFetch("/novels/bolum-ekle", {
        method: "POST",
        auth: "admin",
        body: formData,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || "Yükleme sırasında bir hata oluştu.");
      }

      toast.success("Roman bölümü başarıyla yayınlandı!");
      setTitle("");
      setChapterNumber("");
      setContent("");
    } catch (error) {
      toast.error(error.message || "Bölüm yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <AdminPageHeader
        title="Novel Bölümü Yükle"
        description="Rich-text editör ile yeni roman bölümü oluşturup yayınlayın."
      />

      <form onSubmit={handleSubmit} className={`${adminCardClass} p-6 space-y-5`}>
        <div>
          <label className={adminLabelClass}>Hangi Novel? *</label>
          <select
            value={selectedNovel}
            onChange={(e) => setSelectedNovel(e.target.value)}
            className={`${adminSelectClass} w-full`}
            required
          >
            <option value="">Seçiniz...</option>
            {novels.map((n) => (
              <option key={n.id} value={n.id}>
                {n.title}
                {n.is_published === false ? " [Taslak]" : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={adminLabelClass}>Bölüm No *</label>
            <input
              type="number"
              step="any"
              placeholder="1"
              value={chapterNumber}
              onChange={(e) => onChapterNumberChange(e.target.value)}
              className={adminInputClass}
              required
            />
          </div>
          <div>
            <label className={adminLabelClass}>Bölüm Başlığı</label>
            <input
              type="text"
              placeholder="Bölüm 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={adminInputClass}
            />
            <p className="text-[11px] text-ink-muted mt-1">
              Boş bırakırsanız otomatik “Bölüm {chapterNumber || "1"}” olur.
            </p>
          </div>
        </div>

        <div>
          <label className={adminLabelClass}>Bölüm İçeriği *</label>
          <div className="text-zinc-900 bg-white rounded-xl overflow-hidden border border-subtle">
            <EditorProvider>
              <Editor
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[380px] p-3"
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

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={loading}
          className="w-full"
        >
          <UploadCloud className="h-4 w-4" />
          Bölümü Yayınla
        </Button>
      </form>
    </div>
  );
}

export default function NovelBolumEklePage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      }
    >
      <NovelBolumEkle />
    </Suspense>
  );
}
