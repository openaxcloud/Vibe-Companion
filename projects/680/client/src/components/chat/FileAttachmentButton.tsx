import React, {
  ChangeEvent,
  ClipboardEvent,
  MouseEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { uploadApi } from "../../services/uploadApi";

export interface FileAttachment {
  type: "file" | "imageUrl";
  url: string;
  name?: string;
  size?: number;
  mimeType?: string;
}

export interface FileAttachmentButtonProps {
  onAttachmentAdded: (attachment: FileAttachment) => void;
  disabled?: boolean;
  className?: string;
}

/**
 * FileAttachmentButton
 *
 * UI control in the composer that lets users:
 * - Select a file from disk
 * - Paste an image URL
 * Uses uploadApi to obtain a shareable URL and attaches it to the pending message.
 */
const FileAttachmentButton: React.FC<FileAttachmentButtonProps> = ({
  onAttachmentAdded,
  disabled = false,
  className = "",
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isUrlMode, setIsUrlMode] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleButtonClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (disabled || isUploading) return;
      if (isUrlMode) {
        setIsUrlMode(false);
        setUrlInput("");
        setError(null);
        return;
      }
      if (fileInputRef.current) {
        fileInputRef.current.click();
      }
    },
    [disabled, isUploading, isUrlMode]
  );

  const validateImageUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url);
      if (!/^https?:$/.test(parsed.protocol)) return false;
      const path = parsed.pathname.toLowerCase();
      return (
        path.endsWith(".png") ||
        path.endsWith(".jpg") ||
        path.endsWith(".jpeg") ||
        path.endsWith(".gif") ||
        path.endsWith(".webp") ||
        path.endsWith(".bmp") ||
        path.endsWith(".svg") ||
        path.endsWith(".heic") ||
        path.endsWith(".heif")
      );
    } catch {
      return false;
    }
  };

  const handlePaste = useCallback(
    (event: ClipboardEvent<HTMLInputElement>) => {
      if (!isUrlMode) return;
      const text = event.clipboardData.getData("text/plain");
      if (text && validateImageUrl(text.trim())) {
        setUrlInput(text.trim());
        setError(null);
      }
    },
    [isUrlMode]
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (disabled) return;

      setError(null);
      setIsUploading(true);
      try {
        const uploadedUrl = await uploadApi.uploadFile(file);
        onAttachmentAdded({
          type: "file",
          url: uploadedUrl,
          name: file.name,
          size: file.size,
          mimeType: file.type,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to upload file. Please try again."
        );
      } finally {
        setIsUploading(false);
      }
    },
    [disabled, onAttachmentAdded]
  );

  const handleUrlSubmit = useCallback(async () => {
    const trimmed = urlInput.trim();
    if (!trimmed) {
      setError("Please enter an image URL.");
      return;
    }
    if (!validateImageUrl(trimmed)) {
      setError("Please enter a valid direct image URL (e.g., ending in .png).");
      return;
    }

    if (disabled) return;

    setError(null);
    setIsUploading(true);
    try {
      const uploadedUrl = await uploadApi.uploadImageUrl(trimmed);
      onAttachmentAdded({
        type: "imageUrl",
        url: uploadedUrl,
      });
      setUrlInput("");
      setIsUrlMode(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to attach image URL. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  }, [disabled, onAttachmentAdded, urlInput]);

  const handleUrlModeToggle = useCallback(() => {
    if (disabled || isUploading) return;
    setIsUrlMode((prev) => !prev);
    setError(null);
    setUrlInput("");
  }, [disabled, isUploading]);

  return (
    <div className={`file-attachment-control undefined`.trim()}>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: "none" }}
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="file-attachment-main">
        <button
          type="button"
          className="file-attachment-button"
          onClick={handleButtonClick}
          disabled={disabled || isUploading}
          aria-label="Attach a file"
          title="Attach a file"
        >
          <span className="file-attachment-icon" aria-hidden="true">
            📎
          </span>
        </button>
        <button
          type="button"
          className={`file-attachment-url-toggle undefined`.trim()}
          onClick={handleUrlModeToggle}
          disabled={disabled || isUploading}
          aria-pressed={isUrlMode}
          title="Attach image from URL"
        >
          <span aria-hidden="true">🌐</span>
        </button>
      </div>
      {isUrlMode && (
        <div className="file-attachment-url-panel">
          <input
            type="url"
            className="file-attachment-url-input"
            placeholder="Paste image URL (https://...)"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              if (error) setError(null);
            }}
            onPaste={handlePaste}
            disabled={disabled || isUploading}
          />
          <button
            type="button"
            className="file-attachment-url-submit"
            onClick={handleUrlSubmit}
            disabled={disabled || isUploading}
          >
            {isUploading ? "Attaching..." : "Attach"}
          </button>
        </div>
      )}
      {error && (
        <div className="file-attachment-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
};

export default FileAttachmentButton;