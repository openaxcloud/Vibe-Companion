import React, { useMemo } from "react";
import { styled } from "@mui/material/styles";
import Tooltip from "@mui/material/Tooltip";
import CheckIcon from "@mui/icons-material/Check";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CircularProgress from "@mui/material/CircularProgress";
import Typography from "@mui/material/Typography";

type ReadStatus = "sent" | "delivered" | "read" | "pending";

interface ReadReceiptIndicatorProps {
  /**
   * Unique identifier for the message
   */
  messageId?: string;
  /**
   * Identifier for the conversation / channel / DM
   */
  conversationId: string;
  /**
   * Optional status override when store is not used
   */
  status?: ReadStatus;
  /**
   * Whether to show compact icon-only indicator
   */
  variant?: "icon" | "text" | "both";
  /**
   * Optional timestamp used to determine if others have read
   */
  messageTimestamp?: number;
  /**
   * List of user IDs who have read this message (optional external prop)
   */
  readers?: string[];
  /**
   * Current user ID, used to ignore own read status if needed
   */
  currentUserId?: string;
  /**
   * Optional: if true, treat as "latest message in conversation"
   */
  isLatestInConversation?: boolean;
  /**
   * If using a read receipt store hook, you can inject results here instead
   */
  storeStatus?: ReadStatus;
  storeReadCount?: number;
  /**
   * Whether to hide tooltip
   */
  disableTooltip?: boolean;
  /**
   * Optional custom className
   */
  className?: string;
  /**
   * Size in px for icons
   */
  size?: number;
  /**
   * Color override
   */
  color?: string;
}

const Root = styled("span")<{ clickable?: boolean }>(({ theme, clickable }) => ({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: theme.spacing(0.5),
  minWidth: 0,
  cursor: clickable ? "pointer" : "default",
  color: theme.palette.text.secondary,
  fontSize: 11,
  lineHeight: 1,
}));

const TextLabel = styled(Typography)(({ theme }) => ({
  fontSize: 11,
  lineHeight: 1.2,
  color: "inherit",
}));

const ReadReceiptIndicator: React.FC<ReadReceiptIndicatorProps> = (props) => {
  const {
    messageId,
    conversationId,
    status: statusOverride,
    variant = "icon",
    messageTimestamp,
    readers,
    currentUserId,
    isLatestInConversation,
    storeStatus,
    storeReadCount,
    disableTooltip,
    className,
    size = 14,
    color,
  } = props;

  // In a real app, you might use a hook like:
  // const { status, readCount } = useReadReceipt(conversationId, messageId, isLatestInConversation);
  // For this standalone component, we allow injection via props and simple inference.

  const derivedStatus: ReadStatus = useMemo(() => {
    if (statusOverride) return statusOverride;
    if (storeStatus) return storeStatus;

    // Infer from readers list and messageTimestamp if available
    if (readers && readers.length > 0) {
      const nonSelfReaders = currentUserId
        ? readers.filter((id) => id !== currentUserId)
        : readers;
      if (nonSelfReaders.length > 0) return "read";
    }

    // If this is latest and we don't have information yet, treat as pending
    if (isLatestInConversation && !messageId) return "pending";

    return "sent";
  }, [
    statusOverride,
    storeStatus,
    readers,
    currentUserId,
    isLatestInConversation,
    messageId,
  ]);

  const readCount: number | undefined = useMemo(() => {
    if (typeof storeReadCount === "number") return storeReadCount;
    if (!readers) return undefined;
    const nonSelfReaders = currentUserId
      ? readers.filter((id) => id !== currentUserId)
      : readers;
    return nonSelfReaders.length;
  }, [storeReadCount, readers, currentUserId]);

  const showIcon = variant === "icon" || variant === "both";
  const showText = variant === "text" || variant === "both";

  const { icon, label, tooltip } = useMemo(() => {
    switch (derivedStatus) {
      case "pending":
        return {
          icon: (
            <CircularProgress
              size={size}
              thickness={5}
              color="inherit"
            />
          ),
          label: "Sending…",
          tooltip: "Message is being sent",
        };
      case "sent":
        return {
          icon: (
            <CheckIcon
              sx={{ fontSize: size }}
            />
          ),
          label: "Sent",
          tooltip: "Message sent",
        };
      case "delivered":
        return {
          icon: (
            <DoneAllIcon
              sx={{ fontSize: size }}
            />
          ),
          label: "Delivered",
          tooltip: "Message delivered",
        };
      case "read":
      default: {
        const baseLabel = readCount && readCount > 1 ? "Read by others" : "Read";
        const detailed =
          typeof readCount === "number" && readCount > 0
            ? `undefined (undefined)`
            : baseLabel;

        return {
          icon: (
            <DoneAllIcon
              sx={{ fontSize: size }}
            />
          ),
          label: detailed,
          tooltip: detailed,
        };
      }
    }
  }, [derivedStatus, readCount, size]);

  const content = (
    <Root
      className={className}
      clickable={false}
      sx={color ? { color } : undefined}
      data-conversation-id={conversationId}
      data-message-id={messageId}
      data-status={derivedStatus}
      data-latest={isLatestInConversation ? "true" : "false"}
    >
      {showIcon && icon}
      {showText && (
        <TextLabel component="span" noWrap>
          {label}
        </TextLabel>
      )}
    </Root>
  );

  if (disableTooltip) {
    return content;
  }

  return (
    <Tooltip title={tooltip} arrow placement="top">
      {content}
    </Tooltip>
  );
};

export default ReadReceiptIndicator;