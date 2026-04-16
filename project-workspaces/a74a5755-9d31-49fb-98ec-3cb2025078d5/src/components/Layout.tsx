import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  FileText,
  Rss,
} from "lucide-react";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { pathname } = useLocation();

  function isActive(path: string) {
    return pathname === path;
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-tr from-slate-950 via-slate-900 to-slate-950">
      <aside
        className={`transform transition-transform duration-300 ease-in-out bg-white/5 backdrop-blur-xl border border-white/10 shadow-glow shadow-indigo-900 w-64 p-6 flex flex-col gap-6 " +
          (sidebarOpen ? "translate-x-0" : "-translate-x-full")`}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-indigo-400">My Blog</h1>
          <button
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-indigo-400 hover:text-indigo-300 transition-transform active:scale-95"
          >
            {sidebarOpen ? "<" : ">"}
          </button>
        </div>

        <nav className="flex flex-col gap-2">
          <Link
            to="/"
            className={`group flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-indigo-600 hover:text-white ${
              isActive("/") ? "bg-indigo-700 text-white" : "text-indigo-300"
            }`}
          >
            <HomeIcon className="w-5 h-5 mr-2" /> Home
          </Link>

          <Link
            to="/rss.xml"
            className={`group flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 hover:bg-indigo-600 hover:text-white ${
              isActive("/rss.xml") ? "bg-indigo-700 text-white" : "text-indigo-300"
            }`}
          >
            <Rss className="w-5 h-5 mr-2" /> RSS Feed
          </Link>
        </nav>

        <footer className="mt-auto text-xs text-indigo-400">© 2026 My Blog</footer>
      </aside>

      <main className="flex-grow p-8 max-w-7xl mx-auto w-full">{children}</main>
    </div>
  );
}
