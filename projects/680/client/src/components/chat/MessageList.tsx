import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  UIEvent,
} from "react";
import { format } from "date-fns";

export interface User {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  reactedByCurrentUser?: boolean;
}

export interface Message {
  id: string;
  channelId?: string;
  dmId?: string;
  sender: User;
  content: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  isEdited?: boolean;
  reactions?: ReactionSummary[];
  threadReplyCount?: number;
  isSystemMessage?: boolean;
}

export type MessageListMode = "channel" | "dm";

export interface MessageListProps {
  mode: MessageListMode;
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  currentUserId?: string;
  pageSize?: number;
  onLoadMore?: (cursorMessageId?: string) => Promise<void> | void;
  onReactionClick?: (messageId: string, emoji: string) => void;
  onOpenThread?: (messageId: string) => void;
  onMessageClick?: (messageId: string) => void;
  className?: string;
  emptyState?: React.ReactNode;
}

const SCROLL_THRESHOLD_PX = 120;

const formatMessageTime = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "HH:mm");
};

const isNearTop = (element: HTMLElement | null): boolean => {
  if (!element) return false;
  return element.scrollTop <= SCROLL_THRESHOLD_PX;
};

const isNearBottom = (element: HTMLElement | null): boolean => {
  if (!element) return false;
  const { scrollTop, scrollHeight, clientHeight } = element;
  return scrollHeight - (scrollTop + clientHeight) <= SCROLL_THRESHOLD_PX;
};

const areSameDay = (a: string | Date, b: string | Date): boolean => {
  const da = typeof a === "string" ? new Date(a) : a;
  const db = typeof b === "string" ? new Date(b) : b;
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
};

const formatDateSeparator = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return format(date, "EEEE, MMM d, yyyy");
};

const Avatar: FC<{ user: User }> = ({ user }) => {
  const initials = useMemo(() => {
    if (!user.name) return "?";
    const parts = user.name.trim().split(" ");
    if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
    return `undefinedundefined`.toUpperCase();
  }, [user.name]);

  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        backgroundColor: "#E5E7EB",
        color: "#111827",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 600,
        overflow: "hidden",
        flexShrink: 0,
      }}
      aria-label={user.name}
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={user.avatarUrl}
          alt={user.name}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials
      )}
    </div>
  );
};

const ReactionPill: FC<{
  reaction: ReactionSummary;
  onClick?: () => void;
}> = ({ reaction, onClick }) => {
  const active = Boolean(reaction.reactedByCurrentUser);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        borderRadius: 999,
        border: `1px solid undefined`,
        backgroundColor: active ? "rgba(37,99,235,0.1)" : "#F9FAFB",
        padding: "0 6px",
        height: 22,
        fontSize: 12,
        lineHeight: 1,
        color: "#111827",
        cursor: "pointer",
      }}
    >
      <span>{reaction.emoji}</span>
      <span>{reaction.count}</span>
    </button>
  );
};

const ThreadSummary: FC<{
  count: number;
  onClick?: () => void;
}> = ({ count, onClick }) => {
  if (count <= 0) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 12,
        color: "#2563EB",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          border: "1px solid #93C5FD",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 10,
          color: "#1D4ED8",
        }}
      >
        ↩
      </span>
      <span>{count} replies</span>
    </button>
  );
};

const LoadingSpinner: FC = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "8px 0",
    }}
  >
    <div
      style={{
        width: 18,
        height: 18,
        borderRadius: "50%",
        border: "2px solid #E5E7EB",
        borderTopColor: "#2563EB",
        animation: "ml-spin 0.7s linear infinite",
      }}
    />
    <style>
      {`
        @keyframes ml-spin {
          to { transform: rotate(360deg); }
        }
      `}
    </style>
  </div>
);

const DateSeparator: FC<{ date: string | Date }> = ({ date }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      margin: "8px 0",
      position: "relative",
    }}
  >
    <div
      style={{
        position: "absolute",
        top: "50%",
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: "#E5E7EB",
        transform: "translateY(-50%)",
        zIndex: 0,
      }}
    />
    <span
      style={{
        position: "relative",
        padding: "0 8px",
        backgroundColor: "#FFFFFF",
        color: "#6B7280",
        fontSize: 12,
        zIndex: 1,
      }}
    >
      {formatDateSeparator(date)}
    </span>
  </div>
);

const SystemMessage: FC<{ message: Message }> = ({ message }) => (
  <div
    style={{
      padding: "4px 12px",
      textAlign: "center",
      fontSize: 12,
      color: "#6B7280",
    }}
  >
    {message.content}
  </div>
);

const MessageRow: FC<{
  message: Message;
  isOwn: boolean;
  onReactionClick?: (emoji: string) => void;
  onOpenThread?: () => void;
  onClick?: () => void;
}> = ({ message, isOwn, onReactionClick, onOpenThread, onClick }) => {
  const handleClick = useCallback(() => {
    if (onClick) onClick();
  }, [onClick]);

  if (message.isSystemMessage) {
    return <SystemMessage message={message} />;
  }

  return (
    <div
      style={{
        display: "flex",
        padding: "6px 12px",
        gap: 8,
        alignItems: "flex-start",
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={handleClick}
      data-message-id={message.id}
    >
      <Avatar user={message.sender} />
      <div style={{ flex: 1, min