import React from 'react';
import { User2, Menu } from 'lucide-react';

export default function Header({ user }) {
  return (
    <header className="flex items-center justify-between px-8 py-4 bg-gradient-to-r from-primary-700 to-primary-500 shadow-glow">
      <div className="flex items-center space-x-3">
        <Menu className="w-6 h-6 text-white cursor-pointer hover:text-primary-300 transition-all" />
        <h1 className="text-3xl font-extrabold tracking-tight select-none">Community Forum</h1>
      </div>
      <div className="flex items-center space-x-3">
        <img src={user.avatar} alt={user.name} title={user.name} className="w-10 h-10 rounded-full border-2 border-white/30 shadow-glow" />
        <span className="font-semibold text-lg">{user.name}</span>
      </div>
    </header>
  );
}
