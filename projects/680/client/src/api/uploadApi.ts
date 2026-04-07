import axios, { AxiosInstance, AxiosRequestConfig } from "axios";

export interface UploadApiConfig {
  baseURL?: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface UploadResult {
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface UploadProgressEvent {
  loaded: number;
  total?: number;
  progress: number; // 0 - 1
}

export interface UploadOptions {
  signal?: AbortSignal;
  onProgress?: (event: UploadProgressEvent) => void;
  extraFields?: Record<string, string | number | boolean | null | undefined>;
  /**
   * If true, only file metadata will be sent without the binary data.
   * Requires backend support for metadata-only uploads.
   */
  metadataOnly?: boolean;
}

export interface FileMetadata {
  name: string;
  size: number;
  type: string;
  lastModified?: number;
  width?: number;
  height?: number;
  duration?: number;
  [key: string]: unknown;
}

export interface BlobLike {
  size: number;
  type: string;
  slice(start?: number, end?: number, contentType?: string): Blob;
}

export type UploadableFile = File | Blob | BlobLike;

let axiosInstance: AxiosInstance | null = null;

const DEFAULT_CONFIG: Required<Pick<UploadApiConfig, "timeout">> = {
  timeout: 60_000, // 60s for potentially large uploads
};

function createAxiosInstance(config?: UploadApiConfig): AxiosInstance {
  const instance = axios.create({
    baseURL:
      config?.baseURL ??
      (typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000"),
    timeout: config?.timeout ?? DEFAULT_CONFIG.timeout,
    headers: {
      ...(config?.headers ?? {}),
    },
    withCredentials: true,
  });

  return instance;
}

export function initUploadApi(config?: UploadApiConfig): void {
  axiosInstance = createAxiosInstance(config);
}

function getAxiosInstance(): AxiosInstance {
  if (!axiosInstance) {
    axiosInstance = createAxiosInstance();
  }
  return axiosInstance;
}

function buildFormData(
  file: UploadableFile | null,
  metadata: FileMetadata,
  options?: UploadOptions
): FormData {
  const formData = new FormData();

  if (file && !options?.metadataOnly) {
    const fileName = metadata.name || "upload";
    const blobLike = file as Blob;
    formData.append("file", blobLike, fileName);
  }

  formData.append("metadata", JSON.stringify(metadata));

  if (options?.extraFields) {
    Object.entries(options.extraFields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });
  }

  if (options?.metadataOnly) {
    formData.append("metadataOnly", "true");
  }

  return formData;
}

function extractProgressEvent(progressEvent: ProgressEvent): UploadProgressEvent {
  const { loaded, total } = progressEvent;
  const progress =
    typeof total === "number" && total > 0 ? loaded / total : 0;
  return {
    loaded,
    total: typeof total === "number" ? total : undefined,
    progress,
  };
}

/**
 * Upload a file or blob to the backend upload endpoint.
 * Returns the file URL and additional metadata from the server.
 */
export async function uploadFile(
  file: UploadableFile,
  metadata: FileMetadata,
  options?: UploadOptions
): Promise<UploadResult> {
  const axiosClient = getAxiosInstance();
  const endpoint = "/api/upload";

  const formData = buildFormData(file, metadata, options);

  const config: AxiosRequestConfig<FormData> = {
    method: "POST",
    url: endpoint,
    data: formData,
    signal: options?.signal,
    headers: {
      "Content-Type": "multipart/form-data",
    },
    onUploadProgress: (event: ProgressEvent) => {
      if (options?.onProgress) {
        options.onProgress(extractProgressEvent(event));
      }
    },
  };

  const response = await axiosClient.request<UploadResult>(config);

  if (!response.data || typeof response.data.url !== "string") {
    throw new Error("Invalid upload response: missing file URL");
  }

  return response.data;
}

/**
 * Send only file metadata to the backend (no binary data).
 * Useful when the file is already hosted or handled elsewhere.
 */
export async function uploadMetadata(
  metadata: FileMetadata,
  options?: UploadOptions
): Promise<UploadResult> {
  const axiosClient = getAxiosInstance();
  const endpoint = "/api/upload/metadata";

  const payload = {
    metadata,
    ...(options?.extraFields ?? {}),
  };

  const config: AxiosRequestConfig = {
    method: "POST",
    url: endpoint,
    data: payload,
    signal: options?.signal,
    headers: {
      "Content-Type": "application/json",
    },
  };

  const response = await axiosClient.request<UploadResult>(config);

  if (!response.data || typeof response.data.url !== "string") {
    throw new Error("Invalid metadata upload response: missing file URL");
  }

  return response.data;
}

/**
 * Convenience helper: upload using a File object directly.
 */
export async function uploadBrowserFile(
  file: File,
  options?: UploadOptions
): Promise<UploadResult> {
  const metadata: FileMetadata = {
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
  };

  return uploadFile(file, metadata, options);
}

/**
 * Convenience helper: upload a Blob with minimal metadata.
 */
export async function uploadBlob(
  blob: Blob,
  fileName: string,
  options?: UploadOptions
): Promise<UploadResult> {
  const metadata: FileMetadata = {
    name: fileName,
    size: blob.size,
    type: blob.type || "application/octet-stream",
  };

  return uploadFile(blob, metadata, options);
}