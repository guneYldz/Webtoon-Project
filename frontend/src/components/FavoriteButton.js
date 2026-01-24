"use client";

import { useState, useEffect } from "react";
import { API } from "@/api";

export default function FavoriteButton({ type, id, className }) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  // 1. Sayfa Yüklendiğinde Backend'e Sor: "Bu ID favoride mi?"
  useEffect(() => {
    if (!id || !type) return;

    const checkStatus = async () => {
      const token = localStorage.getItem("token");
      // Eğer giriş yapılmamışsa kontrol etme, direkt beyaz kalsın
      if (!token) {
        setChecking(false);
        return;
      }

      try {
        // Backend'indeki: router.get("/check/{type}/{id}") endpointine istek atıyoruz
        const res = await fetch(`${API}/favorites/check/${type}/${id}`, {
          method: "GET",
          headers: { 
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
        });

        if (res.ok) {
          const data = await res.json();
          // Backend { "is_favorited": true/false } dönüyor
          setIsFavorite(data.is_favorited);
        }
      } catch (err) {
        console.error("Favori kontrol hatası:", err);
      } finally {
        setChecking(false);
      }
    };

    checkStatus();
  }, [id, type]);

  // 2. Tıklayınca Ekle/Çıkar
  const toggleFavorite = async () => {
    const token = localStorage.getItem("token");
    
    if (!token) {
      alert("Favorilere eklemek için giriş yapmalısın! 🔒");
      return;
    }

    if (!id) return;

    setLoading(true);

    // Hız hissi için (Optimistic Update)
    const previousState = isFavorite;
    setIsFavorite(!isFavorite);

    // Backend'deki FavoriteCreate şemasına uygun payload
    const payload = type === "novel" ? { novel_id: id } : { webtoon_id: id };

    try {
      const res = await fetch(`${API}/favorites/toggle`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Hata olursa eski haline döndür
        setIsFavorite(previousState);
        alert("İşlem başarısız oldu.");
      } else {
        // Backend'den gelen kesin cevabı alıp state'i güncelle (Garanti olsun)
        const data = await res.json();
        if (data.is_favorited !== undefined) {
             setIsFavorite(data.is_favorited);
        }
      }
    } catch (err) {
      console.error("Bağlantı Hatası:", err);
      setIsFavorite(previousState);
    } finally {
      setLoading(false);
    }
  };

  // --- STİL AYARLARI (KIRMIZI BUTON) ---
  
  // Varsayılan Stiller
  const activeClass = "bg-red-600 border-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)] opacity-100";
  const inactiveClass = "bg-white text-gray-800 border-gray-300 hover:border-red-500 hover:text-red-600 hover:bg-red-50";

  let computedClass = "";

  if (checking) {
      // Yükleniyor durumunda hafif soluk gri
      computedClass = "opacity-50 cursor-wait bg-gray-200 text-gray-500 border-gray-300";
  } else if (className) {
      // Dışarıdan stil geldiyse (Novel/Webtoon detay sayfasından)
      // Eğer favorideyse !important ile KIPKIRMIZI yapıyoruz
      computedClass = `${className} ${isFavorite ? "!bg-red-600 !border-red-600 !text-white !opacity-100 !shadow-[0_0_15px_rgba(220,38,38,0.6)]" : ""}`;
  } else {
      // Standart stil
      computedClass = isFavorite ? activeClass : inactiveClass;
  }

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading || checking || !id}
      className={`
        px-6 py-3 rounded-full font-bold text-sm transition-all duration-300 
        flex items-center gap-2 shadow-lg border backdrop-blur-sm group
        ${computedClass}
        ${!id ? "opacity-50 cursor-not-allowed" : ""} 
      `}
    >
      {loading || checking ? (
        <span className="flex items-center gap-2">
           <i className="fa-solid fa-circle-notch fa-spin"></i>
        </span>
      ) : isFavorite ? (
        <>
          <i className="fa-solid fa-heart text-lg animate-bounce-short"></i> 
          Favorilerde
        </>
      ) : (
        <>
          <i className={`fa-regular fa-heart text-lg ${!className ? "group-hover:fa-solid" : ""}`}></i> 
          Favorilere Ekle
        </>
      )}
    </button>
  );
}