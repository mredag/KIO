import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: string;
  action: () => void;
  keywords: string[];
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const commands: CommandItem[] = [
    { id: 'mc-dash', label: 'MC Dashboard', icon: '🎛️', action: () => navigate('/admin/mc'), keywords: ['dashboard', 'kontrol', 'genel'] },
    { id: 'mc-workshop', label: 'Workshop', icon: '📋', action: () => navigate('/admin/mc/workshop'), keywords: ['workshop', 'kanban', 'is', 'job', 'kuyruk'] },
    { id: 'mc-agents', label: 'Ajanlar', icon: '🤖', action: () => navigate('/admin/mc/agents'), keywords: ['agent', 'ajan', 'model', 'ai'] },
    { id: 'mc-conversations', label: 'Kanallar', icon: '💬', action: () => navigate('/admin/mc/conversations'), keywords: ['conversation', 'kanal', 'mesaj', 'chat'] },
    { id: 'mc-documents', label: 'Dokumanlar', icon: '📄', action: () => navigate('/admin/mc/documents'), keywords: ['document', 'dokuman', 'vector', 'arama'] },
    { id: 'mc-costs', label: 'API Kullanimi', icon: '💰', action: () => navigate('/admin/mc/costs'), keywords: ['cost', 'maliyet', 'token', 'api', 'fiyat'] },
    { id: 'mc-jarvis', label: 'Jarvis', icon: '🧪', action: () => navigate('/admin/mc/jarvis'), keywords: ['jarvis', 'task', 'gorev', 'plan'] },
    { id: 'mc-policies', label: 'Politikalar', icon: '🛡️', action: () => navigate('/admin/mc/policies'), keywords: ['policy', 'politika', 'kural', 'guardrail'] },
    { id: 'admin-dash', label: 'Admin Panel', icon: '🏠', action: () => navigate('/admin'), keywords: ['admin', 'panel', 'ana'] },
    { id: 'admin-kb', label: 'Bilgi Bankasi', icon: '📚', action: () => navigate('/admin/knowledge-base'), keywords: ['knowledge', 'bilgi', 'kb'] },
    { id: 'admin-interactions', label: 'Etkilesimler', icon: '📊', action: () => navigate('/admin/interactions'), keywords: ['interaction', 'etkilesim', 'instagram', 'whatsapp'] },
    { id: 'admin-workflow', label: 'Workflow Test', icon: '🔬', action: () => navigate('/admin/workflow-test'), keywords: ['workflow', 'test', 'simulate'] },
    { id: 'admin-coupons', label: 'Kupon Yonetimi', icon: '🎫', action: () => navigate('/admin/coupons/issue'), keywords: ['coupon', 'kupon', 'token'] },
    { id: 'admin-services', label: 'Hizmetler', icon: '💆', action: () => navigate('/admin/services'), keywords: ['service', 'hizmet', 'masaj'] },
  ];

  const filtered = query.trim()
    ? commands.filter(cmd => {
        const q = query.toLowerCase();
        return cmd.label.toLowerCase().includes(q)
          || cmd.keywords.some(k => k.includes(q))
          || (cmd.description || '').toLowerCase().includes(q);
      })
    : commands;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
      setQuery('');
      setSelectedIndex(0);
    }
    if (e.key === 'Escape' && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      filtered[selectedIndex].action();
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div className="relative w-full max-w-lg mx-4 mc-glass rounded-xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Sayfa ara... (Ctrl+K)"
            className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none text-sm"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-gray-400 bg-gray-800/50 rounded border border-gray-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">Sonuc bulunamadi</p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                onClick={() => { cmd.action(); setIsOpen(false); }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                  i === selectedIndex
                    ? 'bg-sky-500/20 text-sky-300'
                    : 'text-gray-300 hover:bg-white/5'
                }`}
              >
                <span className="text-base shrink-0">{cmd.icon}</span>
                <span className="flex-1 truncate">{cmd.label}</span>
                {i === selectedIndex && (
                  <kbd className="text-[10px] font-mono text-gray-500">Enter</kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/10 text-[10px] text-gray-500">
          <span>↑↓ gezin</span>
          <span>Enter sec</span>
          <span>Esc kapat</span>
        </div>
      </div>
    </div>
  );
}
