import React, { useCallback, useMemo } from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";

type WorkspaceLayoutProps = {
  workspaceName?: string;
  userDisplayName?: string;
  userAvatarUrl?: string;
  onSignOut?: () => void;
};

type NavItem = {
  id: string;
  label: string;
  href: string;
  type: "channel" | "dm" | "section";
  icon?: React.ReactNode;
};

const MOCK_CHANNELS: NavItem[] = [
  { id: "c-general", label: "general", href: "/channels/general", type: "channel" },
  { id: "c-random", label: "random", href: "/channels/random", type: "channel" },
  { id: "c-team", label: "team-updates", href: "/channels/team-updates", type: "channel" },
];

const MOCK_DMS: NavItem[] = [
  { id: "d-alex", label: "Alex Doe", href: "/dm/alex", type: "dm" },
  { id: "d-jane", label: "Jane Smith", href: "/dm/jane", type: "dm" },
];

const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  workspaceName = "Acme Workspace",
  userDisplayName = "John Doe",
  userAvatarUrl,
  onSignOut,
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = useCallback(
    (href: string) => {
      if (!location.pathname) return false;
      if (href === "/") return location.pathname === "/";
      return location.pathname.startsWith(href);
    },
    [location.pathname]
  );

  const handleNavClick = useCallback(
    (href: string) => {
      navigate(href);
    },
    [navigate]
  );

  const handleSignOut = useCallback(() => {
    if (onSignOut) {
      onSignOut();
    } else {
      // Fallback no-op or navigation; intentionally left minimal for integration
      navigate("/signin");
    }
  }, [navigate, onSignOut]);

  const initials = useMemo(() => {
    if (userAvatarUrl) return "";
    const parts = userDisplayName.trim().split(" ");
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }, [userAvatarUrl, userDisplayName]);

  return (
    <div className="flex h-screen w-screen bg-slate-900 text-slate-100">
      {/* Left sidebar */}
      <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur">
        {/* Workspace header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-slate-50 truncate">
              {workspaceName}
            </span>
            <span className="text-xs text-slate-400">Workspace</span>
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 items-center justify-center rounded bg-slate-800 text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Workspace options"
          >
            <span className="text-lg leading-none">⋮</span>
          </button>
        </div>

        {/* Primary nav */}
        <div className="flex-1 overflow-y-auto">
          <nav className="px-2 py-3 space-y-3 text-sm">
            {/* Channels section */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-slate-200"
                >
                  <span className="text-slate-400">Channels</span>
                </button>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700"
                  aria-label="Add channel"
                >
                  <span className="text-base leading-none">+</span>
                </button>
              </div>
              <ul className="space-y-0.5">
                {MOCK_CHANNELS.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleNavClick(item.href)}
                        className={`group flex w-full items-center rounded px-2 py-1.5 text-left text-[13px] transition undefined`}
                      >
                        <span className="mr-2 text-base text-slate-400 group-hover:text-slate-300">
                          #
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Direct messages section */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <button
                  type="button"
                  className="flex items-center gap-1 hover:text-slate-200"
                >
                  <span className="text-slate-400">Direct messages</span>
                </button>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-400 hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700"
                  aria-label="New direct message"
                >
                  <span className="text-base leading-none">+</span>
                </button>
              </div>
              <ul className="space-y-0.5">
                {MOCK_DMS.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleNavClick(item.href)}
                        className={`group flex w-full items-center rounded px-2 py-1.5 text-left text-[13px] transition undefined`}
                      >
                        <div className="mr-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[10px] font-semibold text-slate-200">
                          {item.label.charAt(0).toUpperCase()}
                        </div>
                        <span className="flex-1 truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        </div>

        {/* User footer */}
        <div className="border-t border-slate-800 px-3 py-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="flex items-center gap-2 rounded px-1 py-1 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white overflow-hidden">
                {userAvatarUrl ? (
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials
                )}
              </div>
              <div className="flex flex-col items-start">
                <span className="max-w-[110px] truncate text-xs font-medium text-slate-100">
                  {userDisplayName}
                </span>
                <span className="text-[11px] text-emerald-400">● Active</span>
              </div>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="inline-flex items-center justify-center rounded px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-900 hover:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex