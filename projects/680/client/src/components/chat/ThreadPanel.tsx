import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  KeyboardEvent,
  FormEvent,
} from "react";
import classNames from "classnames";

export type User = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type Reaction = {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
};

export type MessageBase = {
  id: string;
  author: User;
  text: string;
  createdAt: string | Date;
  isEdited?: boolean;
  reactions?: Reaction[];
};

export type ParentMessage = MessageBase & {
  // Other fields like attachments can be added later
};

export type ThreadReply = MessageBase & {
  parentId: string;
};

export type ThreadMessage = ParentMessage | ThreadReply;

export type ThreadPanelProps = {
  isOpen: boolean;
  parentMessage: ParentMessage | null;
  replies: ThreadReply[];
  currentUser: User | null;
  isLoadingReplies?: boolean;
  isPostingReply?: boolean;
  isReactionsEnabled?: boolean;
  availableReactions?: string[];
  onClose: () => void;
  onSendReply: (payload: {
    parentId: string;
    text: string;
  }) => Promise<void> | void;
  onToggleReaction?: (payload: {
    messageId: string;
    emoji: string;
    isParent: boolean;
  }) => Promise<void> | void;
  onLoadMoreReplies?: (payload: {
    parentId: string;
    cursor?: string | null;
  }) => Promise<void> | void;
  onParentClickInMainView?: (messageId: string) => void;
  threadTitle?: string;
  className?: string;
  maxHeight?: number | string;
  initialReplyText?: string;
};

type InternalReaction = Reaction;

const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢"];

const formatTime = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFullDateTime = (value: string | Date): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString();
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

const Avatar: React.FC<{ user: User; size?: number }> = ({ user, size = 32 }) => {
  const initials = getInitials(user.name);
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size}
        height={size}
        className="threadpanel-avatar-image"
      />
    );
  }
  return (
    <div
      className="threadpanel-avatar-fallback"
      style={{ width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {initials}
    </div>
  );
};

const ReactionPill: React.FC<{
  reaction: InternalReaction;
  onToggle?: () => void;
}> = ({ reaction, onToggle }) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle?.();
    }
  };

  return (
    <button
      type="button"
      className={classNames("threadpanel-reaction-pill", {
        "threadpanel-reaction-pill--active": reaction.reactedByCurrentUser,
      })}
      onClick={onToggle}
      onKeyDown={handleKeyDown}
    >
      <span className="threadpanel-reaction-pill-emoji">{reaction.emoji}</span>
      <span className="threadpanel-reaction-pill-count">{reaction.count}</span>
    </button>
  );
};

const ReactionPicker: React.FC<{
  available: string[];
  onSelect: (emoji: string) => void;
}> = ({ available, onSelect }) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>, emoji: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(emoji);
    }
  };

  return (
    <div className="threadpanel-reaction-picker" role="listbox" aria-label="Add reaction">
      {available.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="threadpanel-reaction-picker-item"
          onClick={() => onSelect(emoji)}
          onKeyDown={(e) => handleKeyDown(e, emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
};

const MessageBubble: React.FC<{
  message: ThreadMessage;
  isParent?: boolean;
  showHeader?: boolean;
  onToggleReaction?: (emoji: string) => void;
  canReact?: boolean;
  availableReactions?: string[];
  isFirstInThread?: boolean;
}> = ({
  message,
  isParent = false,
  showHeader = true,
  onToggleReaction,
  canReact = false,
  availableReactions = DEFAULT_REACTIONS,
  isFirstInThread = false,
}) => {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const handleToggleReaction = useCallback(
    (emoji: string) => {
      onToggleReaction?.(emoji);
    },
    [onToggleReaction]
  );

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!isPickerOpen) return;
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsPickerOpen(false);
      }
    },
    [isPickerOpen]
  );

  useEffect(() => {
    if (!isPickerOpen) return;
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isPickerOpen, handleClickOutside]);

  const sortedReactions = useMemo(() => {
    if (!message.reactions || message.reactions.length === 0) return [];
    return [...message.reactions].sort((a, b) => b.count - a.count);
  }, [message.reactions]);

  return (
    <article
      className={classNames("threadpanel-message", {
        "threadpanel-message--parent": isParent,
        "threadpanel-message--first-in-thread": isFirstInThread,
      })}
      aria-label={isParent ? "Parent message" : "Thread reply"}
    >
      {showHeader && (
        <header className="threadpanel-message-header">
          <div className="threadpanel-message-avatar">
            <Avatar user={message.author} size={32} />
          </div>
          <div className="threadpanel-message-header-main">
            <div className="threadpanel-message-header-row">
              <span className="threadpanel-message-author">{message.author.name}</span>
              <time
                className="threadpanel-message-timestamp"
                dateTime={
                  typeof message.createdAt === "string"
                    ? message.createdAt
                    : message.createdAt.toISOString()
                }
                title={formatFullDateTime(message.createdAt)}
              >
                {formatTime(message.createdAt)}
              </time>
            </div>
            {message.isEdited && (
              <span className="threadpanel-message-edited" aria-label="Edited">
                (edited)
              </span>
            )}
          </div>
        </header>
      )}
      <div className="threadpanel-message-body">
        <p className="threadpanel-message-text">{message.text}</p>
      </div>
      <footer className="threadpanel-message-footer">
        {sortedReactions.length > 0 && (
          <div className="threadpanel-message-reactions" aria-label="Reactions">
            {sortedReactions.map((reaction) => (
              <ReactionPill
                key={reaction.emoji}
                reaction={reaction}
                onToggle={
                  onToggleReaction ? () => handleToggleReaction(reaction.emoji) : undefined
                }
              />
            ))}
          </div>
        )}
        {canReact && onToggleReaction && (
          <div className="threadpanel-message-actions">
            <div className="threadpanel-reaction-picker-wrapper" ref={pickerRef}>
              <button
                type="button"
                className="threadpanel-message-action-button"
                onClick={() => setIsPickerOpen((prev) => !prev)}