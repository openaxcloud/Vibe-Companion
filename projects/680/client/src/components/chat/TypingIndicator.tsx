import React, { useEffect, useMemo, useState } from "react";
import { css, keyframes } from "@emotion/css";

type TypingUser = {
  id: string;
  displayName: string;
};

type TypingIndicatorProps = {
  channelId: string;
  currentUserId: string;
  /**
   * Function that subscribes to typing events for a channel
   * Should return an unsubscribe function.
   * onTypingStart: (user: TypingUser) => void
   * onTypingStop: (userId: string) => void
   */
  subscribeToTypingEvents: (
    channelId: string,
    handlers: {
      onTypingStart: (user: TypingUser) => void;
      onTypingStop: (userId: string) => void;
    }
  ) => () => void;
  /**
   * Optional custom className for outer wrapper
   */
  className?: string;
  /**
   * Milliseconds after which a user is considered no longer typing
   * if no stop event has been received.
   */
  typingTimeoutMs?: number;
  /**
   * Maximum number of user names to show explicitly before using "and X others"
   */
  maxDisplayNames?: number;
};

type InternalTypingUser = TypingUser & {
  lastUpdatedAt: number;
};

const bubbleAnimation = keyframes`
  0% { transform: translateY(0px); opacity: 0.5; }
  20% { transform: translateY(-2px); opacity: 1; }
  40% { transform: translateY(0px); opacity: 0.7; }
  100% { transform: translateY(0px); opacity: 0.5; }
`;

const containerStyle = css`
  min-height: 18px;
  display: flex;
  align-items: center;
  padding: 2px 12px 6px 12px;
  font-size: 12px;
  color: #6b7280;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
`;

const hiddenStyle = css`
  visibility: hidden;
`;

const textStyle = css`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const bubblesWrapperStyle = css`
  display: inline-flex;
  align-items: center;
  margin-left: 6px;
`;

const bubbleStyle = css`
  width: 4px;
  height: 4px;
  border-radius: 9999px;
  background-color: #9ca3af;
  margin: 0 1px;
  animation: undefined 1.2s infinite ease-in-out;
  &:nth-of-type(2) {
    animation-delay: 0.2s;
  }
  &:nth-of-type(3) {
    animation-delay: 0.4s;
  }
`;

const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  channelId,
  currentUserId,
  subscribeToTypingEvents,
  className,
  typingTimeoutMs = 8000,
  maxDisplayNames = 2,
}) => {
  const [typingUsers, setTypingUsers] = useState<Record<string, InternalTypingUser>>(
    {}
  );

  useEffect(() => {
    if (!channelId) return;

    const handleTypingStart = (user: TypingUser) => {
      if (!user || !user.id || user.id === currentUserId) return;

      setTypingUsers((prev) => ({
        ...prev,
        [user.id]: {
          ...user,
          lastUpdatedAt: Date.now(),
        },
      }));
    };

    const handleTypingStop = (userId: string) => {
      if (!userId) return;
      setTypingUsers((prev) => {
        if (!prev[userId]) return prev;
        const { [userId]: _, ...rest } = prev;
        return rest;
      });
    };

    const unsubscribe = subscribeToTypingEvents(channelId, {
      onTypingStart: handleTypingStart,
      onTypingStop: handleTypingStop,
    });

    return () => {
      unsubscribe?.();
      setTypingUsers({});
    };
  }, [channelId, currentUserId, subscribeToTypingEvents]);

  useEffect(() => {
    if (!typingTimeoutMs) return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => {
        const next: Record<string, InternalTypingUser> = {};
        let changed = false;

        Object.values(prev).forEach((user) => {
          if (now - user.lastUpdatedAt < typingTimeoutMs) {
            next[user.id] = user;
          } else {
            changed = true;
          }
        });

        return changed ? next : prev;
      });
    }, Math.min(typingTimeoutMs / 2, 4000));

    return () => clearInterval(interval);
  }, [typingTimeoutMs]);

  const visibleUsers = useMemo(
    () =>
      Object.values(typingUsers)
        .filter((u) => u.id !== currentUserId)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [typingUsers, currentUserId]
  );

  const indicatorText = useMemo(() => {
    const count = visibleUsers.length;
    if (count === 0) return "";

    const names = visibleUsers.map((u) => u.displayName || "Someone");
    if (count === 1) {
      return `undefined is typing`;
    }

    const displayedNames = names.slice(0, maxDisplayNames);
    const remaining = count - displayedNames.length;

    if (remaining <= 0) {
      if (displayedNames.length === 2) {
        return `undefined and undefined are typing`;
      }
      return `undefined are typing`;
    }

    const base =
      displayedNames.length === 1
        ? displayedNames[0]
        : `undefined and undefined`;

    const othersText = remaining === 1 ? "1 other" : `undefined others`;
    return `undefined and undefined are typing`;
  }, [visibleUsers, maxDisplayNames]);

  if (!indicatorText) {
    return <div className={`undefined undefined undefined`} />;
  }

  return (
    <div className={`undefined undefined`}>
      <span className={textStyle}>{indicatorText}</span>
      <span className={bubblesWrapperStyle} aria-hidden="true">
        <span className={bubbleStyle} />
        <span className={bubbleStyle} />
        <span className={bubbleStyle} />
      </span>
    </div>
  );
};

export default TypingIndicator;