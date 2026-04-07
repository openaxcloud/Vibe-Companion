/* eslint-disable @typescript-eslint/no-explicit-any */

export type ID = string & { readonly brand: unique symbol };

export type Timestamp = string; // ISO 8601

export type UserRole = 'user' | 'admin' | 'moderator';

export type ChannelType = 'public' | 'private' | 'direct';

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed';

export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy';

export interface BaseEntity {
  id: ID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface UserProfile {
  displayName: string;
  avatarUrl?: string | null;
  bio?: string | null;
}

export interface User extends BaseEntity {
  username: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
  lastActiveAt?: Timestamp | null;
  presence: PresenceStatus;
}

export interface Channel extends BaseEntity {
  name: string;
  type: ChannelType;
  memberIds: ID[];
  isArchived: boolean;
  createdBy: ID;
}

export interface Message extends BaseEntity {
  channelId: ID;
  senderId: ID;
  content: string;
  status: MessageStatus;
  editedAt?: Timestamp | null;
  deletedAt?: Timestamp | null;
  replyToMessageId?: ID | null;
}

/**
 * WebSocket event names for a generic WebSocket implementation.
 */
export type WebSocketEventName =
  | 'ws:connection:init'
  | 'ws:connection:ack'
  | 'ws:connection:error'
  | 'user:presence:update'
  | 'channel:created'
  | 'channel:updated'
  | 'channel:deleted'
  | 'message:created'
  | 'message:updated'
  | 'message:deleted';

/**
 * Payloads for generic WebSocket events.
 */
export interface WebSocketEventPayloads {
  'ws:connection:init': {
    userId: ID;
    token: string;
  };
  'ws:connection:ack': {
    user: User;
    connectedAt: Timestamp;
  };
  'ws:connection:error': {
    code: string;
    message: string;
  };
  'user:presence:update': {
    userId: ID;
    presence: PresenceStatus;
    lastActiveAt: Timestamp;
  };
  'channel:created': {
    channel: Channel;
  };
  'channel:updated': {
    channel: Channel;
  };
  'channel:deleted': {
    channelId: ID;
  };
  'message:created': {
    message: Message;
  };
  'message:updated': {
    message: Message;
  };
  'message:deleted': {
    messageId: ID;
    channelId: ID;
    deletedAt: Timestamp;
  };
}

export interface WebSocketEvent<T extends WebSocketEventName = WebSocketEventName> {
  type: T;
  payload: WebSocketEventPayloads[T];
}

/**
 * Socket.IO specific event names.
 */
export type SocketIOClientToServerEvents = {
  'auth:login': (payload: SocketIOAuthLoginPayload, callback?: (response: SocketIOAuthLoginResponse) => void) => void;
  'auth:logout': (callback?: (response: SocketIOAuthLogoutResponse) => void) => void;
  'channel:join': (payload: SocketIOChannelJoinPayload, callback?: (response: SocketIOChannelJoinResponse) => void) => void;
  'channel:leave': (payload: SocketIOChannelLeavePayload, callback?: (response: SocketIOChannelLeaveResponse) => void) => void;
  'message:send': (payload: SocketIOMessageSendPayload, callback?: (response: SocketIOMessageSendResponse) => void) => void;
  'user:presence:set': (payload: SocketIOUserPresenceSetPayload, callback?: (response: SocketIOUserPresenceSetResponse) => void) => void;
};

export type SocketIOServerToClientEvents = {
  'auth:login:success': (payload: SocketIOAuthLoginSuccessBroadcast) => void;
  'auth:logout:success': (payload: SocketIOAuthLogoutSuccessBroadcast) => void;
  'channel:joined': (payload: SocketIOChannelJoinedBroadcast) => void;
  'channel:left': (payload: SocketIOChannelLeftBroadcast) => void;
  'channel:updated': (payload: SocketIOChannelUpdatedBroadcast) => void;
  'message:new': (payload: SocketIOMessageNewBroadcast) => void;
  'message:updated': (payload: SocketIOMessageUpdatedBroadcast) => void;
  'message:deleted': (payload: SocketIOMessageDeletedBroadcast) => void;
  'user:presence:updated': (payload: SocketIOUserPresenceUpdatedBroadcast) => void;
  'error': (payload: SocketIOErrorEvent) => void;
};

/**
 * Socket.IO auth payloads
 */
export interface SocketIOAuthLoginPayload {
  token: string;
}

export interface SocketIOAuthLoginResponse {
  success: boolean;
  user?: User;
  error?: string;
}

export interface SocketIOAuthLogoutResponse {
  success: boolean;
  error?: string;
}

export interface SocketIOAuthLoginSuccessBroadcast {
  user: User;
}

export interface SocketIOAuthLogoutSuccessBroadcast {
  userId: ID;
}

/**
 * Socket.IO channel payloads
 */
export interface SocketIOChannelJoinPayload {
  channelId: ID;
}

export interface SocketIOChannelJoinResponse {
  success: boolean;
  channel?: Channel;
  error?: string;
}

export interface SocketIOChannelLeavePayload {
  channelId: ID;
}

export interface SocketIOChannelLeaveResponse {
  success: boolean;
  error?: string;
}

export interface SocketIOChannelJoinedBroadcast {
  channel: Channel;
  userId: ID;
}

export interface SocketIOChannelLeftBroadcast {
  channelId: ID;
  userId: ID;
}

export interface SocketIOChannelUpdatedBroadcast {
  channel: Channel;
}

/**
 * Socket.IO message payloads
 */
export interface SocketIOMessageSendPayload {
  channelId: ID;
  content: string;
  replyToMessageId?: ID | null;
}

export interface SocketIOMessageSendResponse {
  success: boolean;
  message?: Message;
  error?: string;
}

export interface SocketIOMessageNewBroadcast {
  message: Message;
}

export interface SocketIOMessageUpdatedBroadcast {
  message: Message;
}

export interface SocketIOMessageDeletedBroadcast {
  messageId: ID;
  channelId: ID;
  deletedAt: Timestamp;
}

/**
 * Socket.IO user presence payloads
 */
export interface SocketIOUserPresenceSetPayload {
  presence: PresenceStatus;
}

export interface SocketIOUserPresenceSetResponse {
  success: boolean;
  presence?: PresenceStatus;
  error?: string;
}

export interface SocketIOUserPresenceUpdatedBroadcast {
  userId: ID;
  presence: PresenceStatus;
  lastActiveAt: Timestamp;
}

/**
 * Socket.IO error payload
 */
export interface SocketIOErrorEvent {
  code: string;
  message: string;
  details?: any;
}

/**
 * Generic utility types
 */
export type Nullable<T> = T | null;

export type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;