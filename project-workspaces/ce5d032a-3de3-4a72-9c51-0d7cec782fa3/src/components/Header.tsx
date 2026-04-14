import React from 'react';
import { Bell, Search } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Analytics Dashboard</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search..."
            className="pl-10 pr-4 py-2 rounded-lg bg-slate-800 text-slate-100 placeholder-slate-400 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>
        <button className="p-2 rounded-full hover:bg-slate-800 transition-colors duration-200">
          <Bell className="w-6 h-6 text-slate-300" />
        </button>
        <div className="w-9 h-9 rounded-full bg-violet-600 flex items-center justify-center text-white font-semibold">JD</div>
      </div>
    </header>
  );
};

export default Header;
