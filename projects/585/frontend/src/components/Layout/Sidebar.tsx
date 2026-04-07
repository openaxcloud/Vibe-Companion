import React, { useCallback, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";

type Channel = {
  id: string;
  name: string;
  unreadCount?: number;
  isMuted?: boolean;
};

type DirectMessage = {
  id: string;
  name: string;
  avatarUrl?: string;
  isOnline?: boolean;
  unreadCount?: number;
};

type Workspace = {
  id: string;
  name: string;
  slug: string;
};

type SidebarProps = {
  workspace: Workspace;
  channels: Channel[];
  directMessages: DirectMessage[];
  onCreateChannel?: () => void;
  onOpenDirectMessage?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  activeChannelId?: string;
  activeDmId?: string;
};

const Sidebar: React.FC<SidebarProps> = ({
  workspace,
  channels,
  directMessages,
  onCreateChannel,
  onOpenDirectMessage,
  collapsed = false,
  onToggleCollapse,
  activeChannelId,
  activeDmId,
}) => {
  const location = useLocation();
  const [isChannelsExpanded, setIsChannelsExpanded] = useState<boolean>(true);
  const [isDmsExpanded, setIsDmsExpanded] = useState<boolean>(true);

  const totalUnread = useMemo(() => {
    const channelUnread = channels.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    const dmUnread = directMessages.reduce((sum, d) => sum + (d.unreadCount || 0), 0);
    return channelUnread + dmUnread;
  }, [channels, directMessages]);

  const handleToggleChannels = useCallback(() => {
    setIsChannelsExpanded((prev) => !prev);
  }, []);

  const handleToggleDms = useCallback(() => {
    setIsDmsExpanded((prev) => !prev);
  }, []);

  const handleToggleCollapse = useCallback(() => {
    if (onToggleCollapse) {
      onToggleCollapse();
    }
  }, [onToggleCollapse]);

  const renderUnreadBadge = (count?: number) => {
    if (!count || count <= 0) return null;
    return (
      <span className="ml-auto inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        {count > 99 ? "99+" : count}
      </span>
    );
  };

  const isRouteActive = useCallback(
    (path: string) => {
      return location.pathname.startsWith(path);
    },
    [location.pathname]
  );

  return (
    <aside
      className={`flex h-full flex-col border-r border-gray-200 bg-white text-gray-900 transition-all duration-200 undefined`}
    >
      {/* Workspace Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 overflow-hidden text-left"
          title={workspace.name}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-sm font-semibold text-white">
            {workspace.name.charAt(0).toUpperCase()}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{workspace.name}</div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span className="truncate">@{workspace.slug}</span>
                {totalUnread > 0 && (
                  <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                    {totalUnread > 99 ? "99+" : totalUnread} new
                  </span>
                )}
              </div>
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={handleToggleCollapse}
          className="ml-1 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span className="sr-only">{collapsed ? "Expand" : "Collapse"}</span>
          <svg
            className={`h-4 w-4 transform transition-transform undefined`}
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M12.293 15.707a1 1 0 010-1.414L14.586 12H4a1 1 0 110-2h10.586l-2.293-2.293A1 1 0 1113.707 6.293l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Channels Section */}
        <div className="mt-2">
          <button
            type="button"
            onClick={handleToggleChannels}
            className="flex w-full items-center px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
          >
            <svg
              className={`mr-1.5 h-3 w-3 transform transition-transform undefined`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M6.293 4.293a1 1 0 011.414 0L14 10.586 12.586 12 7 6.414 1.414 12 0 10.586l6.293-6.293z"
                clipRule="evenodd"
              />
            </svg>
            {!collapsed && <span className="flex-1 truncate">Channels</span>}
            {!collapsed && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onCreateChannel) onCreateChannel();
                }}
                className="ml-auto inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Create new channel"
              >
                <svg
                  className="h-3 w-3"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </button>
          {isChannelsExpanded && (
            <nav className="mt-1 space-y-0.5 text-sm">
              {channels.length === 0 && !collapsed ? (
                <div className="px-3 py-1.5 text-xs text-gray-400">
                  No channels yet.{" "}
                  <button
                    type="button"
                    onClick={onCreateChannel}
                    className="font-medium text-indigo-600 hover:underline"
                  >
                    Create one
                  </button>
                  .
                </div>
              ) : (
                channels.map((channel) => {
                  const active = activeChannelId === channel.id;
                  return (
                    <Link
                      key={channel.id}
                      to={`/workspace/undefined/channel/undefined`}
                      className={`group flex items-center px-3 py-1.5 undefined/channel/undefined`)
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`mr-2 flex h-5 w-5 items-center justify-center rounded undefined`}
                      >
                        #
                      </span>
                      {!collapsed && (
                        <>
                          <span className="flex-1 truncate">{channel.name}</span>
                          {channel.isMuted && (
                            <svg