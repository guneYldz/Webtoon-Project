"use client";

import { useRef, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination, EffectFade } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";

import "swiper/css";
import "swiper/css/pagination";
import "swiper/css/effect-fade";

import FeaturedSlider from "./FeaturedSlider";

const styles = `
  .hero-swiper .swiper-pagination {
    bottom: 18px !important;
    left: 24px !important;
    width: auto !important;
    text-align: left !important;
    z-index: 30 !important;
  }
  @media (min-width: 768px) {
    .hero-swiper .swiper-pagination {
      left: 48px !important;
      bottom: 24px !important;
    }
  }
  .hero-swiper .swiper-pagination-bullet {
    background: rgba(255, 255, 255, 0.35) !important;
    opacity: 1 !important;
    width: 8px !important;
    height: 8px !important;
    transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;
  }
  .hero-swiper .swiper-pagination-bullet-active {
    background: #A855F7 !important;
    width: 28px !important;
    border-radius: 9999px !important;
  }
`;

export default function HomeSlider({ slides = [] }) {
  const swiperRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!slides || slides.length === 0) return null;

  return (
    <div className="hero-swiper relative w-full h-[440px] md:h-[520px] rounded-2xl overflow-hidden border border-subtle bg-surface shadow-2xl group/slider">
      <style>{styles}</style>

      <Swiper
        modules={[Autoplay, Pagination, EffectFade]}
        effect="fade"
        fadeEffect={{ crossFade: true }}
        spaceBetween={0}
        slidesPerView={1}
        loop={slides.length > 1}
        speed={700}
        grabCursor={true}
        onSwiper={(swiper) => {
          swiperRef.current = swiper;
        }}
        onSlideChange={(swiper) => {
          setActiveIndex(swiper.realIndex);
        }}
        autoplay={{
          delay: 6000,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        pagination={{
          clickable: true,
        }}
        className="w-full h-full"
      >
        {slides.map((slide, index) => (
          <SwiperSlide key={`${slide.typeLabel || slide.type}-${slide.id}`}>
            <FeaturedSlider webtoon={slide} isFirst={index === 0} />
          </SwiperSlide>
        ))}
      </Swiper>

      {/* Glass Prev/Next Controls + Slide Counter */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 right-4 md:bottom-6 md:right-8 z-30 flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center rounded-full border border-white/10 bg-black/50 backdrop-blur-md px-3 py-1 text-xs font-semibold text-ink-secondary">
            <strong className="text-ink-primary">{activeIndex + 1}</strong>
            <span className="mx-1 text-ink-muted">/</span>
            <span>{slides.length}</span>
          </span>

          <button
            type="button"
            onClick={() => swiperRef.current?.slidePrev()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 hover:bg-brand/80 hover:border-brand text-white backdrop-blur-md transition-all duration-200 focus-visible:outline-none"
            aria-label="Önceki Slayt"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => swiperRef.current?.slideNext()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/50 hover:bg-brand/80 hover:border-brand text-white backdrop-blur-md transition-all duration-200 focus-visible:outline-none"
            aria-label="Sonraki Slayt"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
