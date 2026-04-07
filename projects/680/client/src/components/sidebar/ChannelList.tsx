import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FiHash, FiPlus, FiChevronDown, FiChevronRight } from "react-icons/fi";
import classNames from "classnames";

export type ChannelType = "text" | "voice";

export interface Channel {
  id: string;
  name: string;
  type: ChannelType;
  createdAt: string | Date;
  lastMessageAt?: string | Date | null;
  // readReceipts[channelId] = ISO timestamp of last read
  // passed separately via props
}

export interface ChannelReadReceipts {
  [channelId: string]: string | Date | undefined;
}

interface ChannelListProps {
  channels: Channel[];
  activeChannelId?: string | null;
  readReceipts?: ChannelReadReceipts;
  isLoading?: boolean;
  canCreateChannel?: boolean;
  headerTitle?: string;
  onChannelSelect?: (channelId: string) => void;
  onCreateChannel?: () => void;
  /**
   * Optional filter: e.g. only "text"
   */
  channelTypeFilter?: ChannelType | "all";
  /**
   * Optional className for root container
   */
  className?: string;
  /**
   * Optional: show only channels where user is a member (handled upstream)
   */
  emptyStateMessage?: string;
}

interface ChannelListItemProps {
  channel: Channel;
  isActive: boolean;
  hasUnread: boolean;
  onClick: () => void;
}

const formatDate = (value?: string | Date | null): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const hasUnreadMessages = (
  channel: Channel,
  readReceipts?: ChannelReadReceipts
): boolean => {
  if (!readReceipts) return false;
  const lastReadRaw = readReceipts[channel.id];
  if (!lastReadRaw) return !!channel.lastMessageAt;

  const lastRead = formatDate(lastReadRaw);
  const lastMessage = formatDate(channel.lastMessageAt);

  if (!lastMessage) return false;
  if (!lastRead) return true;

  return lastMessage.getTime() > lastRead.getTime();
};

const sortChannelsByActivity = (channels: Channel[]): Channel[] => {
  return [...channels].sort((a, b) => {
    const aDate = formatDate(a.lastMessageAt) ?? formatDate(a.createdAt);
    const bDate = formatDate(b.lastMessageAt) ?? formatDate(b.createdAt);
    if (!aDate && !bDate) return 0;
    if (!aDate) return 1;
    if (!bDate) return -1;
    return bDate.getTime() - aDate.getTime();
  });
};

const ChannelListItem: React.FC<ChannelListItemProps> = ({
  channel,
  isActive,
  hasUnread,
  onClick,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors rounded-md",
        isActive
          ? "bg-slate-800 text-white"
          : "text-slate-200 hover:bg-slate-800/70",
      )}
    >
      <span
        className={classNames(
          "flex-shrink-0 flex items-center justify-center rounded-sm",
        )}
      >
        <FiHash
          className={classNames(
            "h-4 w-4",
            hasUnread && !isActive ? "text-emerald-400" : "text-slate-400",
          )}
        />
      </span>
      <span className="flex-1 truncate">{channel.name}</span>
      {hasUnread && (
        <span className="ml-1 inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" />
      )}
    </button>
  );
};

const ChannelList: React.FC<ChannelListProps> = ({
  channels,
  activeChannelId,
  readReceipts,
  isLoading = false,
  canCreateChannel = true,
  headerTitle = "Channels",
  onChannelSelect,
  onCreateChannel,
  channelTypeFilter = "all",
  className,
  emptyStateMessage = "No channels yet. Create one to get started.",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const filteredChannels = useMemo(() => {
    let list = channels;
    if (channelTypeFilter !== "all") {
      list = list.filter((c) => c.type === channelTypeFilter);
    }
    return sortChannelsByActivity(list);
  }, [channels, channelTypeFilter]);

  const totalUnread = useMemo(
    () =>
      filteredChannels.reduce(
        (acc, ch) => (hasUnreadMessages(ch, readReceipts) ? acc + 1 : acc),
        0,
      ),
    [filteredChannels, readReceipts],
  );

  const handleSelectChannel = useCallback(
    (channelId: string) => {
      if (onChannelSelect) {
        onChannelSelect(channelId);
      } else {
        const search = location.search;
        navigate(`/channels/undefinedundefined`);
      }
    },
    [location.search, navigate, onChannelSelect],
  );

  useEffect(() => {
    if (!activeChannelId && filteredChannels.length > 0) {
      handleSelectChannel(filteredChannels[0].id);
    }
  }, [activeChannelId, filteredChannels, handleSelectChannel]);

  const handleCreateClick = useCallback(() => {
    if (onCreateChannel) {
      onCreateChannel();
    }
  }, [onCreateChannel]);

  return (
    <div
      className={classNames(
        "flex flex-col gap-1 text-slate-100",
        className,
      )}
    >
      <div className="flex items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        <button
          type="button"
          onClick={() => setIsCollapsed((v) => !v)}
          className="flex items-center gap-1 hover:text-slate-200"
        >
          {isCollapsed ? (
            <FiChevronRight className="h-3 w-3" />
          ) : (
            <FiChevronDown className="h-3 w-3" />
          )}
          <span>{headerTitle}</span>
          {totalUnread > 0 && (
            <span className="ml-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              {totalUnread}
            </span>
          )}
        </button>
        {canCreateChannel && (
          <button
            type="button"
            onClick={handleCreateClick}
            className="flex h-5 w-5 items-center justify-center rounded hover:bg-slate-800 text-slate-300 hover:text-white"
            aria-label="Create channel"
          >
            <FiPlus className="h-3 w-3" />
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div className="flex flex-col gap-0.5 px-2 pb-2">
          {isLoading && (
            <div className="px-2 py-1 text-xs text-slate-400">
              Loading channels...
            </div>
          )}
          {!isLoading && filteredChannels.length === 0 && (
            <div className="px-2 py-1 text-xs text-slate-500">
              {emptyStateMessage}
            </div>
          )}
          {!isLoading &&
            filteredChannels.map((channel) => (
              <ChannelListItem
                key={channel.id}
                channel={channel}
                isActive={channel.id === activeChannelId}
                hasUnread={hasUnreadMessages(channel, readReceipts)}
                onClick={() => handleSelectChannel(channel.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
};

export default ChannelList;