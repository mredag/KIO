import { useState, useEffect } from 'react';
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

  return (
    <div className="h-full w-4/5 bg-black overflow-hidden">
      <div 
        id="massage-detail-content" 
        className="h-full fade-transition flex flex-col" 
        style={{ opacity: 1 }}
      >
        {/* Media section - 60% height */}
        <div className="h-[60%] bg-black relative overflow-hidden">
          {!mediaError && displayedMassage.mediaUrl ? (
            <>
              {/* Video player (Requirement 2.5) */}
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

              {/* Image display (Requirement 2.6) */}
              {displayedMassage.mediaType === 'photo' && (
                <img
                  src={displayedMassage.mediaUrl}
                  alt={displayedMassage.name}
                  className="w-full h-full object-cover"
                  onError={() => setMediaError(true)}
                />
              )}
              
              {/* Gradient overlay at bottom */}
              <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent"></div>
            </>
          ) : (
            // Placeholder for media loading error (Requirement 2.8)
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
          
          {/* Purpose tags overlay on media */}
          {displayedMassage.purposeTags.length > 0 && (
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
        </div>

        {/* Details section - 40% height */}
        <div className="h-[40%] px-12 py-8 bg-black flex flex-col">
          {/* Massage name (Requirement 2.4) */}
          <h2 className="text-5xl font-light text-white mb-4 tracking-tight">
            {displayedMassage.name}
          </h2>

          {/* Long description (Requirement 2.4) - scrollable if needed */}
          <div className="flex-1 overflow-y-auto kiosk-scrollbar mb-6">
            <p className="text-lg text-gray-400 leading-relaxed font-light">
              {displayedMassage.longDescription}
            </p>
          </div>

          {/* Session pricing (Requirement 2.4) - fixed height, responsive sizing */}
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
}
