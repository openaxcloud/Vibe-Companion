import axios, { AxiosInstance, AxiosResponse } from "axios";

export type ReactionType =
  | "like"
  | "love"
  | "laugh"
  | "surprised"
  | "sad"
  | "angry"
  | "custom";

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  type: ReactionType;
  createdAt: string;
  updatedAt?: string;
}

export interface AddReactionRequest {
  messageId: string;
  type: ReactionType;
}

export interface RemoveReactionRequest {
  messageId: string;
  type: ReactionType;
}

export interface ReactionSummary {
  type: ReactionType;
  count: number;
  reactedByCurrentUser: boolean;
}

export interface MessageReactions {
  messageId: string;
  reactions: ReactionSummary[];
}

export interface ReactionApiConfig {
  baseURL?: string;
  withCredentials?: boolean;
  authToken?: string | null;
}

const DEFAULT_BASE_URL = "/api";

class ReactionApi {
  private client: AxiosInstance;

  constructor(config?: ReactionApiConfig) {
    this.client = axios.create({
      baseURL: config?.baseURL ?? DEFAULT_BASE_URL,
      withCredentials: config?.withCredentials ?? true,
    });

    if (config?.authToken) {
      this.setAuthToken(config.authToken);
    }
  }

  public setAuthToken(token: string | null): void {
    if (!token) {
      delete this.client.defaults.headers.common["Authorization"];
      return;
    }
    this.client.defaults.headers.common["Authorization"] = `Bearer undefined`;
  }

  public async addReaction(
    payload: AddReactionRequest
  ): Promise<ReactionSummary[]> {
    const response: AxiosResponse<{ reactions: ReactionSummary[] }> =
      await this.client.post(`/messages/undefined/reactions`, {
        type: payload.type,
      });

    return response.data.reactions;
  }

  public async removeReaction(
    payload: RemoveReactionRequest
  ): Promise<ReactionSummary[]> {
    const response: AxiosResponse<{ reactions: ReactionSummary[] }> =
      await this.client.delete(
        `/messages/undefined/reactions/undefined`
      );

    return response.data.reactions;
  }

  public async getMessageReactions(
    messageId: string
  ): Promise<MessageReactions> {
    const response: AxiosResponse<MessageReactions> = await this.client.get(
      `/messages/undefined/reactions`
    );
    return response.data;
  }

  public async getUserReactionsForMessage(
    messageId: string
  ): Promise<Reaction[]> {
    const response: AxiosResponse<{ reactions: Reaction[] }> =
      await this.client.get(`/messages/undefined/reactions/me`);
    return response.data.reactions;
  }

  public async clearAllReactionsForMessage(
    messageId: string
  ): Promise<ReactionSummary[]> {
    const response: AxiosResponse<{ reactions: ReactionSummary[] }> =
      await this.client.delete(`/messages/undefined/reactions`);
    return response.data.reactions;
  }
}

let reactionApiInstance: ReactionApi | null = null;

export const getReactionApi = (config?: ReactionApiConfig): ReactionApi => {
  if (!reactionApiInstance) {
    reactionApiInstance = new ReactionApi(config);
  } else if (config?.authToken !== undefined) {
    reactionApiInstance.setAuthToken(config.authToken);
  }
  return reactionApiInstance;
};

export const reactionApi = getReactionApi();