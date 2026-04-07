import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface MessageAuthor {
  id: string;
  username: string;
  displayName?: string | null;
  avatarUrl?: string | null;
}

export interface MessageAttachment {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  thumbnailUrl?: string | null;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reactedUserIds: string[];
}

export interface BaseMessage {
  id: string;
  channelId: string | null;
  dmId: string | null;
  author: MessageAuthor;
  content: string;
  createdAt: string;
  updatedAt?: string | null;
  isEdited: boolean;
  parentId?: string | null;
  threadRootId?: string | null;
  attachments: MessageAttachment[];
  reactions: MessageReaction[];
  isSystemMessage?: boolean;
  systemType?: string | null;
}

export interface ThreadSummary {
  rootMessageId: string;
  replyCount: number;
  lastReplyAt?: string | null;
}

export interface PaginatedMessagesResponse {
  items: BaseMessage[];
  nextCursor?: string | null;
  prevCursor?: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ThreadMessagesResponse {
  root: BaseMessage;
  replies: BaseMessage[];
}

export interface CreateMessagePayload {
  content: string;
  attachments?: File[];
  tempId?: string;
  parentId?: string | null;
  threadRootId?: string | null;
}

export interface CreateMessageRequestBody {
  content: string;
  parentId?: string | null;
  threadRootId?: string | null;
}

export interface CreateMessageResponse {
  message: BaseMessage;
}

export interface MessageApiConfig {
  baseURL: string;
  getAuthToken: () => string | null;
  timeoutMs?: number;
}

export interface FetchMessagesParams {
  limit?: number;
  cursor?: string | null;
  before?: string | null;
  after?: string | null;
}

export class MessageApi {
  private http: AxiosInstance;
  private getAuthToken: () => string | null;

  constructor(config: MessageApiConfig) {
    this.getAuthToken = config.getAuthToken;

    this.http = axios.create({
      baseURL: config.baseURL.replace(/\/+$/, ""),
      timeout: config.timeoutMs ?? 15000,
    });

    this.http.interceptors.request.use((cfg: AxiosRequestConfig) => {
      const token = this.getAuthToken();
      if (token) {
        cfg.headers = cfg.headers ?? {};
        cfg.headers.Authorization = `Bearer undefined`;
      }
      return cfg;
    });
  }

  async fetchChannelMessages(
    channelId: string,
    params: FetchMessagesParams = {}
  ): Promise<PaginatedMessagesResponse> {
    const query: Record<string, string | number | boolean> = {};

    if (params.limit != null) query.limit = params.limit;
    if (params.cursor) query.cursor = params.cursor;
    if (params.before) query.before = params.before;
    if (params.after) query.after = params.after;

    const response: AxiosResponse<PaginatedMessagesResponse> = await this.http.get(
      `/channels/undefined/messages`,
      { params: query }
    );

    return response.data;
  }

  async fetchDmMessages(
    dmId: string,
    params: FetchMessagesParams = {}
  ): Promise<PaginatedMessagesResponse> {
    const query: Record<string, string | number | boolean> = {};

    if (params.limit != null) query.limit = params.limit;
    if (params.cursor) query.cursor = params.cursor;
    if (params.before) query.before = params.before;
    if (params.after) query.after = params.after;

    const response: AxiosResponse<PaginatedMessagesResponse> = await this.http.get(
      `/dms/undefined/messages`,
      { params: query }
    );

    return response.data;
  }

  async fetchMessageThread(messageId: string): Promise<ThreadMessagesResponse> {
    const response: AxiosResponse<ThreadMessagesResponse> = await this.http.get(
      `/messages/undefined/thread`
    );

    return response.data;
  }

  async createChannelMessage(
    channelId: string,
    payload: CreateMessagePayload
  ): Promise<CreateMessageResponse> {
    const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0;

    if (!hasAttachments) {
      const body: CreateMessageRequestBody = {
        content: payload.content,
        parentId: payload.parentId ?? undefined,
        threadRootId: payload.threadRootId ?? undefined,
      };

      const response: AxiosResponse<CreateMessageResponse> = await this.http.post(
        `/channels/undefined/messages`,
        body
      );
      return response.data;
    }

    const formData = new FormData();
    formData.append("content", payload.content);
    if (payload.parentId) formData.append("parentId", payload.parentId);
    if (payload.threadRootId) formData.append("threadRootId", payload.threadRootId);

    payload.attachments!.forEach((file, index) => {
      formData.append("attachments", file, file.name || `file-undefined`);
    });

    const response: AxiosResponse<CreateMessageResponse> = await this.http.post(
      `/channels/undefined/messages`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  }

  async createDmMessage(dmId: string, payload: CreateMessagePayload): Promise<CreateMessageResponse> {
    const hasAttachments = Array.isArray(payload.attachments) && payload.attachments.length > 0;

    if (!hasAttachments) {
      const body: CreateMessageRequestBody = {
        content: payload.content,
        parentId: payload.parentId ?? undefined,
        threadRootId: payload.threadRootId ?? undefined,
      };

      const response: AxiosResponse<CreateMessageResponse> = await this.http.post(
        `/dms/undefined/messages`,
        body
      );
      return response.data;
    }

    const formData = new FormData();
    formData.append("content", payload.content);
    if (payload.parentId) formData.append("parentId", payload.parentId);
    if (payload.threadRootId) formData.append("threadRootId", payload.threadRootId);

    payload.attachments!.forEach((file, index) => {
      formData.append("attachments", file, file.name || `file-undefined`);
    });

    const response: AxiosResponse<CreateMessageResponse> = await this.http.post(
      `/dms/undefined/messages`,
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data;
  }
}

let defaultMessageApi: MessageApi | null = null;

export const initMessageApi = (config: MessageApiConfig): MessageApi => {
  defaultMessageApi = new MessageApi(config);
  return defaultMessageApi;
};

export const getMessageApi = (): MessageApi => {
  if (!defaultMessageApi) {
    throw new Error("MessageApi has not been initialized. Call initMessageApi first.");
  }
  return defaultMessageApi;
};