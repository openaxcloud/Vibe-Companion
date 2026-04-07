import { apiClient } from '../utils/apiClient';
import type {
  Message,
  NewMessagePayload,
  EditMessagePayload,
  ReactionType,
  PaginatedResponse,
} from '../types/message';
import type { Id } from '../types/common';

export interface SendMessageParams {
  conversationId: Id;
  payload: NewMessagePayload;
  signal?: AbortSignal;
}

export interface EditMessageParams {
  messageId: Id;
  payload: EditMessagePayload;
  signal?: AbortSignal;
}

export interface DeleteMessageParams {
  messageId: Id;
  hardDelete?: boolean;
  signal?: AbortSignal;
}

export interface FetchMessagesParams {
  conversationId: Id;
  cursor?: string | null;
  limit?: number;
  before?: string;
  after?: string;
  signal?: AbortSignal;
}

export interface ReactionParams {
  messageId: Id;
  reaction: ReactionType;
  signal?: AbortSignal;
}

export interface FetchReactionsParams {
  messageId: Id;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface MessageSearchParams {
  conversationId?: Id;
  query: string;
  cursor?: string | null;
  limit?: number;
  signal?: AbortSignal;
}

export interface MessageReadReceiptParams {
  conversationId: Id;
  messageId: Id;
  signal?: AbortSignal;
}

const DEFAULT_PAGE_LIMIT = 30;

export const messageService = {
  async sendMessage({
    conversationId,
    payload,
    signal,
  }: SendMessageParams): Promise<Message> {
    const { data } = await apiClient.post<Message>(
      `/conversations/undefined/messages`,
      payload,
      { signal },
    );
    return data;
  },

  async editMessage({
    messageId,
    payload,
    signal,
  }: EditMessageParams): Promise<Message> {
    const { data } = await apiClient.patch<Message>(
      `/messages/undefined`,
      payload,
      { signal },
    );
    return data;
  },

  async deleteMessage({
    messageId,
    hardDelete = false,
    signal,
  }: DeleteMessageParams): Promise<{ success: boolean }> {
    const { data } = await apiClient.delete<{ success: boolean }>(
      `/messages/undefined`,
      {
        params: { hardDelete },
        signal,
      },
    );
    return data;
  },

  async fetchMessages({
    conversationId,
    cursor = null,
    limit = DEFAULT_PAGE_LIMIT,
    before,
    after,
    signal,
  }: FetchMessagesParams): Promise<PaginatedResponse<Message>> {
    const params: Record<string, string | number | null | undefined> = {
      cursor,
      limit,
      before,
      after,
    };

    const { data } = await apiClient.get<PaginatedResponse<Message>>(
      `/conversations/undefined/messages`,
      {
        params,
        signal,
      },
    );
    return data;
  },

  async fetchMessageById(
    messageId: Id,
    signal?: AbortSignal,
  ): Promise<Message> {
    const { data } = await apiClient.get<Message>(
      `/messages/undefined`,
      { signal },
    );
    return data;
  },

  async addReaction({
    messageId,
    reaction,
    signal,
  }: ReactionParams): Promise<Message> {
    const { data } = await apiClient.post<Message>(
      `/messages/undefined/reactions/undefined`,
      undefined,
      { signal },
    );
    return data;
  },

  async removeReaction({
    messageId,
    reaction,
    signal,
  }: ReactionParams): Promise<Message> {
    const { data } = await apiClient.delete<Message>(
      `/messages/undefined/reactions/undefined`,
      { signal },
    );
    return data;
  },

  async fetchReactions({
    messageId,
    cursor = null,
    limit = DEFAULT_PAGE_LIMIT,
    signal,
  }: FetchReactionsParams): Promise<
    PaginatedResponse<{ userId: Id; reaction: ReactionType; createdAt: string }>
  > {
    const params: Record<string, string | number | null | undefined> = {
      cursor,
      limit,
    };

    const { data } = await apiClient.get<
      PaginatedResponse<{
        userId: Id;
        reaction: ReactionType;
        createdAt: string;
      }>
    >(
      `/messages/undefined/reactions`,
      {
        params,
        signal,
      },
    );
    return data;
  },

  async searchMessages({
    conversationId,
    query,
    cursor = null,
    limit = DEFAULT_PAGE_LIMIT,
    signal,
  }: MessageSearchParams): Promise<PaginatedResponse<Message>> {
    const params: Record<string, string | number | null | undefined> = {
      q: query,
      cursor,
      limit,
      conversationId: conversationId ?? undefined,
    };

    const { data } = await apiClient.get<PaginatedResponse<Message>>(
      '/messages/search',
      {
        params,
        signal,
      },
    );
    return data;
  },

  async markMessageAsRead({
    conversationId,
    messageId,
    signal,
  }: MessageReadReceiptParams): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(
      `/conversations/undefined/read/undefined`,
      undefined,
      { signal },
    );
    return data;
  },

  async markConversationAsRead(
    conversationId: Id,
    signal?: AbortSignal,
  ): Promise<{ success: boolean }> {
    const { data } = await apiClient.post<{ success: boolean }>(
      `/conversations/undefined/read`,
      undefined,
      { signal },
    );
    return data;
  },

  async pinMessage(
    messageId: Id,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; message: Message }> {
    const { data } = await apiClient.post<{ success: boolean; message: Message }>(
      `/messages/undefined/pin`,
      undefined,
      { signal },
    );
    return data;
  },

  async unpinMessage(
    messageId: Id,
    signal?: AbortSignal,
  ): Promise<{ success: boolean; message: Message }> {
    const { data } = await apiClient.post<{ success: boolean; message: Message }>(
      `/messages/undefined/unpin`,
      undefined,
      { signal },
    );
    return data;
  },

  async fetchPinnedMessages(
    conversationId: Id,
    signal?: AbortSignal,
  ): Promise<Message[]> {
    const { data } = await apiClient.get<Message[]>(
      `/conversations/undefined/pinned`,
      { signal },
    );
    return data;
  },

  async bulkDeleteMessages(
    messageIds: Id[],
    options?: { hardDelete?: boolean; signal?: AbortSignal },
  ): Promise<{ success: boolean; deletedIds: Id[] }> {
    const { hardDelete = false, signal } = options || {};
    const { data } = await apiClient.post<{ success: boolean; deletedIds: Id[] }>(
      '/messages/bulk-delete',
      {
        ids: messageIds,
        hardDelete,
      },
      { signal },
    );
    return data;
  },
};

export type MessageService = typeof messageService;
export default messageService;