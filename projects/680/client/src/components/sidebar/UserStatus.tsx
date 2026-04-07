import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { FC, ChangeEvent, KeyboardEvent, FocusEvent } from "react";

type PresenceStatus = "online" | "away" | "busy" | "offline";

interface PresenceUpdatePayload {
  status: PresenceStatus;
  statusMessage?: string;
  lastActiveAt?: string;
}

interface UserStatusProps {
  userId: string;
  displayName: string;
  initialStatus?: PresenceStatus;
  initialStatusMessage?: string;
  isEditable?: boolean;
  className?: string;
  onPresenceChange?: (payload: PresenceUpdatePayload) => void;
  /**
   * Optional websocket or event source for live presence updates.
   * Expected to emit events in the shape of PresenceUpdatePayload.
   */
  presenceSource?: {
    subscribe: (userId: string, callback: (payload: PresenceUpdatePayload) => void) => () => void;
    publish?: (userId: string, payload: PresenceUpdatePayload) => void;
  };
}

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: "Online",
  away: "Away",
  busy: "Do not disturb",
  offline: "Offline",
};

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: "#16a34a", // green-600
  away: "#fbbf24", // amber-400
  busy: "#ef4444", // red-500
  offline: "#9ca3af", // gray-400
};

const DOT_SIZE = 10;

const clampStatusMessage = (value: string, maxLength: number) => {
  if (!value) return "";
  return value.length <= maxLength ? value : value.slice(0, maxLength);
};

const UserStatus: FC<UserStatusProps> = ({
  userId,
  displayName,
  initialStatus = "offline",
  initialStatusMessage = "",
  isEditable = true,
  className = "",
  onPresenceChange,
  presenceSource,
}) => {
  const [status, setStatus] = useState<PresenceStatus>(initialStatus);
  const [statusMessage, setStatusMessage] = useState<string>(initialStatusMessage || "");
  const [editing, setEditing] = useState<boolean>(false);
  const [draftMessage, setDraftMessage] = useState<string>(initialStatusMessage || "");
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [lastActiveAt, setLastActiveAt] = useState<string | undefined>(undefined);

  const MAX_MESSAGE_LENGTH = 120;

  useEffect(() => {
    if (!presenceSource) return;

    const unsubscribe = presenceSource.subscribe(userId, (payload: PresenceUpdatePayload) => {
      if (payload.status && payload.status !== status) {
        setStatus(payload.status);
      }
      if (typeof payload.statusMessage === "string") {
        setStatusMessage(payload.statusMessage);
        if (!editing) {
          setDraftMessage(payload.statusMessage);
        }
      }
      if (payload.lastActiveAt) {
        setLastActiveAt(payload.lastActiveAt);
      }
    });

    return unsubscribe;
  }, [presenceSource, userId, status, editing]);

  const handleCommitStatusMessage = useCallback(
    (nextMessage: string) => {
      const trimmed = nextMessage.trim();
      setStatusMessage(trimmed);
      setDraftMessage(trimmed);
      setEditing(false);

      const payload: PresenceUpdatePayload = {
        status,
        statusMessage: trimmed,
        lastActiveAt,
      };

      if (onPresenceChange) {
        onPresenceChange(payload);
      }

      if (presenceSource?.publish) {
        presenceSource.publish(userId, payload);
      }
    },
    [status, userId, lastActiveAt, onPresenceChange, presenceSource]
  );

  const handleInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const value = clampStatusMessage(event.target.value, MAX_MESSAGE_LENGTH);
      setDraftMessage(value);
    },
    []
  );

  const handleInputBlur = useCallback(
    (event: FocusEvent<HTMLInputElement>) => {
      handleCommitStatusMessage(event.target.value);
    },
    [handleCommitStatusMessage]
  );

  const handleInputKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleCommitStatusMessage((event.target as HTMLInputElement).value);
      } else if (event.key === "Escape") {
        event.preventDefault();
        setEditing(false);
        setDraftMessage(statusMessage);
      }
    },
    [handleCommitStatusMessage, statusMessage]
  );

  const handleContainerClick = useCallback(() => {
    if (!isEditable) return;
    setEditing(true);
  }, [isEditable]);

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  const presenceText = useMemo(() => STATUS_LABELS[status], [status]);

  const dotColor = useMemo(() => STATUS_COLORS[status], [status]);

  const containerClassName = useMemo(
    () =>
      [
        "user-status-container",
        "flex",
        "items-center",
        "gap-2",
        "min-w-0",
        className || "",
      ]
        .filter(Boolean)
        .join(" "),
    [className]
  );

  const nameClassName =
    "text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[160px]";

  const presenceClassName =
    "text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap";

  const statusMessageClassName =
    "text-xs text-gray-600 dark:text-gray-300 truncate max-w-[220px]";

  const editableHintClassName =
    "ml-1 text-[10px] text-gray-400 dark:text-gray-500 italic";

  return (
    <div
      className={containerClassName}
      title={statusMessage || undefined}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <span
        aria-hidden="true"
        style={{
          width: DOT_SIZE,
          height: DOT_SIZE,
          borderRadius: "9999px",
          backgroundColor: dotColor,
          boxShadow:
            status === "online"
              ? `0 0 0 4px rgba(22, 163, 74, 0.25)`
              : "none",
          transition: "box-shadow 150ms ease, transform 150ms ease",
          transform: isHovering && status === "online" ? "scale(1.05)" : "scale(1)",
          flexShrink: 0,
        }}
      />
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1 min-w-0">
          <span className={nameClassName}>{displayName}</span>
          <span className={presenceClassName}>{presenceText}</span>
        </div>

        <div
          className="flex items-center min-h-[18px] cursor-text"
          onClick={handleContainerClick}
        >
          {editing && isEditable ? (
            <input
              autoFocus
              type="text"
              value={draftMessage}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              placeholder="Set a status message"
              className="w-full bg-transparent border-0 border-b border-gray-200 dark:border-gray-700 focus:outline-none focus:border-blue-500 dark:focus:border-blue-400 text-xs text-gray-700 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          ) : (
            <div className="flex items-center min-w-0">
              <span className={statusMessageClassName}>
                {statusMessage || (isEditable ? "Click to set a status message" : "")}
              </span>
              {isEditable && (
                <span className={editableHintClassName}>
                  {statusMessage ? "edit" : "add"}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserStatus;