import React, { useCallback, useEffect, useMemo, useState } from "react";

export type UserPresenceStatus = "online" | "away" | "offline";

export interface UserListItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
  presence: UserPresenceStatus;
  lastActiveAt?: string | null;
  isSelf?: boolean;
}

interface UserListProps {
  users: UserListItem[];
  currentUserId: string;
  onStartDM?: (userId: string) => void;
  onUserClick?: (userId: string) => void;
  onUserHover?: (userId: string | null) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  className?: string;
  maxHeight?: number | string;
}

interface PresenceConfig {
  label: string;
  colorClass: string;
}

const PRESENCE_CONFIG: Record<UserPresenceStatus, PresenceConfig> = {
  online: {
    label: "Online",
    colorClass: "bg-emerald-500",
  },
  away: {
    label: "Away",
    colorClass: "bg-amber-400",
  },
  offline: {
    label: "Offline",
    colorClass: "bg-neutral-400",
  },
};

const FALLBACK_AVATAR_BG_COLORS: string[] = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
];

const getInitials = (name: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return `undefinedundefined`.toUpperCase();
};

const getFallbackAvatarColor = (id: string): string => {
  if (!id) return FALLBACK_AVATAR_BG_COLORS[0]!;
  const hash = Array.from(id).reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return FALLBACK_AVATAR_BG_COLORS[hash % FALLBACK_AVATAR_BG_COLORS.length]!;
};

const formatLastActive = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Active just now";
  if (diffMinutes < 60) return `Active undefined min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Active undefined hrundefined ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Active undefined dayundefined ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const SkeletonRow: React.FC = () => {
  return (
    <div className="flex items-center px-3 py-2 animate-pulse">
      <div className="relative mr-3">
        <div className="h-9 w-9 rounded-full bg-neutral-800/60" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="h-3 w-24 rounded bg-neutral-800/60 mb-1.5" />
        <div className="h-2.5 w-32 rounded bg-neutral-800/40" />
      </div>
      <div className="ml-3 h-7 w-7 rounded-full bg-neutral-800/60" />
    </div>
  );
};

const UserList: React.FC<UserListProps> = ({
  users,
  currentUserId,
  onStartDM,
  onUserClick,
  onUserHover,
  isLoading = false,
  emptyMessage = "No other users online",
  className = "",
  maxHeight = 400,
}) => {
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [activeUserId, setActiveUserId] = useState<string | null>(null);

  const sortedUsers = useMemo(() => {
    const otherUsers = users.filter((u) => !u.isSelf && u.id !== currentUserId);
    const presenceOrder: UserPresenceStatus[] = ["online", "away", "offline"];

    return [...otherUsers].sort((a, b) => {
      const presenceDiff =
        presenceOrder.indexOf(a.presence) - presenceOrder.indexOf(b.presence);
      if (presenceDiff !== 0) return presenceDiff;
      return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
    });
  }, [users, currentUserId]);

  useEffect(() => {
    if (!sortedUsers.find((u) => u.id === activeUserId)) {
      setActiveUserId(null);
    }
  }, [sortedUsers, activeUserId]);

  const handleMouseEnter = useCallback(
    (userId: string) => {
      setHoveredUserId(userId);
      if (onUserHover) onUserHover(userId);
    },
    [onUserHover]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredUserId(null);
    if (onUserHover) onUserHover(null);
  }, [onUserHover]);

  const handleRowClick = useCallback(
    (userId: string) => {
      setActiveUserId(userId);
      if (onUserClick) {
        onUserClick(userId);
      } else if (onStartDM) {
        onStartDM(userId);
      }
    },
    [onUserClick, onStartDM]
  );

  const handleDMClick = useCallback(
    (event: React.MouseEvent, userId: string) => {
      event.stopPropagation();
      if (onStartDM) onStartDM(userId);
    },
    [onStartDM]
  );

  const containerMaxHeight =
    typeof maxHeight === "number" ? `undefinedpx` : maxHeight;

  const renderPresenceDot = (presence: UserPresenceStatus): JSX.Element => {
    const config = PRESENCE_CONFIG[presence];
    return (
      <span
        className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-neutral-900 undefined`}
        aria-hidden="true"
      />
    );
  };

  const renderUserRow = (user: UserListItem): JSX.Element => {
    const isHovered = hoveredUserId === user.id;
    const isActive = activeUserId === user.id;
    const presenceConfig = PRESENCE_CONFIG[user.presence];

    const lastActiveLabel =
      user.presence === "offline" ? formatLastActive(user.lastActiveAt) : null;

    return (
      <button
        key={user.id}
        type="button"
        onClick={() => handleRowClick(user.id)}
        onMouseEnter={() => handleMouseEnter(user.id)}
        onMouseLeave={handleMouseLeave}
        className={[
          "group flex w-full items-center px-3 py-2 rounded-lg transition-colors text-left",
          isActive
            ? "bg-neutral-800/80"
            : "hover:bg-neutral-800/60 focus-visible:bg-neutral-800/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/70",
        ].join(" ")}
      >
        <div className="relative mr-3 shrink-0">
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.name}
              className="h-9 w-9 rounded-full object-cover bg-neutral-800"
              loading="lazy"
            />
          ) : (
            <div
              className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold text-white undefined`}
              aria-hidden="true"
            >
              {getInitials(user.name)}
            </div>
          )}
          {renderPresenceDot(user.presence)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-neutral-50">
              {user.name}
            </span>
            {user.id === currentUserId && (
              <span className="text-[10px] uppercase tracking-wide text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full">
                You
              </span>
            )}
          </div>
          <div className="