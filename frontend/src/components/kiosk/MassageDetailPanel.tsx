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
    <div className="h-full w-3/4 bg-gray-950 overflow-y-auto">
      <div 
        id="massage-detail-content" 
        className="h-full fade-transition" 
        style={{ opacity: 1 }}
      >
        {/* Media section - top half */}
        <div className="h-1/2 bg-black relative">
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
                  className="w-full h-full object-contain"
                  onError={() => setMediaError(true)}
                />
              )}
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
        </div>

        {/* Details section - bottom half */}
        <div className="h-1/2 p-8 overflow-y-auto">
          {/* Massage name (Requirement 2.4) */}
          <h2 className="text-4xl font-bold text-white mb-4">
            {displayedMassage.name}
          </h2>

          {/* Duration (Requirement 2.4) */}
          {displayedMassage.duration && (
            <div className="flex items-center gap-2 text-gray-400 mb-4">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-lg">{displayedMassage.duration}</span>
            </div>
          )}

          {/* Purpose tags (Requirement 2.4) */}
          {displayedMassage.purposeTags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {displayedMassage.purposeTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Long description (Requirement 2.4) */}
          <p className="text-lg text-gray-300 leading-relaxed mb-6">
            {displayedMassage.longDescription}
          </p>

          {/* Session pricing (Requirement 2.4) */}
          {displayedMassage.sessions.length > 0 && (
            <div className="mt-8">
              <h3 className="text-2xl font-semibold text-white mb-4">
                {t('menu.pricing')}
              </h3>
              <div className="space-y-3">
                {displayedMassage.sessions.map((session, index) => (
                  <div
                    key={index}
                    className="flex justify-between items-center bg-gray-800 p-4 rounded-lg"
                  >
                    <span className="text-lg text-gray-200">
                      {session.name}
                    </span>
                    <span className="text-xl font-semibold text-white">
                      {formatCurrency(session.price)}
                    </span>
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
