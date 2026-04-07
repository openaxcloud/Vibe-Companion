import { useCallback, useRef, useState } from "react";

export type UploadStatus = "idle" | "uploading" | "success" | "error";

export interface UseFileUploadOptions<TResponse = unknown> {
  /**
   * Function responsible for performing the actual upload.
   * Should return a Promise and can optionally accept a progress callback.
   */
  uploadFn: (
    file: File,
    options?: {
      onProgress?: (progress: number) => void;
      signal?: AbortSignal;
    }
  ) => Promise<TResponse>;

  /**
   * Optional callback invoked when upload succeeds.
   */
  onSuccess?: (response: TResponse, file: File) => void;

  /**
   * Optional callback invoked when upload fails.
   */
  onError?: (error: unknown, file: File | null) => void;

  /**
   * Optional callback invoked on upload progress updates (0-100).
   */
  onProgress?: (progress: number, file: File) => void;

  /**
   * Optional validation function for files before upload.
   * Should throw or return false/err message if invalid.
   */
  validateFile?: (file: File) => void | string | boolean;

  /**
   * Whether to reset state automatically after success.
   * If true, state will reset to idle after `autoResetDelay` ms.
   */
  autoResetOnSuccess?: boolean;

  /**
   * Delay (ms) before auto-resetting after a successful upload.
   */
  autoResetDelay?: number;
}

export interface UseFileUploadState<TResponse = unknown> {
  status: UploadStatus;
  progress: number;
  error: string | null;
  file: File | null;
  response: TResponse | null;
  isUploading: boolean;
  isIdle: boolean;
  isError: boolean;
  isSuccess: boolean;
}

export interface UseFileUploadReturn<TResponse = unknown>
  extends UseFileUploadState<TResponse> {
  uploadFile: (file: File | null | undefined) => Promise<void>;
  reset: () => void;
  cancel: () => void;
}

const DEFAULT_AUTO_RESET_DELAY = 2000;

export function useFileUpload<TResponse = unknown>(
  options: UseFileUploadOptions<TResponse>
): UseFileUploadReturn<TResponse> {
  const {
    uploadFn,
    onSuccess,
    onError,
    onProgress,
    validateFile,
    autoResetOnSuccess = false,
    autoResetDelay = DEFAULT_AUTO_RESET_DELAY,
  } = options;

  const [status, setStatus] = useState<UploadStatus>("idle");
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [response, setResponse] = useState<TResponse | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const autoResetTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const clearAutoResetTimeout = useCallback(() => {
    if (autoResetTimeoutRef.current !== null) {
      window.clearTimeout(autoResetTimeoutRef.current);
      autoResetTimeoutRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearAutoResetTimeout();
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    if (!isMountedRef.current) return;

    setStatus("idle");
    setProgress(0);
    setError(null);
    setFile(null);
    setResponse(null);
  }, [clearAutoResetTimeout]);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const uploadFile = useCallback(
    async (inputFile: File | null | undefined): Promise<void> => {
      if (!inputFile) {
        setError("No file provided");
        setStatus("error");
        return;
      }

      clearAutoResetTimeout();

      // Cancel any ongoing upload
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Validate file if validator provided
      if (validateFile) {
        try {
          const validationResult = validateFile(inputFile);
          if (validationResult === false) {
            setError("Invalid file");
            setStatus("error");
            return;
          }
          if (typeof validationResult === "string" && validationResult.trim()) {
            setError(validationResult);
            setStatus("error");
            return;
          }
        } catch (validationError) {
          const message =
            validationError instanceof Error
              ? validationError.message
              : "File validation failed";
          setError(message);
          setStatus("error");
          return;
        }
      }

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      setStatus("uploading");
      setProgress(0);
      setError(null);
      setFile(inputFile);
      setResponse(null);

      try {
        const handleProgress = (value: number) => {
          if (!isMountedRef.current) return;
          const clamped = Math.max(0, Math.min(100, value));
          setProgress(clamped);
          if (onProgress) {
            onProgress(clamped, inputFile);
          }
        };

        const result = await uploadFn(inputFile, {
          onProgress: handleProgress,
          signal: abortController.signal,
        });

        if (!isMountedRef.current) return;
        setResponse(result);
        setStatus("success");
        setProgress((prev) => (prev < 100 ? 100 : prev));

        if (onSuccess) {
          onSuccess(result, inputFile);
        }

        if (autoResetOnSuccess) {
          clearAutoResetTimeout();
          autoResetTimeoutRef.current = window.setTimeout(() => {
            if (!isMountedRef.current) return;
            reset();
          }, autoResetDelay) as unknown as number;
        }
      } catch (err: unknown) {
        if (!isMountedRef.current) return;

        // If aborted, treat as cancellation but don't set error
        if (abortController.signal.aborted) {
          setStatus("idle");
          setProgress(0);
          return;
        }

        const message =
          err instanceof Error
            ? err.message
            : typeof err === "string"
            ? err
            : "File upload failed";

        setError(message);
        setStatus("error");

        if (onError) {
          onError(err, inputFile);
        }
      } finally {
        if (abortControllerRef.current === abortController) {
          abortControllerRef.current = null;
        }
      }
    },
    [
      uploadFn,
      onSuccess,
      onError,
      onProgress,
      validateFile,
      autoResetOnSuccess,
      autoResetDelay,
      clearAutoResetTimeout,
      reset,
    ]
  );

  // Track mount/unmount
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useState(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      clearAutoResetTimeout();
      abortControllerRef.current?.abort();
    };
  });

  const state: UseFileUploadState<TResponse> = {
    status,
    progress,
    error,
    file,
    response,
    isUploading: status === "uploading",
    isIdle: status === "idle",
    isError: status === "error",
    isSuccess: status === "success",
  };

  return {
    ...state,
    uploadFile,
    reset,
    cancel,
  };
}

export default useFileUpload;