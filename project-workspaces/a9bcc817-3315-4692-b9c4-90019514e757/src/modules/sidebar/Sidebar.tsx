import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucidePlus, LucideMessageSquare, LucideUser, LucideLogOut } from 'lucide-react';

interface NavItem {
  label: string;
  icon: React.FC<any>;
  path: string;
}

const channels: NavItem[] = [
  { label: 'General', icon: LucideMessageSquare, path: '/channel/general' },
  { label: 'Tech', icon: LucideMessageSquare, path: '/channel/tech' },
  { label: 'Random', icon: LucideMessageSquare, path: '/channel/random' },
];

const dms: NavItem[] = [
  { label: 'Alice', icon: LucideUser, path: '/dm/alice' },
  { label: 'Bob', icon: LucideUser, path: '/dm/bob' },
];

function SidebarSection({ title, items }: { title: string; items: NavItem[] }) {
  const location = useLocation();
  return (
    <div className="mt-8">
      <h3 className="px-4 text-slate-500 uppercase tracking-wider text-xs font-semibold mb-2">
        {title}
      </h3>
      <ul className="space-y-1">
        {items.map(({ label, icon: Icon, path }) => {
          const active = location.pathname.startsWith(path);
          return (
            <li key={path}>
              <Link
                to={path}
                className={`group flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-slate-800/50 hover:text-white ${
                  active ? 'bg-slate-800/60 text-white' : 'text-slate-400'
                }`}
              >
                <Icon size={18} className="shrink-0" />
                <span className="truncate flex-1">{label}</span>
              </Link>
            </li>
          );
        })}
        <li>
          <button className="flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800/50 w-full transition-colors">
            <LucidePlus size={18} />
            <span className="truncate flex-1">Add {title === 'Channels' ? 'Channel' : 'DM'}</span>
          </button>
        </li>
      </ul>
    </div>
  );
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <aside
      className={`h-full overflow-y-auto border-r border-white/10 bg-slate-950/80 backdrop-blur-xl transition-all duration-200 ease-out flex flex-col ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      <div className="flex items-center justify-between px-4 h-14 border-b border-white/5">
        <span className="font-semibold text-xl text-white">Team</span>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded hover:bg-slate-800/60 transition-colors"
        >
          {/* Icon can rotate */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`lucide lucide-chevrons-left transition-transform ${collapsed ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
          >
            <polyline points="11 17 6 12 11 7"></polyline>
            <polyline points="18 17 13 12 18 7"></polyline>
          </svg>
        </button>
      </div>

      <nav className="flex-1 px-2 py-4">
        <SidebarSection title="Channels" items={channels} />
        <SidebarSection title="Direct Messages" items={dms} />
      </nav>

      <div className="mt-auto px-4 py-4 border-t border-white/5">
        <button className="flex items-center gap-3 text-sm text-red-400 hover:text-red-300 w-full">
          <LucideLogOut size={18} /> Logout
        </button>
      </div>
    </aside>
  );
}
