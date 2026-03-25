/**
 * TabBar - Simple tab bar component for IDE tools
 * Uses a lightweight implementation compatible with our DraggableTab component
 */

interface Tab {
  id: string;
  label: string;
  icon?: any;
  closable?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  onTabClose?: (tabId: string) => void;
}

export function TabBar({ tabs, activeTab, onTabChange, onTabClose }: TabBarProps) {
  return (
    <div className="h-9 bg-[var(--ecode-surface)] border-b border-[var(--ecode-border)] flex items-center">
      {tabs.length === 1 && (
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] text-[var(--ecode-text-muted)] bg-[var(--ecode-surface)] border border-[var(--ecode-border)] rounded ml-2 mr-2 flex-shrink-0">
          <span>Tip: Multiple tabs help you work efficiently</span>
        </div>
      )}
      <div className="flex items-center gap-0 overflow-x-auto flex-1 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              group flex items-center gap-1.5 px-2.5 py-1.5 border-r border-[var(--ecode-border)]
              transition-colors text-xs font-medium min-w-[100px] max-w-[180px]
              ${
                activeTab === tab.id
                  ? 'bg-[var(--ecode-surface)] text-[var(--ecode-text)]'
                  : 'bg-transparent text-[var(--ecode-text-muted)] hover:bg-[var(--ecode-sidebar-hover)]'
              }
            `}
            data-testid={`tab-${tab.id}`}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span className="truncate flex-1">{tab.label}</span>
            {tab.closable !== false && onTabClose && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-accent rounded transition-opacity flex-shrink-0"
                data-testid={`button-close-tab-${tab.id}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
