import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";

export interface Channel {
  id: string;
  name: string;
  description?: string | null;
  isPrivate: boolean;
  isDirect: boolean;
  createdAt: string;
  updatedAt: string;
  ownerId: string;
  memberCount: number;
  lastMessageAt?: string | null;
}

export interface ChannelMember {
  id: string;
  userId: string;
  channelId: string;
  role: "owner" | "admin" | "member";
  joinedAt: string;
  lastReadAt?: string | null;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ChannelCreateInput {
  name: string;
  description?: string;
  isPrivate?: boolean;
  memberIds?: string[];
}

export interface DirectChannelCreateInput {
  participantUserIds: string[];
}

export interface ChannelUpdateInput {
  name?: string;
  description?: string | null;
  isPrivate?: boolean;
}

export interface ChannelQueryParams {
  search?: string;
  includePrivate?: boolean;
  includeDirect?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "name" | "lastMessageAt";
  sortOrder?: "asc" | "desc";
}

export interface ChannelMembersQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  roles?: Array<ChannelMember["role"]>;
}

export interface ChannelServiceConfig {
  baseURL?: string;
  axiosInstance?: AxiosInstance;
  getAuthToken?: () => string | null | Promise<string | null>;
  defaultPageSize?: number;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

class ChannelService {
  private axios: AxiosInstance;
  private getAuthToken?: ChannelServiceConfig["getAuthToken"];
  private defaultPageSize: number;

  constructor(config: ChannelServiceConfig = {}) {
    this.axios =
      config.axiosInstance ??
      axios.create({
        baseURL: config.baseURL ?? "/api",
        timeout: 15000,
      });

    this.getAuthToken = config.getAuthToken;
    this.defaultPageSize = config.defaultPageSize ?? 25;

    this.axios.interceptors.request.use(async (requestConfig: AxiosRequestConfig) => {
      if (this.getAuthToken) {
        const token = await this.getAuthToken();
        if (token) {
          requestConfig.headers = requestConfig.headers ?? {};
          requestConfig.headers.Authorization = `Bearer undefined`;
        }
      }
      return requestConfig;
    });
  }

  private async request<T>(
    method: HttpMethod,
    url: string,
    config: AxiosRequestConfig = {}
  ): Promise<T> {
    const requestConfig: AxiosRequestConfig = {
      method,
      url,
      ...config,
    };

    const response: AxiosResponse<T> = await this.axios.request<T>(requestConfig);
    return response.data;
  }

  async listChannels(params: ChannelQueryParams = {}): Promise<PaginatedResult<Channel>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? this.defaultPageSize;

    return this.request<PaginatedResult<Channel>>("GET", "/channels", {
      params: {
        search: params.search,
        includePrivate: params.includePrivate,
        includeDirect: params.includeDirect,
        page,
        pageSize,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
      },
    });
  }

  async getChannelById(channelId: string): Promise<Channel> {
    if (!channelId) {
      throw new Error("channelId is required");
    }
    return this.request<Channel>("GET", `/channels/undefined`);
  }

  async createChannel(input: ChannelCreateInput): Promise<Channel> {
    if (!input?.name?.trim()) {
      throw new Error("Channel name is required");
    }

    const payload: ChannelCreateInput = {
      name: input.name.trim(),
      description: input.description?.trim(),
      isPrivate: input.isPrivate ?? false,
      memberIds: input.memberIds,
    };

    return this.request<Channel>("POST", "/channels", { data: payload });
  }

  async createDirectChannel(input: DirectChannelCreateInput): Promise<Channel> {
    if (!input?.participantUserIds || input.participantUserIds.length < 2) {
      throw new Error("At least two participantUserIds are required for direct channel");
    }

    return this.request<Channel>("POST", "/channels/direct", { data: input });
  }

  async updateChannel(channelId: string, input: ChannelUpdateInput): Promise<Channel> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    return this.request<Channel>("PATCH", `/channels/undefined`, {
      data: input,
    });
  }

  async deleteChannel(channelId: string): Promise<void> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    await this.request<void>("DELETE", `/channels/undefined`);
  }

  async listChannelMembers(
    channelId: string,
    params: ChannelMembersQueryParams = {}
  ): Promise<PaginatedResult<ChannelMember>> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? this.defaultPageSize;

    return this.request<PaginatedResult<ChannelMember>>(
      "GET",
      `/channels/undefined/members`,
      {
        params: {
          page,
          pageSize,
          search: params.search,
          roles: params.roles,
        },
      }
    );
  }

  async joinChannel(channelId: string): Promise<ChannelMember> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    return this.request<ChannelMember>("POST", `/channels/undefined/join`);
  }

  async leaveChannel(channelId: string): Promise<void> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    await this.request<void>("POST", `/channels/undefined/leave`);
  }

  async addChannelMembers(
    channelId: string,
    userIds: string[]
  ): Promise<{ added: ChannelMember[]; alreadyMembers: string[] }> {
    if (!channelId) {
      throw new Error("channelId is required");
    }
    if (!userIds || userIds.length === 0) {
      throw new Error("At least one userId is required");
    }

    return this.request<{ added: ChannelMember[]; alreadyMembers: string[] }>(
      "POST",
      `/channels/undefined/members`,
      { data: { userIds } }
    );
  }

  async removeChannelMember(channelId: string, userId: string): Promise<void> {
    if (!channelId) {
      throw new Error("channelId is required");
    }
    if (!userId) {
      throw new Error("userId is required");
    }

    await this.request<void>(
      "DELETE",
      `/channels/undefined/members/undefined`
    );
  }

  async updateMemberRole(
    channelId: string,
    userId: string,
    role: ChannelMember["role"]
  ): Promise<ChannelMember> {
    if (!channelId) {
      throw new Error("channelId is required");
    }
    if (!userId) {
      throw new Error("userId is required");
    }
    if (!role) {
      throw new Error("role is required");
    }

    return this.request<ChannelMember>(
      "PATCH",
      `/channels/undefined/members/undefined`,
      { data: { role } }
    );
  }

  async markChannelAsRead(channelId: string): Promise<void> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    await this.request<void>(
      "POST",
      `/channels/undefined/read`
    );
  }

  async muteChannel(channelId: string): Promise<void> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    await this.request<void>(
      "POST",
      `/channels/undefined/mute`
    );
  }

  async unmuteChannel(channelId: string): Promise<void> {
    if (!channelId) {
      throw new Error("channelId is required");
    }

    await this.request<void>(
      "POST",
      `/channels/undefined/unmute`
    );
  }

  async getUserChannels(params: ChannelQueryParams = {}): Promise<PaginatedResult<Channel>> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? this.defaultPageSize;

    return this.request<PaginatedResult<Channel>>("GET", "/me/channels", {
      params: {
        search: params.search,
        includePrivate: params