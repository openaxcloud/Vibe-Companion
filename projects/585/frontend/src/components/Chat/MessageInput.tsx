import React, {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { v4 as uuidv4 } from "uuid";

type UploadedFile = {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
};

type TypingStatus = "idle" | "typing" | "paused";

export type MessageInputProps = {
  onSendMessage: (payload: {
    text: string;
    files: UploadedFile[];
  }) => Promise<void> | void;
  onTypingStart?: () => void;
  onTypingStop?: () => void;
  disabled?: boolean;
  maxLength?: number;
  maxFiles?: number;
  maxFileSizeMb?: number;
  placeholder?: string;
  isSubmitting?: boolean;
  /** Optional external value control (for controlled usage) */
  value?: string;
  /** Called when text input changes (for controlled usage) */
  onChangeText?: (value: string) => void;
};

const DEFAULT_MAX_LENGTH = 4000;
const DEFAULT_MAX_FILES = 5;
const DEFAULT_MAX_FILE_SIZE_MB = 25;

const TYPING_DEBOUNCE_MS = 300;
const TYPING_IDLE_TIMEOUT_MS = 4000;

const isImageFile = (file: File): boolean =>
  /^image\//i.test(file.type || "");

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
  return `undefined undefined`;
};

// Minimal emoji picker data; in a real app, consider an external library.
const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀",
      "😁",
      "😂",
      "🤣",
      "😊",
      "😍",
      "😘",
      "😜",
      "🤔",
      "😎",
      "😭",
      "😡",
    ],
  },
  {
    label: "Gestures",
    emojis: ["👍", "👎", "🙏", "👏", "👋", "👌", "🤝", "✌️"],
  },
  {
    label: "Symbols",
    emojis: ["❤️", "🔥", "⭐", "🎉", "✅", "❓", "⚠️"],
  },
];

export const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  onTypingStart,
  onTypingStop,
  disabled = false,
  maxLength = DEFAULT_MAX_LENGTH,
  maxFiles = DEFAULT_MAX_FILES,
  maxFileSizeMb = DEFAULT_MAX_FILE_SIZE_MB,
  placeholder = "Type a message...",
  isSubmitting = false,
  value,
  onChangeText,
}) => {
  const [internalText, setInternalText] = useState<string>("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isEmojiOpen, setIsEmojiOpen] = useState<boolean>(false);
  const [typingStatus, setTypingStatus] = useState<TypingStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const typingDebounceRef = useRef<number | null>(null);

  const text = value !== undefined ? value : internalText;
  const isControlled = value !== undefined && !!onChangeText;
  const isBusy = disabled || isSubmitting;

  const remainingChars = useMemo(
    () => maxLength - text.length,
    [maxLength, text.length]
  );

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const newHeight = Math.min(textareaRef.current.scrollHeight, 160);
      textareaRef.current.style.height = `undefinedpx`;
    }
  }, [text, files.length]);

  const updateText = useCallback(
    (next: string) => {
      if (next.length > maxLength) {
        next = next.slice(0, maxLength);
      }
      if (isControlled) {
        onChangeText?.(next);
      } else {
        setInternalText(next);
      }
    },
    [isControlled, maxLength, onChangeText]
  );

  const handleTypingStart = useCallback(() => {
    if (typingStatus === "idle") {
      setTypingStatus("typing");
      onTypingStart?.();
    } else if (typingStatus === "paused") {
      setTypingStatus("typing");
    }

    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      setTypingStatus("idle");
      onTypingStop?.();
      typingTimeoutRef.current = null;
    }, TYPING_IDLE_TIMEOUT_MS);
  }, [onTypingStart, onTypingStop, typingStatus]);

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    setError(null);

    if (typingDebounceRef.current) {
      window.clearTimeout(typingDebounceRef.current);
    }
    typingDebounceRef.current = window.setTimeout(
      handleTypingStart,
      TYPING_DEBOUNCE_MS
    );

    updateText(next);
  };

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (typingStatus !== "idle") {
      setTypingStatus("idle");
      onTypingStop?.();
    }
  }, [onTypingStop, typingStatus]);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }
      if (typingDebounceRef.current) {
        window.clearTimeout(typingDebounceRef.current);
      }
    };
  }, []);

  const resetInput = useCallback(() => {
    updateText("");
    setFiles((prev) => {
      prev.forEach((f) => {
        if (f.previewUrl && f.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(f.previewUrl);
        }
      });
      return [];
    });
    setError(null);
    stopTyping();
    setIsEmojiOpen(false);
  }, [stopTyping, updateText]);

  const validateFile = useCallback(
    (file: File): string | null => {
      const maxBytes = maxFileSizeMb * 1024 * 1024;
      if (file.size > maxBytes) {
        return `File "undefined" exceeds the size limit of undefined MB.`;
      }
      return null;
    },
    [maxFileSizeMb]
  );

  const handleFilesAdded = (event: ChangeEvent<HTMLInputElement>) => {
    const newFiles = event.target.files;
    if (!newFiles || newFiles.length === 0) return;

    const currentCount = files.length;
    const allowedCount = Math.max(0, maxFiles - currentCount);

    if (allowedCount <= 0) {
      setError(`You can attach up to undefined files per message.`);
      event.target.value = "";
      return;
    }

    const slice = Array.from(newFiles).slice(0, allowedCount);
    const next: UploadedFile[] = [];
    let firstError: string | null = null;

    slice.forEach((file) => {
      const maybeError = validateFile(file);
      if (maybeError && !firstError) {
        firstError = maybeError;
        return;
      }

      const withMeta: UploadedFile = {
        id: uuidv4(),
        file,
        name: file.name,
        size: file.size,
        type: file.type,
        previewUrl: isImageFile(file) ? URL.createObjectURL(file) : undefined,
      };
      next.push(withMeta);
    });

    if (firstError) {
      setError(firstError);
    } else {
      setError(null);
    }

    if (next.length > 0) {
      setFiles((prev) => [...prev, ...next]);
    }

    event.target.value = "";
  };

  const handleRemoveFile = (id: string) => {
    setFiles((prev) => {
      const target = prev.find((f) => f.id === id);
      if (target && target.previewUrl && target.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const handleEmojiToggle = () => {
    setIsEmojiOpen((open) => !open);
  };

  const handleEmojiSelect = (emoji: