import { useState, useRef, useEffect } from 'react';
import { getAvailableBrandIcons, isImageUrl, searchEmojis, getPopularEmojis } from '../../lib/surveyIcons';
import '../../styles/emoji-picker.css';

// Comprehensive emoji categories like Windows emoji picker
const EMOJI_CATEGORIES = {
  recent: {
    name: 'Son Kullanılanlar',
    icon: '🕒',
    emojis: [] as string[] // Will be populated from localStorage
  },
  popular: {
    name: 'Popüler',
    icon: '⭐',
    emojis: getPopularEmojis()
  },
  smileys: {
    name: 'Yüz İfadeleri',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
      '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'
    ]
  },
  people: {
    name: 'İnsanlar',
    icon: '👥',
    emojis: [
      '👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓',
      '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇',
      '🤦', '🤷', '👮', '🕵️', '💂', '👷', '🤴', '👸', '👳', '👲',
      '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹',
      '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆', '💇', '🚶',
      '🏃', '💃', '🕺', '🕴️', '👯', '🧖', '🧗', '🤺', '🏇', '⛷️'
    ]
  },
  activities: {
    name: 'Aktiviteler',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️',
      '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '⛹️', '🤺',
      '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵',
      '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🏵️', '🎗️', '🎫'
    ]
  },
  food: {
    name: 'Yiyecek & İçecek',
    icon: '🍎',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
      '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦',
      '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔',
      '🍠', '🥐', '🥖', '🫓', '🥨', '🥯', '🍞', '🧀', '🥚', '🍳',
      '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔',
      '🍟', '🍕', '🫔', '🌮', '🌯', '🫕', '🥙', '🧆', '🥚', '🍲'
    ]
  },
  travel: {
    name: 'Seyahat & Yerler',
    icon: '✈️',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🏍️', '🛵', '🚲', '🛴', '🛹', '🛼',
      '🚁', '🛸', '✈️', '🛩️', '🪂', '💺', '🚀', '🛰️', '🚢', '⛵',
      '🚤', '🛥️', '🛳️', '⛴️', '🚂', '🚃', '🚄', '🚅', '🚆', '🚇',
      '🚈', '🚉', '🚊', '🚝', '🚞', '🚋', '🚌', '🚍', '🎡', '🎢',
      '🎠', '🏗️', '🌁', '🗼', '🏭', '⛲', '🎡', '🎢', '🚂', '⛰️'
    ]
  },
  objects: {
    name: 'Nesneler',
    icon: '💎',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
      '🗜️', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️',
      '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋',
      '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴',
      '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️'
    ]
  },
  symbols: {
    name: 'Semboller',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
      '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
      '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳',
      '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️'
    ]
  },
  flags: {
    name: 'Bayraklar',
    icon: '🏁',
    emojis: [
      '🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇹🇷', '🇺🇸',
      '🇬🇧', '🇩🇪', '🇫🇷', '🇮🇹', '🇪🇸', '🇷🇺', '🇨🇳', '🇯🇵', '🇰🇷', '🇮🇳',
      '🇧🇷', '🇨🇦', '🇦🇺', '🇲🇽', '🇦🇷', '🇿🇦', '🇪🇬', '🇸🇦', '🇦🇪', '🇮🇱',
      '🇬🇷', '🇳🇱', '🇧🇪', '🇨🇭', '🇦🇹', '🇸🇪', '🇳🇴', '🇩🇰', '🇫🇮', '🇵🇱',
      '🇨🇿', '🇭🇺', '🇷🇴', '🇧🇬', '🇭🇷', '🇷🇸', '🇺🇦', '🇵🇹', '🇮🇪', '🇮🇸'
    ]
  }
};

interface EmojiPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  currentIcon?: string;
  position?: { top: number; left: number };
}

