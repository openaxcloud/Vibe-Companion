import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import classNames from "classnames";

export type MessageAuthor = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isCurrentUser?: boolean;
};

export type MessageReaction = {
  emoji: string;
  count: number;
  reactedByCurrentUser: boolean;
};

export type MessageAttachment = {
  id: string;
  url: string;
  name: string;
  type: "image" | "file" | "video" | "other";
  size?: number;
  thumbnailUrl?: string;
};

export type Message = {
  id: string;
  author: MessageAuthor;
  text: string;
  createdAt: string | Date;
  updatedAt?: string | Date;
  isEdited?: boolean;
  isDeleted?: boolean;
  isPinned?: boolean;
  isSystem?: boolean;
  isOwn?: boolean;
  parentId?: string | null;
  replyCount?: number;
  reactions?: MessageReaction[];
  attachments?: MessageAttachment[];
  isSending?: boolean;
  error?: string | null;
};

type BaseActionHandler<T = void> = (messageId: string) => T;

export type MessageProps = {
  message: Message;
  isThreaded?: boolean;
  isHighlighted?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  showAvatar?: boolean;
  showTimestamp?: boolean;
  showAuthorName?: boolean;
  currentUserId?: string;
  availableReactions?: string[];
  maxReactionsToShow?: number;
  onReact?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string, emoji: string) => void;
  onOpenThread?: BaseActionHandler;
  onEdit?: BaseActionHandler;
  onDelete?: BaseActionHandler;
  onRetrySend?: BaseActionHandler;
  onCancelSend?: BaseActionHandler;
  onAvatarClick?: (userId: string) => void;
  onUserNameClick?: (userId: string) => void;
  onPin?: BaseActionHandler;
  onUnpin?: BaseActionHandler;
  onCopyText?: (text: string) => void;
  onAttachmentClick?: (attachment: MessageAttachment, message: Message) => void;
  dateFormatter?: (date: Date) => string;
  timeFormatter?: (date: Date) => string;
  className?: string;
};

const DEFAULT_AVAILABLE_REACTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "👀"];

const parseDate = (value: string | Date | undefined): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(parsed.getTime())) return null;
  return parsed;
};

const defaultDateFormatter = (value: Date): string =>
  value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

const defaultTimeFormatter = (value: Date): string =>
  value.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

const Avatar: FC<{
  author: MessageAuthor;
  size?: number;
  onClick?: () => void;
}> = ({ author, size = 32, onClick }) => {
  const initials = useMemo(() => {
    if (!author.name) return "?";
    const parts = author.name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
    );
  }, [author.name]);

  return (
    <button
      type="button"
      className="message-avatar-button"
      onClick={onClick}
      aria-label={author.name}
    >
      <div
        className={classNames("message-avatar", {
          "message-avatar--online": author.isOnline,
        })}
        style={{ width: size, height: size }}
      >
        {author.avatarUrl ? (
          <img
            src={author.avatarUrl}
            alt={author.name}
            className="message-avatar__image"
          />
        ) : (
          <span className="message-avatar__initials">{initials}</span>
        )}
      </div>
    </button>
  );
};

type ReactionBarProps = {
  reactions: MessageReaction[];
  availableReactions: string[];
  messageId: string;
  onReact?: (messageId: string, emoji: string) => void;
  onRemoveReaction?: (messageId: string, emoji: string) => void;
};

const ReactionBar: FC<ReactionBarProps> = ({
  reactions,
  availableReactions,
  messageId,
  onReact,
  onRemoveReaction,
}) => {
  const handleToggleReaction = useCallback(
    (emoji: string) => {
      if (!onReact && !onRemoveReaction) return;
      const existing = reactions.find((r) => r.emoji === emoji);
      if (existing?.reactedByCurrentUser) {
        onRemoveReaction?.(messageId, emoji);
      } else {
        onReact?.(messageId, emoji);
      }
    },
    [messageId, onReact, onRemoveReaction, reactions]
  );

  const hasReactions = reactions.length > 0;

  return (
    <div className="message-reactions">
      {hasReactions && (
        <div className="message-reactions__list" aria-label="Reactions">
          {reactions.map((reaction) => (
            <button
              key={reaction.emoji}
              type="button"
              className={classNames("message-reaction-pill", {
                "message-reaction-pill--active": reaction.reactedByCurrentUser,
              })}
              onClick={() => handleToggleReaction(reaction.emoji)}
            >
              <span className="message-reaction-pill__emoji">
                {reaction.emoji}
              </span>
              <span className="message-reaction-pill__count">
                {reaction.count}
              </span>
            </button>
          ))}
        </div>
      )}
      {availableReactions.length > 0 && (
        <div className="message-reactions__picker">
          {availableReactions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="message-reactions__picker-item"
              onClick={() => handleToggleReaction(emoji)}
              aria-label={`React with undefined`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

type MessageActionsProps = {
  message: Message;
  onOpenThread?: BaseActionHandler;
  onEdit?: BaseActionHandler;
  onDelete?: BaseActionHandler;
  onPin?: BaseActionHandler;
  onUnpin?: BaseActionHandler;
  onCopyText?: (text: string) => void;
};

const MessageActions: FC<MessageActionsProps> = ({
  message,
  onOpenThread,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onCopyText,
}) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const toggleOpen = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const canEdit = !!onEdit && !!message.isOwn && !message.isDeleted;
  const canDelete = !!onDelete && (message.isOwn || !message.isSystem);
  const canThread = !!onOpenThread && !message.isSystem;
  const canPin = !!onPin && !message.isPinned;
  const canUnpin = !!onUnpin && !!message.isPinned;
  const canCopy = !!onCopyText && !!message.text && !message.isDeleted;

  const handleAction = useCallback(
    (action: (() => void) | undefined) => {
      if (!action) return;
      action();
      close();
    },
    [close]
  );

  return (
    <div className="message-actions" ref={menuRef}>
      <button
        type="button"
        className="message-actions__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggleOpen}
      >
        ⋯
      </button>
      {open && (
        <div className="message-actions__menu" role="menu">
          {canThread