import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface DMParticipant {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  lastSeenAt?: string | null;
}

export interface DMMessagePreview {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface DirectConversation {
  id: string;
  participantIds: string[];
  participants?: DMParticipant[];
  lastMessage?: DMMessagePreview | null;
  createdAt: string;
  updatedAt: string;
  unreadCount: number;
}

export interface ListDMsQuery {
  cursor?: string | null;
  limit?: number;
}

export interface ListDMsResponse {
  conversations: DirectConversation[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface StartDMRequest {
  participantIds: string[];
  initialMessage?: string;
}

export interface StartDMResponse {
  conversation: DirectConversation;
}

export interface GetDMParticipantsResponse {
  conversationId: string;
  participants: DMParticipant[];
}

export interface ApiErrorDetail {
  message: string;
  code?: string;
  field?: string;
}

export interface ApiErrorResponse {
  status: number;
  error: string;
  message: string;
  details?: ApiErrorDetail[] | null;
}

export type DMApiError = ApiErrorResponse;

export interface DMApiConfig {
  baseURL?: string;
  getAuthToken?: () => string | null | undefined;
  axiosInstance?: AxiosInstance;
}

const DEFAULT_BASE_URL = "/api";

const createAxiosInstance = (config: DMApiConfig): AxiosInstance => {
  if (config.axiosInstance) return config.axiosInstance;

  const instance = axios.create({
    baseURL: config.baseURL || DEFAULT_BASE_URL,
    withCredentials: true,
  });

  instance.interceptors.request.use((requestConfig) => {
    if (config.getAuthToken) {
      const token = config.getAuthToken();
      if (token) {
        requestConfig.headers = requestConfig.headers || {};
        requestConfig.headers.Authorization = `Bearer undefined`;
      }
    }
    return requestConfig;
  });

  return instance;
};

const mapAxiosErrorToApiError = (error: unknown): DMApiError => {
  if (axios.isAxiosError(error)) {
    const response = error.response;
    if (response && response.data) {
      const data = response.data as Partial<ApiErrorResponse>;
      return {
        status: response.status,
        error: data.error || "UnknownError",
        message: data.message || "An unexpected error occurred",
        details: data.details ?? null,
      };
    }
    return {
      status: response?.status ?? 0,
      error: "NetworkOrServerError",
      message:
        error.message || "A network or server error occurred while contacting the API",
      details: null,
    };
  }

  return {
    status: 0,
    error: "UnknownError",
    message: "An unknown error occurred",
    details: null,
  };
};

export class DMApiClient {
  private axios: AxiosInstance;

  constructor(private readonly config: DMApiConfig = {}) {
    this.axios = createAxiosInstance(config);
  }

  private async request<T = unknown>(
    url: string,
    method: AxiosRequestConfig["method"],
    data?: unknown,
    params?: Record<string, unknown>
  ): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.axios.request<T>({
        url,
        method,
        data,
        params,
      });
      return response.data;
    } catch (error) {
      throw mapAxiosErrorToApiError(error);
    }
  }

  async listDirectConversations(
    query: ListDMsQuery = {}
  ): Promise<ListDMsResponse> {
    const params: Record<string, unknown> = {};
    if (query.cursor != null) params.cursor = query.cursor;
    if (typeof query.limit === "number") params.limit = query.limit;

    return this.request<ListDMsResponse>("/dm/conversations", "GET", undefined, params);
  }

  async startDirectMessage(request: StartDMRequest): Promise<StartDMResponse> {
    if (!request.participantIds || request.participantIds.length === 0) {
      throw {
        status: 400,
        error: "ValidationError",
        message: "At least one participantId is required to start a direct message",
        details: [
          {
            field: "participantIds",
            message: "participantIds array must contain at least one user id",
            code: "REQUIRED",
          },
        ],
      } as DMApiError;
    }

    return this.request<StartDMResponse>("/dm/conversations", "POST", request);
  }

  async getConversationParticipants(
    conversationId: string
  ): Promise<GetDMParticipantsResponse> {
    if (!conversationId) {
      throw {
        status: 400,
        error: "ValidationError",
        message: "conversationId is required",
        details: [
          {
            field: "conversationId",
            message: "conversationId must be a non-empty string",
            code: "REQUIRED",
          },
        ],
      } as DMApiError;
    }

    const url = `/dm/conversations/undefined/participants`;
    return this.request<GetDMParticipantsResponse>(url, "GET");
  }
}

let defaultClient: DMApiClient | null = null;

const getDefaultClient = (): DMApiClient => {
  if (!defaultClient) {
    defaultClient = new DMApiClient();
  }
  return defaultClient;
};

export const listDirectConversations = (
  query?: ListDMsQuery
): Promise<ListDMsResponse> => {
  return getDefaultClient().listDirectConversations(query);
};

export const startDirectMessage = (
  request: StartDMRequest
): Promise<StartDMResponse> => {
  return getDefaultClient().startDirectMessage(request);
};

export const getConversationParticipants = (
  conversationId: string
): Promise<GetDMParticipantsResponse> => {
  return getDefaultClient().getConversationParticipants(conversationId);
};

export default DMApiClient;