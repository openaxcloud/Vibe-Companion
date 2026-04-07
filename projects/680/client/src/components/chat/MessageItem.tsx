import React, { useCallback, useMemo, useState } from "react";
import classNames from "classnames";

export type MessageReactionType = "like" | "love" | "laugh" | "surprised" | "sad" | "angry";

export interface MessageAttachment {
  id: string;
  type: "image" | "file";
  name: string;
  url: string;
  sizeLabel?: string;
}

export interface MessageAuthor {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface MessageReadReceipt {
  userId: string;
  readAt: string;
}

export interface MessageItemProps {
  id: string;
  author: MessageAuthor;
  text: string;
  createdAt: string;
  isOwn: boolean;
  isEdited?: boolean;
  isSending?: boolean;
  isFailed?: boolean;
  isPinned?: boolean;
  attachments?: MessageAttachment[];
  reactions?: Record<MessageReactionType, string[]>; // reaction -> userIds
  currentUserId: string;
  canReplyInThread?: boolean;
  threadReplyCount?: number;
  lastReadReceipts?: MessageReadReceipt[];
  isLastInGroup?: boolean;
  isFirstInGroup?: boolean;
  showAuthorName?: boolean;
  onReact?: (messageId: string, reaction: MessageReactionType) => void;
  onRemoveReaction?: (messageId: string, reaction: MessageReactionType) => void;
  onReply?: (messageId: string) => void;
  onOpenThread?: (messageId: string) => void;
  onRetrySend?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onEdit?: (messageId: string) => void;
  onOpenAttachment?: (attachment: MessageAttachment) => void;
}

const reactionOptions: { type: MessageReactionType; label: string; symbol: string }[] = [
  { type: "like", label: "Like", symbol: "👍" },
  { type: "love", label: "Love", symbol: "❤️" },
  { type: "laugh", label: "Haha", symbol: "😂" },
  { type: "surprised", label: "Wow", symbol: "😮" },
  { type: "sad", label: "Sad", symbol: "😢" },
  { type: "angry", label: "Angry", symbol: "😡" },
];

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

const getInitials = (name: string): string => {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const MessageItem: React.FC<MessageItemProps> = ({
  id,
  author,
  text,
  createdAt,
  isOwn,
  isEdited,
  isSending,
  isFailed,
  isPinned,
  attachments = [],
  reactions = {},
  currentUserId,
  canReplyInThread,
  threadReplyCount = 0,
  lastReadReceipts = [],
  isLastInGroup,
  isFirstInGroup,
  showAuthorName,
  onReact,
  onRemoveReaction,
  onReply,
  onOpenThread,
  onRetrySend,
  onDelete,
  onEdit,
  onOpenAttachment,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);

  const handleToggleReaction = useCallback(
    (reaction: MessageReactionType) => {
      if (!onReact && !onRemoveReaction) return;
      const currentUsers = reactions[reaction] || [];
      const hasReacted = currentUsers.includes(currentUserId);
      if (hasReacted) {
        onRemoveReaction?.(id, reaction);
      } else {
        onReact?.(id, reaction);
      }
      setIsReactionPickerOpen(false);
    },
    [id, reactions, currentUserId, onReact, onRemoveReaction]
  );

  const sortedReactions = useMemo(
    () =>
      Object.entries(reactions)
        .filter(([, userIds]) => userIds && userIds.length > 0)
        .sort((a, b) => (b[1]?.length || 0) - (a[1]?.length || 0)),
    [reactions]
  );

  const statusLabel = useMemo(() => {
    if (isFailed) return "Failed to send";
    if (isSending) return "Sending…";
    if (lastReadReceipts.length === 0) return "Delivered";
    return "Read";
  }, [isFailed, isSending, lastReadReceipts.length]);

  const showStatus = isOwn && isLastInGroup;

  const containerClass = classNames("message-item", {
    "message-item--own": isOwn,
    "message-item--with-menu-open": isMenuOpen,
  });

  const bubbleClass = classNames("message-item__bubble", {
    "message-item__bubble--own": isOwn,
    "message-item__bubble--other": !isOwn,
    "message-item__bubble--first-in-group": isFirstInGroup,
    "message-item__bubble--last-in-group": isLastInGroup,
    "message-item__bubble--failed": isFailed,
    "message-item__bubble--sending": isSending,
    "message-item__bubble--pinned": isPinned,
  });

  const showThreadFooter = canReplyInThread || threadReplyCount > 0;

  const handleBubbleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setIsMenuOpen(true);
    },
    []
  );

  const handleAttachmentClick = useCallback(
    (attachment: MessageAttachment) => {
      if (onOpenAttachment) {
        onOpenAttachment(attachment);
      } else {
        window.open(attachment.url, "_blank", "noopener,noreferrer");
      }
    },
    [onOpenAttachment]
  );

  const firstReadReceiptUser = lastReadReceipts[0];
  const hasReactions = sortedReactions.length > 0;

  return (
    <div className={containerClass} data-message-id={id}>
      {!isOwn && isFirstInGroup && (
        <div className="message-item__avatar">
          {author.avatarUrl ? (
            <img src={author.avatarUrl} alt={author.name} className="message-item__avatar-image" />
          ) : (
            <div className="message-item__avatar-fallback">{getInitials(author.name)}</div>
          )}
        </div>
      )}

      <div className="message-item__content">
        {!isOwn && showAuthorName && isFirstInGroup && (
          <div className="message-item__author-name">{author.name}</div>
        )}

        <div className="message-item__row">
          {!isOwn && (
            <div className="message-item__gutter" aria-hidden="true" />
          )}

          <div
            className={bubbleClass}
            onContextMenu={handleBubbleContextMenu}
            role="group"
            aria-label={`Message from undefined`}
          >
            <div className="message-item__bubble-inner">
              {text && (
                <div className="message-item__text">
                  <span>{text}</span>
                  {isEdited && <span className="message-item__edited-tag">Edited</span>}
                </div>
              )}

              {attachments.length > 0 && (
                <div className="message-item__attachments">
                  {attachments.map((attachment) => (
                    <button
                      key={attachment.id}
                      type="button"
                      className={classNames("message-item__attachment", {
                        "message-item__attachment--image": attachment.type === "image",
                        "message-item__attachment--file": attachment.type === "file",
                      })}
                      onClick={() => handleAttachmentClick(attachment)}
                    >
                      {attachment.type === "image" ? (
                        <div className="message-item__attachment-image-wrapper">
                          <img
                            src={attachment.url}
                            alt={attachment.name}
                            className="message-item__attachment-image"
                          />
                        </div>
                      ) : (
                        <div className="message-item__attachment-file-icon" aria-hidden="true">
                          📎
                        </div>
                      )}
                      <div className="message-item__attachment-meta">
                        <div className="message-item__attachment-name" title={attachment.name}>
                          {attachment.name}
                        </div>
                        {attachment.sizeLabel && (
                          <div className="message-item__attachment-size">
                            {attachment.sizeLabel}
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="message-item__meta">
              <span className="message-item__time">{formatTime(createdAt)}</span>
              {