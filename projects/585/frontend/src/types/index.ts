export type UUID = string;

export interface BaseEntity {
  id: UUID;
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export type UserRole = 'user' | 'moderator' | 'admin';

export interface User extends BaseEntity {
  username: string;
  displayName: string;
  avatarUrl?: string | null;
  email?: string;
  role: UserRole;
  isOnline: boolean;
  lastSeenAt?: string | null;
}

export type MessageType = 'text' | 'system' | 'file';

export interface Message extends BaseEntity {
  channelId: UUID;
  authorId: UUID | null; // null for system messages
  content: string;
  type: MessageType;
  editedAt?: string | null;
  replyToId?: UUID | null;
  isDeleted: boolean;
}

export type ChannelType = 'public' | 'private' | 'direct';

export interface Channel extends BaseEntity {
  name: string;
  description?: string | null;
  type: ChannelType;
  isArchived: boolean;
  memberIds: UUID[];
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface WsAuthPayload {
  token: string;
}

export interface WsErrorPayload {
  code: string;
  message: string;
}

export interface WsUserStatusPayload {
  userId: UUID;
  isOnline: boolean;
  lastSeenAt?: string | null;
}

export interface WsMessageCreatedPayload {
  message: Message;
}

export interface WsMessageUpdatedPayload {
  message: Message;
}

export interface WsMessageDeletedPayload {
  messageId: UUID;
  channelId: UUID;
}

export interface WsChannelCreatedPayload {
  channel: Channel;
}

export interface WsChannelUpdatedPayload {
  channel: Channel;
}

export interface WsChannelDeletedPayload {
  channelId: UUID;
}

export type WsClientEvent =
  | { type: 'auth'; payload: WsAuthPayload }
  | { type: 'ping'; payload?: undefined }
  | { type: 'message:create'; payload: { channelId: UUID; content: string; type?: MessageType; replyToId?: UUID | null } }
  | { type: 'message:update'; payload: { messageId: UUID; content: string } }
  | { type: 'message:delete'; payload: { messageId: UUID } }
  | { type: 'channel:subscribe'; payload: { channelId: UUID } }
  | { type: 'channel:unsubscribe'; payload: { channelId: UUID } };

export type WsServerEvent =
  | { type: 'auth:ok'; payload: { user: User } }
  | { type: 'auth:error'; payload: WsErrorPayload }
  | { type: 'pong'; payload?: undefined }
  | { type: 'error'; payload: WsErrorPayload }
  | { type: 'user:status'; payload: WsUserStatusPayload }
  | { type: 'message:created'; payload: WsMessageCreatedPayload }
  | { type: 'message:updated'; payload: WsMessageUpdatedPayload }
  | { type: 'message:deleted'; payload: WsMessageDeletedPayload }
  | { type: 'channel:created'; payload: WsChannelCreatedPayload }
  | { type: 'channel:updated'; payload: WsChannelUpdatedPayload }
  | { type: 'channel:deleted'; payload: WsChannelDeletedPayload };

export type WsEvent = WsClientEvent | WsServerEvent;