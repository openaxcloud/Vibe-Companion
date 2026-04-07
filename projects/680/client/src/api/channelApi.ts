import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export interface Channel {
  id: string;
  name: string;
  topic?: string | null;
  description?: string | null;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount?: number;
  ownerId?: string;
}

export interface ChannelMember {
  id: string;
  userId: string;
  channelId: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FetchChannelsParams {
  search?: string;
  page?: number;
  pageSize?: number;
  includePrivate?: boolean;
  sortBy?: 'name' | 'createdAt' | 'memberCount';
  sortOrder?: 'asc' | 'desc';
}

export interface CreateChannelPayload {
  name: string;
  topic?: string | null;
  description?: string | null;
  isPrivate?: boolean;
}

export interface UpdateChannelPayload {
  name?: string;
  topic?: string | null;
  description?: string | null;
  isPrivate?: boolean;
}

export interface FetchChannelMembersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: 'owner' | 'admin' | 'member';
}

export interface ChannelApiConfig {
  baseURL?: string;
  getAuthToken?: () => string | null;
  axiosInstance?: AxiosInstance;
}

const DEFAULT_BASE_URL = '/api';

let axiosClient: AxiosInstance | null = null;
let authTokenProvider: (() => string | null) | null = null;

export const configureChannelApi = (config: ChannelApiConfig): void => {
  if (config.axiosInstance) {
    axiosClient = config.axiosInstance;
  } else {
    axiosClient = axios.create({
      baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      withCredentials: true,
    });
  }

  authTokenProvider = config.getAuthToken ?? null;

  if (axiosClient && authTokenProvider) {
    axiosClient.interceptors.request.use((requestConfig: AxiosRequestConfig) => {
      const token = authTokenProvider ? authTokenProvider() : null;
      if (token) {
        requestConfig.headers = {
          ...requestConfig.headers,
          Authorization: `Bearer undefined`,
        };
      }
      return requestConfig;
    });
  }
};

const getClient = (): AxiosInstance => {
  if (!axiosClient) {
    axiosClient = axios.create({
      baseURL: DEFAULT_BASE_URL,
      withCredentials: true,
    });
  }
  return axiosClient;
};

const buildQueryParams = (params?: Record<string, unknown>): URLSearchParams => {
  const searchParams = new URLSearchParams();
  if (!params) return searchParams;

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        searchParams.append(key, String(v));
      });
    } else {
      searchParams.append(key, String(value));
    }
  });

  return searchParams;
};

export const fetchChannels = async (
  params?: FetchChannelsParams,
  config?: AxiosRequestConfig
): Promise<PaginatedResponse<Channel>> => {
  const client = getClient();
  const query = buildQueryParams(params);
  const response: AxiosResponse<PaginatedResponse<Channel>> = await client.get(
    `/channelsundefined` : ''}`,
    config
  );
  return response.data;
};

export const fetchChannelById = async (
  channelId: string,
  config?: AxiosRequestConfig
): Promise<Channel> => {
  const client = getClient();
  const response: AxiosResponse<Channel> = await client.get(`/channels/undefined`, config);
  return response.data;
};

export const createChannel = async (
  payload: CreateChannelPayload,
  config?: AxiosRequestConfig
): Promise<Channel> => {
  const client = getClient();
  const response: AxiosResponse<Channel> = await client.post('/channels', payload, config);
  return response.data;
};

export const updateChannel = async (
  channelId: string,
  payload: UpdateChannelPayload,
  config?: AxiosRequestConfig
): Promise<Channel> => {
  const client = getClient();
  const response: AxiosResponse<Channel> = await client.put(
    `/channels/undefined`,
    payload,
    config
  );
  return response.data;
};

export const deleteChannel = async (
  channelId: string,
  config?: AxiosRequestConfig
): Promise<void> => {
  const client = getClient();
  await client.delete(`/channels/undefined`, config);
};

export const joinChannel = async (
  channelId: string,
  config?: AxiosRequestConfig
): Promise<ChannelMember> => {
  const client = getClient();
  const response: AxiosResponse<ChannelMember> = await client.post(
    `/channels/undefined/join`,
    undefined,
    config
  );
  return response.data;
};

export const leaveChannel = async (
  channelId: string,
  config?: AxiosRequestConfig
): Promise<void> => {
  const client = getClient();
  await client.post(`/channels/undefined/leave`, undefined, config);
};

export const fetchChannelMembers = async (
  channelId: string,
  params?: FetchChannelMembersParams,
  config?: AxiosRequestConfig
): Promise<PaginatedResponse<ChannelMember>> => {
  const client = getClient();
  const query = buildQueryParams(params);
  const response: AxiosResponse<PaginatedResponse<ChannelMember>> = await client.get(
    `/channels/undefined/membersundefined` : ''}`,
    config
  );
  return response.data;
};

export const fetchChannelMember = async (
  channelId: string,
  userId: string,
  config?: AxiosRequestConfig
): Promise<ChannelMember> => {
  const client = getClient();
  const response: AxiosResponse<ChannelMember> = await client.get(
    `/channels/undefined/members/undefined`,
    config
  );
  return response.data;
};

export const updateChannelMemberRole = async (
  channelId: string,
  userId: string,
  role: ChannelMember['role'],
  config?: AxiosRequestConfig
): Promise<ChannelMember> => {
  const client = getClient();
  const response: AxiosResponse<ChannelMember> = await client.patch(
    `/channels/undefined/members/undefined`,
    { role },
    config
  );
  return response.data;
};

export const removeChannelMember = async (
  channelId: string,
  userId: string,
  config?: AxiosRequestConfig
): Promise<void> => {
  const client = getClient();
  await client.delete(
    `/channels/undefined/members/undefined`,
    config
  );
};

export default {
  configure: configureChannelApi,
  fetchChannels,
  fetchChannelById,
  createChannel,
  updateChannel,
  deleteChannel,
  joinChannel,
  leaveChannel,
  fetchChannelMembers,
  fetchChannelMember,
  updateChannelMemberRole,
  removeChannelMember,
};