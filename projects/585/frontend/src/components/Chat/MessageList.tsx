import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from "react";
import {
  FixedSizeList as List,
  ListOnItemsRenderedProps,
} from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";

type MessageAuthor = {
  id: string;
  name: string;
  avatarUrl?: string | null;
};

export type Message = {
  id: string;
  parentId?: string | null;
  threadRootId?: string | null;
  content: string;
  author: MessageAuthor;
  createdAt: string | Date;
  updatedAt?: string | Date | null;
  isOwn: boolean;
  isPending?: boolean;
  isFailed?: boolean;
  replyCount?: number;
  isThreadRoot?: boolean;
};

type ThreadState = {
  expandedRootId: string | null;
  // Map threadRootId -> array of messages in that thread (excluding root if also in main list)
  messagesByThread: Record<string, Message[]>;
};

export type MessageListProps = {
  messages: Message[];
  /**
   * Called when the user scrolls near the top; load older messages (pagination).
   * Should return a promise that resolves to true when more messages exist, false otherwise.
   */
  onLoadMoreAbove?: () => Promise<boolean>;
  /**
   * Called when the user scrolls near the bottom; optional pagination for newer messages.
   */
  onLoadMoreBelow?: () => Promise<boolean>;
  /**
   * Called when a message is clicked (for selection, context menu, etc.)
   */
  onMessageClick?: (message: Message, event: React.MouseEvent) => void;
  /**
   * Called when the user wants to open a thread for a message.
   */
  onOpenThread?: (rootMessage: Message) => Promise<Message[]> | Message[];
  /**
   * Called when the user clicks "Reply in thread" on a message.
   */
  onReplyInThread?: (rootMessage: Message) => void;
  /**
   * Called when the list has been scrolled to bottom (e.g., to mark messages read).
   */
  onReachedBottom?: () => void;
  /**
   * Called when a message becomes visible (used for read receipts).
   */
  onMessageVisible?: (message: Message) => void;
  /**
   * Whether new messages should auto-scroll into view when at or near the bottom.
   */
  autoScrollOnNewMessage?: boolean;
  /**
   * Estimated row height; used for list layout.
   */
  rowHeight?: number;
  /**
   * Distance from top of list (in pixels) at which onLoadMoreAbove should be triggered.
   */
  loadMoreAboveThreshold?: number;
  /**
   * Distance from bottom of list (in pixels) at which onLoadMoreBelow should be triggered.
   */
  loadMoreBelowThreshold?: number;
  /**
   * Optional className for container
   */
  className?: string;
  /**
   * Whether to reverse messages (bottom-up chat style).
   * If true, newest message at bottom; scrolling up loads older.
   */
  reverse?: boolean;
  /**
   * Optional render function to fully control message row UI.
   */
  renderMessage?: (params: {
    message: Message;
    isThreadMessage: boolean;
    isThreadRoot: boolean;
    depth: number;
    onOpenThread: (() => void) | null;
    onReplyInThread: (() => void) | null;
    onClick: (event: React.MouseEvent) => void;
  }) => React.ReactNode;
  /**
   * Optional custom loader element when loading more messages.
   */
  renderLoader?: (position: "top" | "bottom") => React.ReactNode;
  /**
   * If true, shows thread messages inline instead of separate pane.
   */
  inlineThreads?: boolean;
  /**
   * When provided, this message id will be scrolled into view once (e.g. for deep-link).
   */
  highlightMessageId?: string | null;
  /**
   * Milliseconds within which messages from the same author are visually grouped.
   */
  groupingTimeWindowMs?: number;
  /**
   * Optional test id for the container.
   */
  "data-testid"?: string;
};

type InternalRow = {
  type: "message" | "loader-top" | "loader-bottom" | "thread-divider";
  key: string;
  message?: Message;
  depth?: number;
  isThreadMessage?: boolean;
  isThreadRoot?: boolean;
  loaderPosition?: "top" | "bottom";
};

const DEFAULT_ROW_HEIGHT = 72;
const DEFAULT_GROUPING_WINDOW_MS = 3 * 60 * 1000; // 3 minutes

const MessageRow = memo(
  ({
    data,
    index,
    style,
  }: {
    data: {
      rows: InternalRow[];
      onRowClick: (message: Message, e: React.MouseEvent) => void;
      onOpenThreadMessage: (message: Message) => void;
      onReplyInThreadMessage: (message: Message) => void;
      renderMessage?: MessageListProps["renderMessage"];
      renderLoader?: MessageListProps["renderLoader"];
      reverse?: boolean;
    };
    index: number;
    style: React.CSSProperties;
  }) => {
    const { rows, onRowClick, onOpenThreadMessage, onReplyInThreadMessage, renderMessage, renderLoader } =
      data;

    const row = rows[index];

    if (row.type === "loader-top" || row.type === "loader-bottom") {
      const content =
        renderLoader?.(row.loaderPosition!) ??
        (row.loaderPosition === "top" ? (
          <div
            style={{
              padding: "8px",
              fontSize: 12,
              color: "#666",
              textAlign: "center",
            }}
          >
            Loading earlier messages…
          </div>
        ) : (
          <div
            style={{
              padding: "8px",
              fontSize: 12,
              color: "#666",
              textAlign: "center",
            }}
          >
            Loading newer messages…
          </div>
        ));

      return (
        <div style={style} data-role={`loader-undefined`}>
          {content}
        </div>
      );
    }

    if (row.type === "thread-divider") {
      return (
        <div
          style={{
            ...style,
            display: "flex",
            alignItems: "center",
            padding: "4px 12px",
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1,
              backgroundColor: "#e0e0e0",
            }}
          />
          <span
            style={{
              fontSize: 11,
              color: "#999",
              padding: "0 8px",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Thread
          </span>
          <div
            style={{
              flex: 1,
              height: 1,
              backgroundColor: "#e0e0e0",
            }}
          />
        </div>
      );
    }

    const message = row.message!;
    const isThreadRoot = !!row.isThreadRoot;
    const isThreadMessage = !!row.isThreadMessage;
    const depth = row.depth ?? 0;

    const handleClick = (e: React.MouseEvent) => {
      onRowClick(message, e);
    };

    const handleOpenThread =
      isThreadRoot || !message.replyCount
        ? () => onOpenThreadMessage(message)
        : () => onOpenThreadMessage(message);

    const handleReplyInThread = () => {
      onReplyInThreadMessage(message);
    };

    if (renderMessage) {
      return (
        <div style={style} data-message-id={message.id}>
          {renderMessage({
            message,
            isThreadMessage,
            isThreadRoot,
            depth,
            onOpenThread: isThreadRoot || message.replyCount ? handleOpenThread : null,
            onReplyInThread: handleReplyInThread,
            onClick: handleClick,
          })}
        </div>
      );
    }

    // Default basic message UI
    return (
      <div
        style={{
          ...style,
          padding: "4px 12px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          alignItems: message.isOwn ? "flex-end" : "flex-start",
        }}
        onClick={handleClick}
        data-message-id={message.id}
      >
        <div
          style={{
            maxWidth: "80%",
            marginLeft: depth * 16,
          }}
        >
          {!isThreadMessage && (
            <div
              style={{
                fontSize: 11,
                color: "#888",
                marginBottom: 2,
              }}
            >
              {message.author.name}
            </div>
          )}
          <div
            style={{
              backgroundColor: message.isOwn ? "#DCF8C6" : "#FFFFFF",
              borderRadius: 12,
              padding: "6px 10px",
              boxShadow: "0 1px 1px rgba(0,0,0,0.05)",
              border: "1px solid #e0e0e0",
              whiteSpace: "pre