import { useState, useEffect, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Massage } from '../../types';
import { formatCurrency } from '../../lib/currencyFormatter';

interface MassageDetailPanelProps {
  massage: Massage | null;
}

export default function MassageDetailPanel({ massage }: MassageDetailPanelProps) {
  const { t } = useTranslation('kiosk');
  const [displayedMassage, setDisplayedMassage] = useState<Massage | null>(massage);
  const [mediaError, setMediaError] = useState(false);

  // Handle fade transition animation (300ms) on massage selection (Requirement 2.3)
  // Optimized for Raspberry Pi performance (Requirements 17.1, 17.2)
  useEffect(() => {
    if (massage && massage.id !== displayedMassage?.id) {
      const panel = document.getElementById('massage-detail-content');
      if (!panel) {
        setDisplayedMassage(massage);
        return;
      }
      
      // Add will-change for performance hint (Requirement 17.5)
      panel.classList.add('will-change-opacity');
      
      // Fade out using CSS transition (300ms total, split into 150ms each)
      panel.style.opacity = '0';
      
      setTimeout(() => {
        // Update content at midpoint
        setDisplayedMassage(massage);
        setMediaError(false);
        
        // Fade in
        panel.style.opacity = '1';
        
        // Remove will-change after animation completes to free resources
        setTimeout(() => {
          panel.classList.remove('will-change-opacity');
        }, 150);
      }, 150);
    } else if (!massage) {
      setDisplayedMassage(null);
    }
  }, [massage, displayedMassage?.id]);

  if (!displayedMassage) {
    return (
      <div className="h-full w-3/4 bg-gray-950 flex items-center justify-center">
        <div className="text-center text-gray-500">
          <svg
            className="w-24 h-24 mx-auto mb-4 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"
            />
          </svg>
          <p className="text-xl">{t('menu.selectMassage')}</p>
        </div>
      </div>
    );
  }

  const layoutTemplate = displayedMassage.layoutTemplate || 'price-list';

  const renderMediaSection = (className: string, showTagsOverlay = true, bottomContent?: ReactNode) => (
    <div className={`${className} bg-black relative overflow-hidden`}>
      {!mediaError && displayedMassage.mediaUrl ? (
        <>
          {displayedMassage.mediaType === 'video' && (
            <video
              key={displayedMassage.id}
              className="w-full h-full object-cover"
              autoPlay
              muted
              loop
              playsInline
              onError={() => setMediaError(true)}
            >
              <source src={displayedMassage.mediaUrl} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          )}

          {displayedMassage.mediaType === 'photo' && (
            <img
              src={displayedMassage.mediaUrl}
              alt={displayedMassage.name}
              className="w-full h-full object-cover"
              onError={() => setMediaError(true)}
            />
          )}
          
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent"></div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <div className="text-center text-gray-600">
            <svg
              className="w-32 h-32 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-lg">{t('menu.mediaUnavailable')}</p>
          </div>
        </div>
      )}
      
      {showTagsOverlay && displayedMassage.purposeTags.length > 0 && (
        <div className="absolute top-8 left-8 flex flex-wrap gap-3">
          {displayedMassage.purposeTags.map((tag) => (
            <span
              key={tag}
              className="inline-block px-4 py-2 text-sm font-medium bg-white bg-opacity-20 backdrop-blur-md text-white rounded-full border border-white border-opacity-30"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {bottomContent}
    </div>
  );

  const renderPriceListLayout = () => (
    <div className="h-full w-4/5 bg-black overflow-hidden">
      <div 
        id="massage-detail-content" 
        className="h-full fade-transition flex flex-col" 
        style={{ opacity: 1 }}
      >
        {renderMediaSection('h-[60%]')}

        <div className="h-[40%] px-12 py-8 bg-black flex flex-col">
          <h2 className="text-5xl font-light text-white mb-4 tracking-tight">
            {displayedMassage.name}
          </h2>

          <div className="flex-1 overflow-y-auto kiosk-scrollbar mb-6">
            <p className="text-lg text-gray-400 leading-relaxed font-light">
              {displayedMassage.longDescription}
            </p>
          </div>

          {displayedMassage.sessions.length > 0 && (
            <div className="flex-shrink-0">
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
                {t('menu.pricing')}
              </h3>
              <div className={`grid gap-3 ${
                displayedMassage.sessions.length === 1 ? 'grid-cols-1 max-w-xs' :
                displayedMassage.sessions.length === 2 ? 'grid-cols-2' :
                displayedMassage.sessions.length === 3 ? 'grid-cols-3' :
                'grid-cols-4'
              }`}>
                {displayedMassage.sessions.map((session, index) => (
                  <div
                    key={index}
                    className={`bg-white bg-opacity-5 border border-white border-opacity-10 rounded-2xl hover:bg-opacity-10 transition-all duration-300 cursor-pointer ${
                      displayedMassage.sessions.length <= 2 ? 'p-6' :
                      displayedMassage.sessions.length === 3 ? 'p-5' :
                      'p-4'
                    }`}
                  >
                    <div className={`text-gray-400 mb-2 font-light ${
                      displayedMassage.sessions.length <= 2 ? 'text-sm' :
                      displayedMassage.sessions.length === 3 ? 'text-xs' :
                      'text-xs'
                    }`}>
                      {session.name}
                    </div>
                    <div className={`font-medium text-white ${
                      displayedMassage.sessions.length <= 2 ? 'text-2xl' :
                      displayedMassage.sessions.length === 3 ? 'text-xl' :
                      'text-lg'
                    }`}>
                      {formatCurrency(session.price)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderInfoTagsLayout = () => (
    <div className="h-full w-4/5 bg-black overflow-hidden">
      <div 
        id="massage-detail-content" 
        className="h-full fade-transition" 
        style={{ opacity: 1 }}
      >
        <div className="grid grid-cols-5 h-full">
          <div className="col-span-3">
            {renderMediaSection(
              'h-full',
              false,
              displayedMassage.duration ? (
                <div className="absolute bottom-8 left-8">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black bg-opacity-60 text-white text-sm border border-white border-opacity-20">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l2.5 2.5M12 6a9 9 0 100 18 9 9 0 000-18z" />
                    </svg>
                    {displayedMassage.duration}
                  </span>
                </div>
              ) : undefined
            )}
          </div>

          <div className="col-span-2 bg-gradient-to-b from-gray-950 to-black px-10 py-10 flex flex-col gap-6">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-[0.18em]">
                {t('menu.details')}
              </p>
              <h2 className="text-4xl font-semibold text-white leading-tight">{displayedMassage.name}</h2>
              <p className="text-base text-gray-300 leading-relaxed">
                {displayedMassage.longDescription || displayedMassage.shortDescription}
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-[0.18em]">
                {t('menu.tags')}
              </p>
              {displayedMassage.purposeTags.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {displayedMassage.purposeTags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-white bg-opacity-5 text-gray-100 border border-white border-opacity-10 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">{t('menu.noTags')}</p>
              )}
            </div>

            {displayedMassage.sessions.length > 0 && (
              <div className="mt-auto rounded-2xl bg-white bg-opacity-5 border border-white border-opacity-10 p-5 space-y-3">
                <div className="text-xs font-semibold text-blue-200 uppercase tracking-[0.18em]">
                  {t('menu.pricing')}
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto kiosk-scrollbar pr-1">
                  {displayedMassage.sessions.map((session, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between text-sm text-gray-100 bg-white bg-opacity-0 hover:bg-opacity-5 rounded-xl px-3 py-2 transition-colors"
                    >
                      <div className="font-medium">{session.name}</div>
                      <div className="text-base font-semibold">{formatCurrency(session.price)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderMediaFocusLayout = () => (
    <div className="h-full w-4/5 bg-black overflow-hidden">
      <div 
        id="massage-detail-content" 
        className="h-full fade-transition relative" 
        style={{ opacity: 1 }}
      >
        {renderMediaSection(
          'h-full',
          false,
          <div className="absolute inset-x-0 bottom-0 px-8 pb-10 pointer-events-none">
            <div
              className="max-w-4xl bg-black/70 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-2xl space-y-3 antialiased"
              style={{ fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif" }}
            >
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.22em] text-blue-100">
                <span className="px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10">
                  {t('menu.details')}
                </span>
                {displayedMassage.duration && (
                  <span className="px-3 py-1 rounded-full bg-white/5 text-white/80 border border-white/10">
                    {displayedMassage.duration}
                  </span>
                )}
              </div>
              <h2 className="text-4xl md:text-5xl font-semibold text-white leading-tight drop-shadow-md">
                {displayedMassage.name}
              </h2>
              <p className="text-base md:text-lg text-gray-100 leading-relaxed max-w-3xl drop-shadow-sm">
                {displayedMassage.longDescription || displayedMassage.shortDescription}
              </p>
              {displayedMassage.purposeTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {displayedMassage.purposeTags.slice(0, 6).map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-full bg-white/8 text-gray-100 border border-white/15 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderImmersiveShowcaseLayout = () => (
    <div className="h-full w-4/5 relative overflow-hidden bg-[#05060d]">
      <div className="absolute -left-24 -top-24 w-[420px] h-[420px] bg-blue-700/25 blur-[110px] rounded-full pointer-events-none"></div>
      <div className="absolute -right-20 bottom-[-140px] w-[520px] h-[520px] bg-purple-600/25 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 pointer-events-none"></div>

      <div id="massage-detail-content" className="relative h-full grid grid-cols-5">
        <div className="col-span-2 flex flex-col gap-6 px-10 py-10 z-10">
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs uppercase tracking-[0.22em] border border-white/15">
              {t('menu.details')}
            </span>
            {displayedMassage.duration && (
              <span className="px-3 py-1 rounded-full bg-white/10 text-white text-xs border border-white/15">
                {displayedMassage.duration}
              </span>
            )}
          </div>
          <h2 className="text-5xl font-semibold text-white leading-tight drop-shadow-lg">
            {displayedMassage.name}
          </h2>
          <p className="text-lg text-gray-200 leading-relaxed max-w-xl drop-shadow-sm">
            {displayedMassage.longDescription || displayedMassage.shortDescription}
          </p>
          {displayedMassage.purposeTags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {displayedMassage.purposeTags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 rounded-full bg-white/10 text-gray-100 border border-white/15 text-sm"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          {displayedMassage.sessions.length > 0 && (
            <div className="mt-auto space-y-3">
              <p className="text-xs uppercase tracking-[0.18em] text-blue-100">
                {t('menu.pricing')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto kiosk-scrollbar pr-1">
                {displayedMassage.sessions.map((session, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded-xl px-3 py-3 text-sm text-gray-100 shadow-sm"
                  >
                    <span className="font-medium">{session.name}</span>
                    <span className="text-base font-semibold">{formatCurrency(session.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="col-span-3 relative">
          {renderMediaSection(
            'h-full rounded-l-[32px] overflow-hidden border border-white/10 shadow-[0_30px_80px_rgba(0,0,0,0.55)]',
            false,
            displayedMassage.mediaUrl ? (
              <div className="absolute top-6 right-6 flex items-center gap-2 bg-black/55 text-white px-4 py-2 rounded-full border border-white/10 backdrop-blur-md">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l2.5 2.5M12 6a9 9 0 100 18 9 9 0 000-18z" />
                </svg>
                <span className="text-sm font-medium">{displayedMassage.duration || t('menu.details')}</span>
              </div>
            ) : undefined
          )}
        </div>
      </div>
    </div>
  );

  if (layoutTemplate === 'info-tags') return renderInfoTagsLayout();
  if (layoutTemplate === 'media-focus') return renderMediaFocusLayout();
  if (layoutTemplate === 'immersive-showcase') return renderImmersiveShowcaseLayout();
  return renderPriceListLayout();
}
