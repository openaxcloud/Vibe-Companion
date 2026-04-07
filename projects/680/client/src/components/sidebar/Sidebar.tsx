import React, { useCallback, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiChevronDown, FiChevronRight, FiPlus, FiHash, FiMessageCircle, FiLogOut, FiMoreHorizontal } from "react-icons/fi";
import { IconType } from "react-icons";
import clsx from "clsx";

type UserStatus = "online" | "away" | "busy" | "offline";

interface User {
  id: string;
  name: string;
  avatarUrl?: string;
  status: UserStatus;
}

interface Channel {
  id: string;
  name: string;
  isPrivate?: boolean;
  isUnread?: boolean;
}

interface DirectMessage {
  id: string;
  user: User;
  isUnread?: boolean;
}

interface SidebarProps {
  currentUser: User;
  channels: Channel[];
  directMessages: DirectMessage[];
  workspaceName: string;
  onCreateChannel?: () => void;
  onStartDM?: () => void;
  onLogout?: () => void;
  onChannelSelect?: (channelId: string) => void;
  onDMSelect?: (dmId: string) => void;
  className?: string;
}

const statusColorMap: Record<UserStatus, string> = {
  online: "bg-green-500",
  away: "bg-yellow-400",
  busy: "bg-red-500",
  offline: "bg-gray-400",
};

const statusLabelMap: Record<UserStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Do not disturb",
  offline: "Offline",
};

const SidebarSectionHeader: React.FC<{
  title: string;
  icon?: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  onAction?: () => void;
  actionIcon?: IconType;
  actionAriaLabel?: string;
}> = ({ title, icon, isCollapsed, onToggle, onAction, actionIcon: ActionIcon, actionAriaLabel }) => {
  return (
    <div className="flex items-center justify-between px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 select-none">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded-sm"
      >
        {isCollapsed ? (
          <FiChevronRight className="h-3 w-3 text-slate-500" />
        ) : (
          <FiChevronDown className="h-3 w-3 text-slate-500" />
        )}
        {icon && <span className="mr-1 text-slate-400">{icon}</span>}
        <span>{title}</span>
      </button>
      {ActionIcon && (
        <button
          type="button"
          onClick={onAction}
          aria-label={actionAriaLabel || `Add undefined`}
          className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-700/80 text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
        >
          <ActionIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};

const Avatar: React.FC<{
  user: User;
  size?: "sm" | "md";
}> = ({ user, size = "md" }) => {
  const dimension = size === "sm" ? "h-6 w-6" : "h-8 w-8";
  const textSize = size === "sm" ? "text-xs" : "text-sm";

  const initials = useMemo(() => {
    if (!user.name) return "";
    const parts = user.name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
  }, [user.name]);

  return (
    <div className="relative inline-flex">
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.name}
          className={clsx("rounded-md object-cover bg-slate-700", dimension)}
        />
      ) : (
        <div
          className={clsx(
            "flex items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-sky-500 text-white font-medium",
            dimension,
            textSize
          )}
        >
          {initials}
        </div>
      )}
      <span
        className={clsx(
          "absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-slate-900",
          statusColorMap[user.status]
        )}
      />
    </div>
  );
};

const SidebarUserSection: React.FC<{
  user: User;
  workspaceName: string;
  onLogout?: () => void;
}> = ({ user, workspaceName, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setMenuOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
  }, []);

  return (
    <div className="border-b border-slate-800/80 pb-2">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Avatar user={user} size="md" />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="truncate text-sm font-semibold text-slate-50">
                  {workspaceName}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={clsx("h-2 w-2 rounded-full", statusColorMap[user.status])} />
                <p className="truncate text-xs text-slate-400">
                  {user.name} · {statusLabelMap[user.status]}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={toggleMenu}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-800 text-slate-300 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60"
          >
            <FiMoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                aria-hidden="true"
                onClick={closeMenu}
              />
              <div className="absolute right-0 z-20 mt-1 w-40 rounded-md bg-slate-900 shadow-lg ring-1 ring-black/60">
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 rounded-t-md"
                >
                  <FiLogOut className="h-3.5 w-3.5 text-slate-400" />
                  <span>Sign out</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const SidebarListItem: React.FC<{
  label: string;
  icon?: React.ReactNode;
  href?: string;
  active?: boolean;
  unread?: boolean;
  onClick?: () => void;
}> = ({ label, icon, href, active, unread, onClick }) => {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!href) {
        e.preventDefault();
      }
      if (onClick) {
        onClick();
      }
    },
    [href, onClick]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      className={clsx(
        "group flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
        active
          ? "bg-slate-800 text-slate-50"
          : "text-slate-200 hover:bg-slate-800/70 hover:text-white"
      )}
    >
      {icon && (
        <span
          className={clsx(
            "flex h-5 w-5 items-center justify-center text-slate-400 group-hover:text-slate-200",
            active && "text-slate-200"
          )}
        >
          {icon}
        </span