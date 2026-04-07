import React, {
  FC,
  useCallback,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
  DragEvent,
} from "react";

export type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UploadFile {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  previewUrl?: string;
  progress: number;
  status: UploadStatus;
  error?: string;
}

export interface FileUploaderProps {
  multiple?: boolean;
  accept?: string;
  maxSizeBytes?: number;
  maxFiles?: number;
  disabled?: boolean;
  onFilesChange?: (files: UploadFile[]) => void;
  onUpload?: (file: UploadFile, onProgress: (progress: number) => void) => Promise<void>;
  onUploadComplete?: (files: UploadFile[]) => void;
  showUploadButton?: boolean;
  showFileSize?: boolean;
  showFileType?: boolean;
  className?: string;
  dropzoneClassName?: string;
  fileListClassName?: string;
  autoUpload?: boolean;
  locale?: {
    title?: string;
    description?: string;
    browse?: string;
    orDragAndDrop?: string;
    upload?: string;
    clearAll?: string;
    maxFilesReached?: string;
    invalidFileType?: string;
    fileTooLarge?: string;
    removeFile?: string;
    retry?: string;
    uploading?: string;
    success?: string;
    error?: string;
    of?: string;
  };
}

const DEFAULT_LOCALE: Required<FileUploaderProps["locale"]> = {
  title: "Upload files",
  description: "Attach one or more files by dragging and dropping, or browsing.",
  browse: "Browse",
  orDragAndDrop: "or drag and drop",
  upload: "Upload",
  clearAll: "Clear all",
  maxFilesReached: "Maximum number of files reached",
  invalidFileType: "Invalid file type",
  fileTooLarge: "File is too large",
  removeFile: "Remove",
  retry: "Retry",
  uploading: "Uploading",
  success: "Uploaded",
  error: "Error",
  of: "of",
};

const MAX_DEFAULT_SIZE = 20 * 1024 * 1024; // 20MB

const formatBytes = (bytes: number): string => {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = Number((bytes / Math.pow(k, i)).toFixed(2));
  return `undefined undefined`;
};

const isImageFile = (file: File): boolean => file.type.startsWith("image/");

const generateId = (): string => `undefined-undefined`;

const readImagePreview = (file: File): Promise<string | undefined> =>
  new Promise((resolve) => {
    if (!isImageFile(file)) {
      resolve(undefined);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : undefined);
    reader.onerror = () => resolve(undefined);
    reader.readAsDataURL(file);
  });

const stopEvent = (e: DragEvent<HTMLElement>) => {
  e.preventDefault();
  e.stopPropagation();
};

const FileUploader: FC<FileUploaderProps> = ({
  multiple = true,
  accept,
  maxSizeBytes = MAX_DEFAULT_SIZE,
  maxFiles,
  disabled = false,
  onFilesChange,
  onUpload,
  onUploadComplete,
  showUploadButton = true,
  showFileSize = true,
  showFileType = true,
  className = "",
  dropzoneClassName = "",
  fileListClassName = "",
  autoUpload = false,
  locale,
}) => {
  const mergedLocale = useMemo(
    () => ({
      ...DEFAULT_LOCALE,
      ...(locale || {}),
    }),
    [locale]
  );

  const [files, setFiles] = useState<UploadFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploadingAll, setIsUploadingAll] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const canAddMoreFiles = useMemo(() => {
    if (typeof maxFiles !== "number") return true;
    return files.length < maxFiles;
  }, [files.length, maxFiles]);

  const safeSetFiles = useCallback(
    (updater: (prev: UploadFile[]) => UploadFile[]) => {
      setFiles((prev) => {
        const next = updater(prev);
        if (onFilesChange) {
          onFilesChange(next);
        }
        return next;
      });
    },
    [onFilesChange]
  );

  const handleFilesSelected = useCallback(
    async (selected: FileList | null) => {
      if (!selected || disabled) return;

      const fileArray = Array.from(selected);
      let remainingSlots = typeof maxFiles === "number" ? maxFiles - files.length : Infinity;
      if (remainingSlots <= 0) {
        return;
      }

      const nextFiles: UploadFile[] = [];

      for (const file of fileArray) {
        if (remainingSlots <= 0) break;

        if (accept) {
          const mimeTypes = accept
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);

          const isAccepted = mimeTypes.some((pattern) => {
            if (pattern.startsWith(".")) {
              return file.name.toLowerCase().endsWith(pattern.toLowerCase());
            }
            if (pattern.endsWith("/*")) {
              const base = pattern.replace("/*", "");
              return file.type.startsWith(base);
            }
            return file.type === pattern;
          });

          if (!isAccepted) {
            // eslint-disable-next-line no-console
            console.warn(`undefined: undefined`);
            continue;
          }
        }

        if (file.size > maxSizeBytes) {
          // eslint-disable-next-line no-console
          console.warn(`undefined: undefined`);
          continue;
        }

        const previewUrl = await readImagePreview(file);

        nextFiles.push({
          id: generateId(),
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          previewUrl,
          progress: 0,
          status: "idle",
        });

        remainingSlots -= 1;
      }

      if (!nextFiles.length) return;

      safeSetFiles((prev) => [...prev, ...nextFiles]);

      if (autoUpload && onUpload) {
        for (const f of nextFiles) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          handleUploadSingle(f.id);
        }
      }
    },
    [
      accept,
      autoUpload,
      disabled,
      files.length,
      handleFilesSelected,
      maxFiles,
      maxSizeBytes,
      mergedLocale.fileTooLarge,
      mergedLocale.invalidFileType,
      onUpload,
      safeSetFiles,
    ]
  );

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      handleFilesSelected(e.target.files);
      e.target.value = "";
    },
    [handleFilesSelected]
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      stopEvent(e);
      if (disabled) return;
      setIsDragging(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      const items = dt.files;
      if (!items || !items.length) return;
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      handleFilesSelected(items);
    },
    [disabled, handleFilesSelected]
  );

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      stopEvent(e);
      if (disabled) return;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      stopEvent(e);
      if (disabled) return;
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    stopEvent(e);
    setIsDragging(false);
  }, []);

  const handleBrowseClick = useCallback(() => {
    if (disabled) return;
    if (inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);

  const updateFile = useCallback(
    (id: string, updater: (file: UploadFile) => UploadFile) => {
      safeSetFiles((prev) => prev.map((f) => (f.id === id ? updater(f) : f)));
    },
    [safeSetFiles]
  );

  const handleRemoveFile = useCallback(
    (id: string) => {
      safeSetFiles((prev) => prev.filter((f) => f.id !== id));
    },
    [safeSetFiles]
  );

  const handle