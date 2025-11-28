import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Massage } from '../../types';
import { formatCurrency } from '../../lib/currencyFormatter';

interface NeoDigitalMenuProps {
  massages: Massage[];
}

export default function NeoDigitalMenu({ massages }: NeoDigitalMenuProps) {
  const { t } = useTranslation('kiosk');
  const [selected, setSelected] = useState<Massage | null>(null);
  const [sliderIndex, setSliderIndex] = useState(0);
  const [heroFade, setHeroFade] = useState(1);
  const [showPricing, setShowPricing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const featuredOnly = useMemo(() => massages.filter((m) => m.isFeatured), [massages]);
  const sliderList = useMemo(
    () => (featuredOnly.length > 0 ? featuredOnly : massages),
    [featuredOnly, massages]
  );
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollLeft = useRef(0);
  const pauseTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (massages.length > 0) {
      setSelected((prev) => prev ?? massages[0]);
      setSliderIndex(0);
    }
  }, [massages]);

  const featuredFirst = useMemo(
    () => [...massages].sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured)),
    [massages]
  );

  // Auto-advance through featured massages (fallback to full list)
  // Pauses when user interacts
  useEffect(() => {
    if (sliderList.length < 2 || isPaused) return;
    let idx = sliderList.findIndex((m) => m.id === selected?.id);
    if (idx === -1) idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % sliderList.length;
      setSelected(sliderList[idx]);
      setSliderIndex(idx);
    }, 8000);
    return () => clearInterval(interval);
  }, [sliderList, selected?.id, isPaused]);

  useEffect(() => {
    if (!selected) return;
    const idx = sliderList.findIndex((m) => m.id === selected.id);
    if (idx !== -1) {
      setSliderIndex(idx);
    }
    setHeroFade(0);
    const timeout = setTimeout(() => setHeroFade(1), 50);
    return () => clearTimeout(timeout);
  }, [selected?.id, featuredOnly, featuredFirst]);

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    dragStartX.current = pageX - (carouselRef.current?.offsetLeft || 0);
    dragScrollLeft.current = carouselRef.current?.scrollLeft || 0;
  };

  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !carouselRef.current) return;
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    const x = pageX - carouselRef.current.offsetLeft;
    const walk = (x - dragStartX.current) * 1.2; // drag speed
    carouselRef.current.scrollLeft = dragScrollLeft.current - walk;
  };

  const handleDragEnd = () => {
    isDragging.current = false;
  };

  // Pause auto-advance when user interacts
  const handleUserInteraction = () => {
    setIsPaused(true);
    
    // Clear existing timeout
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    
    // Resume auto-advance after 60 seconds of inactivity
    pauseTimeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 60000);
  };

  // Cleanup pause timeout on unmount
  useEffect(() => {
    return () => {
      if (pauseTimeoutRef.current) {
        clearTimeout(pauseTimeoutRef.current);
      }
    };
  }, []);

  if (!selected) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-black text-white">
        {t('menu.noMassages')}
      </div>
    );
  }

  return (
    <div className="relative h-full w-full bg-[#04050b] overflow-hidden text-white isolate">
      <div className="absolute -left-32 -top-40 w-[520px] h-[520px] rounded-full bg-emerald-600/14 blur-[140px] pointer-events-none z-0" />
      <div className="absolute right-[-220px] bottom-[-180px] w-[620px] h-[620px] rounded-full bg-indigo-700/18 blur-[150px] pointer-events-none z-0" />

      <div className="relative h-full flex flex-col gap-4 px-6 py-5 z-10">
        <div className="flex flex-1 gap-4 min-h-0 relative z-20">
          {/* Hero media */}
          <div
            className="flex-[3] min-h-0 rounded-3xl border border-white/10 overflow-hidden shadow-2xl bg-black/30 backdrop-blur-lg relative transition-all duration-500 ease-out z-10"
            style={{ opacity: heroFade }}
          >
            {selected.mediaUrl ? (
              selected.mediaType === 'video' ? (
                <video
                  key={selected.id}
                  className="w-full h-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                >
                  <source src={selected.mediaUrl} type="video/mp4" />
                </video>
              ) : (
                <img
                  src={selected.mediaUrl}
                  alt={selected.name}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-300">
                {t('menu.mediaUnavailable')}
              </div>
            )}
            {selected.purposeTags.length > 0 && (
              <div className="absolute top-4 left-4 flex flex-wrap gap-2 max-w-[70%] pointer-events-none">
                {selected.purposeTags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 rounded-full bg-white/18 text-white text-xs border border-white/25 backdrop-blur-md shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-5 flex items-center justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-100">
                  {t('menu.details')}
                </p>
                <h2 className="text-3xl md:text-4xl font-semibold drop-shadow-lg">{selected.name}</h2>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className={`flex-[2] min-h-0 flex flex-col gap-3 transition-all duration-300 z-20`}>
            <div className={`rounded-2xl border border-white/10 bg-[#06070f]/90 backdrop-blur-md p-5 shadow-xl ${showPricing ? 'min-h-[160px]' : 'min-h-[220px]'}`}>
              <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-100 mb-2">
                {t('menu.details')}
              </p>
              <div
                className={`leading-relaxed text-gray-100 overflow-y-auto kiosk-scrollbar transition-all duration-300 ${
                  showPricing ? 'text-base max-h-48' : 'text-lg max-h-72'
                }`}
              >
                {selected.longDescription || selected.shortDescription}
              </div>
            </div>

            {selected.sessions.length > 0 && (
              <div
                className={`overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-indigo-900/50 to-emerald-900/30 backdrop-blur-xl shadow-xl transition-all duration-500 ${
                  showPricing
                    ? selected.sessions.length > 2
                      ? 'max-h-80 p-4 flex-1 min-h-0'
                      : 'max-h-64 p-4'
                    : 'max-h-0 p-0 border-transparent'
                }`}
              >
                {showPricing && (
                  <div className="flex flex-col gap-3 animate-fadeIn">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-indigo-100">
                        {t('menu.pricing')}
                      </p>
                      <span className="text-[11px] text-white/70">
                        {t('menu.sessions')} ({selected.sessions.length})
                      </span>
                    </div>
                    <div
                      className={`grid gap-3 max-h-full overflow-y-auto kiosk-scrollbar pr-1 ${
                        selected.sessions.length > 2 ? 'grid-cols-2' : 'grid-cols-1 max-w-lg'
                      }`}
                    >
                      {selected.sessions.map((session) => (
                        <div
                          key={session.name}
                          className="rounded-2xl border border-white/12 bg-white/8 hover:border-emerald-300/60 hover:bg-emerald-400/10 transition-all shadow-[0_8px_24px_rgba(0,0,0,0.28)] px-4 py-4 flex items-center justify-between gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{session.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
                              {formatCurrency(session.price)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {selected.sessions.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowPricing((v) => !v);
                    handleUserInteraction();
                  }}
                  className="px-4 py-2 rounded-full bg-white/10 border border-white/20 text-xs uppercase tracking-[0.16em] text-white hover:bg-white/20 transition-colors"
                >
                  {showPricing ? t('menu.hidePricing') : t('menu.showPricing')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Carousel */}
        <div className="pt-1 z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">
              {t('menu.featured')}
            </p>
            <div className="flex items-center gap-2">
              {featuredFirst.map((_, idx) => (
                <span
                  key={idx}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    idx === sliderIndex ? 'bg-emerald-400 shadow-[0_0_0_6px_rgba(16,185,129,0.18)]' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
          <div
            ref={carouselRef}
            className="flex gap-3 overflow-x-auto pb-2 kiosk-scrollbar cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleDragStart}
            onMouseMove={handleDragMove}
            onMouseUp={handleDragEnd}
            onMouseLeave={handleDragEnd}
            onTouchStart={handleDragStart}
            onTouchMove={handleDragMove}
            onTouchEnd={handleDragEnd}
          >
            {featuredFirst.map((massage, idx) => {
              const isSelected = massage.id === selected?.id;
              return (
                <button
                  key={massage.id}
                  onClick={() => {
                    setSelected(massage);
                    setSliderIndex(idx);
                    handleUserInteraction();
                  }}
                  className={`min-w-[200px] max-w-[220px] text-left rounded-2xl border ${
                    isSelected
                      ? 'border-emerald-400/60 bg-emerald-900/40 shadow-[0_10px_40px_rgba(16,185,129,0.35)]'
                      : 'border-white/10 bg-white/5 hover:border-white/30'
                  } backdrop-blur-md p-4 transition-all duration-200`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    {massage.isFeatured && (
                      <span className="px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-100 text-[10px] uppercase tracking-[0.16em]">
                        {t('menu.featured')}
                      </span>
                    )}
                    {massage.isCampaign && (
                      <span className="px-2 py-1 rounded-full bg-pink-500/20 text-pink-100 text-[10px] uppercase tracking-[0.16em]">
                        {t('slideshow.promotional')}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white leading-tight line-clamp-2">
                    {massage.name}
                  </h3>
                  <p className="text-[11px] text-white/70 mt-2 line-clamp-3">
                    {massage.shortDescription}
                  </p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