export default function EmojiPicker({
  isOpen,
  onClose,
  onSelect,
  currentIcon = '',
  position
}: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState<keyof typeof EMOJI_CATEGORIES>('popular');
  const [searchTerm, setSearchTerm] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);
  const pickerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  
  const brandIcons = getAvailableBrandIcons();

  // Load recent emojis from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('survey-recent-emojis');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setRecentEmojis(parsed.slice(0, 30));
        EMOJI_CATEGORIES.recent.emojis = parsed.slice(0, 30);
      } catch (e) {
        console.warn('Failed to parse recent emojis:', e);
      }
    }
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Handle emoji selection
  const handleEmojiSelect = (emoji: string) => {
    // Add to recent emojis
    const newRecent = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(0, 30);
    setRecentEmojis(newRecent);
    EMOJI_CATEGORIES.recent.emojis = newRecent;
    localStorage.setItem('survey-recent-emojis', JSON.stringify(newRecent));
    
    onSelect(emoji);
    onClose();
  };

  // Filter emojis based on search
  const getFilteredEmojis = () => {
    if (!searchTerm) {
      return EMOJI_CATEGORIES[activeCategory].emojis;
    }
    
    // Use enhanced search with keywords
    const keywordResults = searchEmojis(searchTerm);
    
    // Also search by direct emoji match
    const allEmojis = Object.values(EMOJI_CATEGORIES).flatMap(cat => cat.emojis);
    const directMatches = allEmojis.filter(emoji => emoji.includes(searchTerm));
    
    // Combine and deduplicate results
    const combined = [...new Set([...keywordResults, ...directMatches])];
    
    return combined.length > 0 ? combined : [];
  };

  if (!isOpen) return null;

  const filteredEmojis = getFilteredEmojis();

  return (
    <div 
      ref={pickerRef}
      className="emoji-picker fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
      style={{
        top: position?.top || '50%',
        left: position?.left || '50%',
        transform: position ? 'none' : 'translate(-50%, -50%)',
        width: '400px',
        maxWidth: 'calc(100vw - 40px)',
        height: '500px',
        maxHeight: 'calc(100vh - 40px)'
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">İkon Seç</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          ✕
        </button>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Emoji ara..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="emoji-picker__search-input w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Categories */}
      {!searchTerm && (
        <div className="flex overflow-x-auto border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
          {Object.entries(EMOJI_CATEGORIES).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setActiveCategory(key as keyof typeof EMOJI_CATEGORIES)}
              className={`emoji-picker__category-tab flex-shrink-0 px-3 py-2 text-lg hover:bg-gray-100 dark:hover:bg-gray-700 ${
                activeCategory === key ? 'emoji-picker__category-tab--active bg-blue-100 dark:bg-blue-900' : ''
              }`}
              title={category.name}
            >
              {category.icon}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="emoji-picker__grid flex-1 overflow-y-auto p-3">
        {/* Current selection indicator */}
        {currentIcon && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Mevcut seçim:</div>
            <div className="flex items-center gap-2">
              {isImageUrl(currentIcon) ? (
                <img src={currentIcon} alt="" className="w-6 h-6 object-contain" />
              ) : (
                <span className="text-xl">{currentIcon}</span>
              )}
              <button
                onClick={() => handleEmojiSelect('')}
                className="text-xs text-red-600 hover:text-red-800 dark:text-red-400"
              >
                Temizle
              </button>
            </div>
          </div>
        )}

        {/* Brand Icons Section */}
        {(activeCategory === 'popular' || searchTerm) && (
          <div className="mb-4">
            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Marka İkonları</div>
            <div className="grid grid-cols-8 gap-1">
              {brandIcons.map(({ key, label, url }) => (
                <button
                  key={key}
                  onClick={() => handleEmojiSelect(key)}
                  className={`w-10 h-10 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    currentIcon === key || currentIcon === url ? 'bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : ''
                  }`}
                  title={label}
                >
                  <img src={url} alt={label} className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Emoji Grid */}
        <div className="grid grid-cols-8 gap-1">
          {filteredEmojis.map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => handleEmojiSelect(emoji)}
              className={`emoji-picker__emoji-button w-10 h-10 text-xl rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${
                currentIcon === emoji ? 'emoji-picker__emoji-button--selected bg-blue-100 dark:bg-blue-900 ring-2 ring-blue-500' : ''
              }`}
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* No results */}
        {filteredEmojis.length === 0 && searchTerm && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <div className="text-4xl mb-2">🔍</div>
            <div>Sonuç bulunamadı</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-750">
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
          {searchTerm ? `${filteredEmojis.length} sonuç` : EMOJI_CATEGORIES[activeCategory].name}
        </div>
      </div>
    </div>
  );
}
