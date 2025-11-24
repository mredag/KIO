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
    <div className="h-full w-1/5 bg-black overflow-y-auto py-8 px-6">
      {/* Featured massages section (Requirement 2.2) */}
      {featuredMassages.length > 0 && (
        <div className="mb-8">
          <h3 className="text-xs font-medium text-orange-400 uppercase tracking-widest mb-4 opacity-70">
            {t('menu.featured')}
          </h3>
          <div className="space-y-2">
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
          <div className="space-y-2">
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
        relative w-full text-left px-5 py-4 rounded-xl transition-all duration-300
        ${
          isSelected
            ? 'bg-white bg-opacity-10 border-l-4 border-white shadow-lg'
            : 'bg-transparent hover:bg-white hover:bg-opacity-5'
        }
      `}
    >
      {/* Massage name (Requirement 2.7) */}
      <h4 className={`text-base font-medium mb-1 transition-colors pr-6 ${
        isSelected ? 'text-white' : 'text-gray-400'
      }`}>
        {massage.name}
      </h4>

      {/* Selected indicator arrow */}
      {isSelected && (
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}
    </button>
  );
}
