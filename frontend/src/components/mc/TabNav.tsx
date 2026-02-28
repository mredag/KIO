interface Tab {
  key: string;
  label: string;
  icon?: string;
}

interface TabNavProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

export function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  return (
    <nav className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.key)}
            className={`
              px-4 py-2.5 text-sm font-medium transition-colors duration-200
              relative -mb-px
              ${isActive
                ? 'text-sky-600 dark:text-sky-400'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }
            `}
          >
            {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
            {tab.label}
            {isActive && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 dark:bg-sky-400 rounded-t" />
            )}
          </button>
        );
      })}
    </nav>
  );
}
