import React, {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type MessageComposerProps = {
  /** WebSocket instance used to send messages and typing events */
  socket: WebSocket | null;
  /** ID of the current user */
  userId: string;
  /** ID of the currently selected conversation / room / channel */
  conversationId: string;
  /** Optional placeholder for the message input */
  placeholder?: string;
  /** Optional callback when a local message is about to be sent (before socket send) */
  onBeforeSend?: (payload: OutgoingMessagePayload) => void;
  /** Optional callback when message successfully sent over socket */
  onAfterSend?: (payload: OutgoingMessagePayload) => void;
  /** Optional callback for errors during send */
  onSendError?: (error: unknown) => void;
  /** Optional className for root container */
  className?: string;
  /** Optional disabled state for the composer (e.g. when socket not connected) */
  disabled?: boolean;
};

export type OutgoingMessagePayload = {
  type: "message";
  conversationId: string;
  senderId: string;
  text: string;
  attachments: string[];
  createdAt: string;
};

type TypingPayload = {
  type: "typing";
  conversationId: string;
  userId: string;
  isTyping: boolean;
  timestamp: string;
};

const TYPING_STOP_DELAY = 3000;

const MessageComposer: React.FC<MessageComposerProps> = ({
  socket,
  userId,
  conversationId,
  placeholder = "Type a message...",
  onBeforeSend,
  onAfterSend,
  onSendError,
  className = "",
  disabled = false,
}) => {
  const [text, setText] = useState<string>("");
  const [attachmentUrl, setAttachmentUrl] = useState<string>("");
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isTyping, setIsTyping] = useState<boolean>(false);

  const typingTimeoutRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const canSend = !disabled && !!socket && socket.readyState === WebSocket.OPEN;

  const clearTypingTimeout = () => {
    if (typingTimeoutRef.current !== null) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const sendOverSocket = (data: unknown) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    try {
      socket.send(JSON.stringify(data));
    } catch (error) {
      if (onSendError) onSendError(error);
    }
  };

  const emitTypingState = useCallback(
    (typing: boolean) => {
      const now = Date.now();
      if (!typing && now - lastTypingSentRef.current < 250) {
        // avoid rapid toggling; still send stop after grace period via timeout
        return;
      }
      lastTypingSentRef.current = now;

      const payload: TypingPayload = {
        type: "typing",
        conversationId,
        userId,
        isTyping: typing,
        timestamp: new Date().toISOString(),
      };
      sendOverSocket(payload);
    },
    [conversationId, userId]
  );

  const scheduleTypingStop = useCallback(() => {
    clearTypingTimeout();
    typingTimeoutRef.current = window.setTimeout(() => {
      setIsTyping(false);
      emitTypingState(false);
      typingTimeoutRef.current = null;
    }, TYPING_STOP_DELAY);
  }, [emitTypingState]);

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setText(value);

    const currentlyTyping = value.trim().length > 0;
    if (currentlyTyping && !isTyping) {
      setIsTyping(true);
      emitTypingState(true);
    }
    if (currentlyTyping) {
      scheduleTypingStop();
    } else {
      // user cleared input; stop typing immediately
      if (isTyping) {
        setIsTyping(false);
        emitTypingState(false);
      }
      clearTypingTimeout();
    }
  };

  const handleAttachmentInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAttachmentUrl(e.target.value);
  };

  const addAttachment = () => {
    const trimmed = attachmentUrl.trim();
    if (!trimmed) return;
    setAttachments((prev) => [...prev, trimmed]);
    setAttachmentUrl("");
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const resetComposer = () => {
    setText("");
    setAttachments([]);
    setAttachmentUrl("");
    setIsTyping(false);
    clearTypingTimeout();
    emitTypingState(false);
  };

  const handleSend = async () => {
    if (!canSend) return;
    const trimmedText = text.trim();
    const hasContent = trimmedText.length > 0 || attachments.length > 0;
    if (!hasContent) return;

    const payload: OutgoingMessagePayload = {
      type: "message",
      conversationId,
      senderId: userId,
      text: trimmedText,
      attachments,
      createdAt: new Date().toISOString(),
    };

    try {
      setIsSending(true);
      if (onBeforeSend) onBeforeSend(payload);
      await new Promise<void>((resolve, reject) => {
        try {
          sendOverSocket(payload);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
      if (onAfterSend) onAfterSend(payload);
      resetComposer();
    } catch (error) {
      if (onSendError) onSendError(error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void handleSend();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  useEffect(
    () => () => {
      clearTypingTimeout();
      if (isTyping) {
        emitTypingState(false);
      }
    },
    [emitTypingState, isTyping]
  );

  const rootClass = [
    "message-composer",
    "flex",
    "flex-col",
    "gap-2",
    "border-t",
    "border-gray-200",
    "bg-white",
    "p-3",
    "dark:border-gray-700",
    "dark:bg-gray-900",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const textareaDisabled = disabled || !socket || socket.readyState !== WebSocket.OPEN;

  return (
    <form className={rootClass} onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            placeholder={
              !socket || socket.readyState !== WebSocket.OPEN
                ? "Connecting..."
                : placeholder
            }
            disabled={textareaDisabled}
            rows={1}
            className="flex-1 resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <button
            type="submit"
            disabled={!canSend || isSending || (!text.trim() && attachments.length === 0)}
            className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300 dark:disabled:bg-gray-700"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <input
              type="url"
              value={attachmentUrl}
              onChange={handleAttachmentInputChange}
              placeholder="Paste image/file URL"
              className="flex-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-blue-400 dark:focus:ring-blue-400"
            />
            <button
              type="button"
              onClick={addAttachment}
              disabled={!attachmentUrl.trim()}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-gray-50 px-2.5 py-1.5 text-xs