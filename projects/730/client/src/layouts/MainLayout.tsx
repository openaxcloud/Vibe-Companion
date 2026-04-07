import React, { ReactNode } from "react";
import { Outlet } from "react-router-dom";

type MainLayoutProps = {
  children?: ReactNode;
};

type HeaderProps = {
  title?: string;
};

type FooterProps = {
  copyrightLabel?: string;
};

type Notification = {
  id: string | number;
  message: string;
  type?: "info" | "success" | "warning" | "error";
};

type GlobalNotificationsProps = {
  notifications?: Notification[];
};

const Header: React.FC<HeaderProps> = ({ title = "My App" }) => {
  return (
    <header className="w-full border-b border-neutral-200 bg-white/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white dark:bg-blue-500">
            {title.charAt(0)}
          </div>
          <span className="text-base font-semibold text-neutral-900 dark:text-neutral-50">
            {title}
          </span>
        </div>
        <nav className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-300">
          <a
            href="/"
            className="rounded px-2 py-1 transition hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50"
          >
            Home
          </a>
        </nav>
      </div>
    </header>
  );
};

const Footer: React.FC<FooterProps> = ({ copyrightLabel = "My Company" }) => {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-8 border-t border-neutral-200 bg-white/60 py-4 text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-950/60 dark:text-neutral-400">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 sm:flex-row sm:px-6 lg:px-8">
        <span>
          © {year} {copyrightLabel}. All rights reserved.
        </span>
        <span className="flex gap-3">
          <a
            href="/privacy"
            className="hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Privacy
          </a>
          <a
            href="/terms"
            className="hover:text-neutral-700 dark:hover:text-neutral-200"
          >
            Terms
          </a>
        </span>
      </div>
    </footer>
  );
};

const GlobalNotifications: React.FC<GlobalNotificationsProps> = ({
  notifications = [],
}) => {
  if (!notifications.length) return null;

  const getBgClass = (type?: Notification["type"]) => {
    switch (type) {
      case "success":
        return "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-100 dark:border-emerald-900";
      case "warning":
        return "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:border-amber-900";
      case "error":
        return "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950 dark:text-rose-100 dark:border-rose-900";
      case "info":
      default:
        return "bg-sky-50 text-sky-900 border-sky-200 dark:bg-sky-950 dark:text-sky-100 dark:border-sky-900";
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-col items-center gap-2 px-4 pt-3 sm:pt-4">
      {notifications.map((n) => (
        <div
          key={n.id}
          className={`pointer-events-auto w-full max-w-lg rounded-md border px-4 py-3 text-sm shadow-sm undefined`}
        >
          {n.message}
        </div>
      ))}
    </div>
  );
};

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const mockNotifications: Notification[] = [];

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 antialiased transition-colors duration-200 dark:bg-neutral-950 dark:text-neutral-50">
      <GlobalNotifications notifications={mockNotifications} />
      <div className="flex min-h-screen flex-col">
        <Header />

        <main className="flex-1">
          <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
            {children ?? <Outlet />}
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
};

export default MainLayout;