import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LucideHome, LucideFileText, LucideRss } from 'lucide-react';

const navItems = [
  { to: '/', label: 'Home', icon: LucideHome },
  { to: '/rss.xml', label: 'RSS Feed', icon: LucideRss },
];

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();

  return (
    <div className="flex min-h-screen">
      <aside
        className={`
          flex flex-col bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg
          transition-all duration-200 ease-in-out
          ${sidebarOpen ? 'w-64' : 'w-16'}
        `}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <Link to="/" className="text-primary-400 font-bold text-2xl">
            SynBlog
          </Link>
          <button
            aria-label="Toggle sidebar"
            className="text-primary-400 hover:text-primary-300 transition"
            onClick={() => setSidebarOpen(open => !open)}
          >
            {sidebarOpen ? '<' : '>'}
          </button>
        </div>
        <nav className="flex flex-col flex-1 px-2 py-4 space-y-2">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname === to;
            return (
              <Link
                key={to}
                to={to}
                className={`
                  flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                  hover:bg-primary-700/30 focus:bg-primary-700/30
                  ${active ? 'bg-primary-500 text-white' : 'text-primary-300'}
                `}
              >
                <Icon className="w-5 h-5" />
                {sidebarOpen && label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 flex flex-col overflow-auto">{children}</div>
    </div>
  );
};

export default Layout;
