"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Editor, EditorProvider, Toolbar, BtnBold, BtnItalic, BtnUnderline, BtnLink, BtnStrikeThrough, BtnNumberedList, BtnBulletList } from "react-simple-wysiwyg";

export default function NovelBolumEkle() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [novels, setNovels] = useState([]);
  const API = process.env.NEXT_PUBLIC_API_URL || "https://kaosmanga.net/api";

  const [selectedNovel, setSelectedNovel] = useState("");
  const [title, setTitle] = useState("");
  const [chapterNumber, setChapterNumber] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    fetch(`${API}/novels/`)
      .then((res) => res.json())
      .then((data) => setNovels(data))
      .catch((err) => console.error("Romanlar çekilemedi:", err));
  }, [API]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedNovel || !content) {
      alert("Lütfen bir roman seçin ve içerik girin.");
      return;
    }

    setLoading(true);
    const token = sessionStorage.getItem("access_token") ||
      sessionStorage.getItem("admin_token") ||
      sessionStorage.getItem("token");

    const formData = new FormData();
    formData.append("novel_id", selectedNovel);
    formData.append("chapter_number", chapterNumber);
    formData.append("title", title);
    formData.append("content", content);

    try {
      const response = await fetch(`${API}/novels/bolum-ekle`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Yükleme sırasında bir hata oluştu.");

      alert("✅ Roman Bölümü Başarıyla Yayınlandı!");
      setTitle("");
      setChapterNumber("");
      setContent("");
    } catch (error) {
      alert("❌ Hata: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center py-10 px-4">
      <div className="bg-gray-800 p-8 rounded-xl shadow-2xl w-full max-w-4xl border border-gray-700">

        <h1 className="text-3xl font-bold mb-6 text-blue-400 border-b border-gray-700 pb-4 flex justify-between items-center">
          <span>📖 Roman Bölümü Yükle</span>
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-gray-400 font-medium mb-1">Hangi Roman?</label>
            <select
              value={selectedNovel}
              onChange={(e) => setSelectedNovel(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white outline-none"
              required
            >
              <option value="">Seçiniz...</option>
              {novels.map((n) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              type="number"
              placeholder="Bölüm No"
              value={chapterNumber}
              onChange={(e) => setChapterNumber(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg p-3 text-white outline-none"
              required
            />
            <input
              type="text"
              placeholder="Bölüm Başlığı"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-gray-700 border border-gray-600 rounded-lg p-3 text-white outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-gray-400 font-medium mb-1">Bölüm İçeriği</label>
            <div className="text-black bg-white rounded-lg">
              <EditorProvider>
                <Editor
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="min-h-[400px]"
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

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg text-white font-bold text-lg ${loading ? "bg-gray-600" : "bg-blue-600 hover:bg-blue-500"
              }`}
          >
            {loading ? "Bölüm Yayınlanıyor..." : "Bölümü Yayınla 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}