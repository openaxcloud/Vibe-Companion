import React from 'react';
import { Home, User, MessageSquare, Settings } from 'lucide-react';

const navItems = [
  { label: 'Home', icon: Home, active: true },
  { label: 'Discussions', icon: MessageSquare },
  { label: 'Profile', icon: User },
  { label: 'Settings', icon: Settings },
];

export default function Sidebar() {
  return (
    <nav className="w-72 p-6 bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col">
      {navItems.map(({ label, icon: Icon, active }) => (
        <a
          key={label}
          href="#"
          className={`flex items-center space-x-3 px-4 py-3 rounded-lg mb-1 cursor-pointer
            transition-all duration-200 hover:bg-primary-600 hover:shadow-glow
            ${active ? 'bg-primary-600 shadow-glow font-semibold text-white' : 'text-slate-400'}`}
        >
          <Icon className="w-6 h-6" />
          <span>{label}</span>
        </a>
      ))}
    </nav>
  );
}
