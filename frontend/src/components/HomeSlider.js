"use client";
import { useState, useEffect } from "react";
// Swiper kütüphanesini çağırıyoruz
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, Pagination, EffectFade } from 'swiper/modules';

// Swiper CSS dosyalarını import ediyoruz (Zorunlu)
// import 'swiper/css';
// import 'swiper/css/pagination';
// import 'swiper/css/effect-fade'; // Eğer fade efekti istersen bunu kullanacağız

// Senin tasarım bileşenin
import FeaturedSlider from "./FeaturedSlider";
import { API } from "@/api";

// CSS ile Swiper'ın noktalarını (pagination) özelleştirelim
const styles = `
  .swiper-pagination-bullet {
    background: rgba(255, 255, 255, 0.5) !important;
    opacity: 1 !important;
    width: 8px !important;
    height: 8px !important;
    transition: all 0.3s ease !important;
  }
  .swiper-pagination-bullet-active {
    background: #a855f7 !important; /* Mor renk (Purple-500) */
    width: 24px !important;
    border-radius: 4px !important;
  }
`;

export default function HomeSlider() {
  const [slides, setSlides] = useState([]);

  // 1. Verileri Çek
  useEffect(() => {
    const fetchSliderData = async () => {
      try {
        const res = await fetch(`${API}/vitrin`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setSlides(data);
          }
        }
      } catch (err) {
        console.error("Slider hatası:", err);
      }
    };
    fetchSliderData();
  }, []);

  if (slides.length === 0) return null;

  return (
    <div className="relative w-full h-[450px] md:h-[550px] rounded-2xl overflow-hidden border border-gray-800 bg-[#121212]">
      {/* Özel CSS Stillerini ekle */}
      <style>{styles}</style>

      <Swiper
        modules={[Autoplay, Pagination, EffectFade]} // Modülleri yükle
        spaceBetween={0}                 // Slaytlar arası boşluk yok
        slidesPerView={1}                // Ekranda 1 tane göster
        loop={slides.length > 1}         // Eğer 1'den fazla slayt varsa sonsuz döngü yap
        speed={1000}                     // 1000ms = 1 saniye (Yumuşak geçiş hızı)
        grabCursor={true}                // Mouse ile tutulabilir imleci
        autoplay={{
          delay: 5000,                   // 5 saniyede bir değiş
          disableOnInteraction: false,   // Kullanıcı dokununca durmasın, devam etsin
        }}
        pagination={{
          clickable: true,               // Noktalara tıklanabilsin
          dynamicBullets: true           // Çok slayt varsa noktaları küçült
        }}
        className="w-full h-full"
      >
        {slides.map((slide) => (
          <SwiperSlide key={`${slide.typeLabel}-${slide.id}`}>
            {/* Senin tasarım bileşenin */}
            <FeaturedSlider webtoon={slide} />
          </SwiperSlide>
        ))}
      </Swiper>
    </div>
  );
}