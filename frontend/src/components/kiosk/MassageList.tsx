import { useTranslation } from 'react-i18next';
import { Massage } from '../../types';

interface MassageListProps {
  massages: Massage[];
  selectedMassageId: string | null;
  onSelectMassage: (massage: Massage) => void;
}

export default function MassageList({
  massages,
  selectedMassageId,
  onSelectMassage,
}: MassageListProps) {
  const { t } = useTranslation('kiosk');
  
  // Separate featured and regular massages (Requirement 2.2)
  const featuredMassages = massages.filter((m) => m.isFeatured);
  const regularMassages = massages.filter((m) => !m.isFeatured);

  return (
    <div className="h-full w-1/4 bg-gray-900 overflow-y-auto p-4">
      {/* Featured massages section (Requirement 2.2) */}
      {featuredMassages.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3">
            {t('menu.featured')}
          </h3>
          <div className="space-y-3">
            {featuredMassages.map((massage) => (
              <MassageCard
                key={massage.id}
                massage={massage}
                isSelected={selectedMassageId === massage.id}
                onSelect={onSelectMassage}
              />
            ))}
          </div>
        </div>
      )}

      {/* Regular massages section */}
      {regularMassages.length > 0 && (
        <div>
          {featuredMassages.length > 0 && (
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {t('menu.regular')}
            </h3>
          )}
          <div className="space-y-3">
            {regularMassages.map((massage) => (
              <MassageCard
                key={massage.id}
                massage={massage}
                isSelected={selectedMassageId === massage.id}
                onSelect={onSelectMassage}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface MassageCardProps {
  massage: Massage;
  isSelected: boolean;
  onSelect: (massage: Massage) => void;
}

// Massage card component (Requirement 2.7)
function MassageCard({ massage, isSelected, onSelect }: MassageCardProps) {
  const { t } = useTranslation('kiosk');
  
  return (
    <button
      onClick={() => onSelect(massage)}
      aria-label={t('aria.selectMassage', { name: massage.name })}
      aria-pressed={isSelected}
      className={`
        w-full text-left p-4 rounded-lg transition-all duration-200
        ${
          isSelected
            ? 'bg-blue-600 shadow-lg'
            : 'bg-gray-800 hover:bg-gray-700'
        }
      `}
    >
      {/* Massage name (Requirement 2.7) */}
      <h4 className="text-lg font-semibold text-white mb-2">
        {massage.name}
      </h4>

      {/* Short description (Requirement 2.7) */}
      <p className="text-sm text-gray-300 mb-3 line-clamp-2">
        {massage.shortDescription}
      </p>

      {/* Purpose tags as chips (Requirement 2.7) */}
      {massage.purposeTags && massage.purposeTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {massage.purposeTags.map((tag) => (
            <span
              key={tag}
              className="inline-block px-2 py-1 text-xs font-medium bg-gray-700 text-gray-200 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
