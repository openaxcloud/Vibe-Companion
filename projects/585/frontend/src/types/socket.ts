/* eslint-disable @typescript-eslint/no-explicit-any */

export type SocketID = string;

export type RoomID = string;

export interface SocketUser {
  id: string;
  username: string;
  avatarUrl?: string | null;
  isGuest?: boolean;
}

export interface TypingPayload {
  roomId: RoomID;
  userId: string;
  isTyping: boolean;
}

export interface JoinRoomPayload {
  roomId: RoomID;
  user: SocketUser;
}

export interface LeaveRoomPayload {
  roomId: RoomID;
  userId: string;
}

export interface RoomPresencePayload {
  roomId: RoomID;
  users: SocketUser[];
}

export interface RoomUserJoinedPayload {
  roomId: RoomID;
  user: SocketUser;
}

export interface RoomUserLeftPayload {
  roomId: RoomID;
  userId: string;
}

export interface ChatMessage {
  id: string;
  roomId: RoomID;
  sender: SocketUser;
  content: string;
  createdAt: string;
  editedAt?: string | null;
  isSystem?: boolean;
  metadata?: Record<string, any>;
}

export interface NewMessagePayload {
  message: ChatMessage;
}

export interface EditMessagePayload {
  messageId: string;
  roomId: RoomID;
  content: string;
}

export interface DeleteMessagePayload {
  messageId: string;
  roomId: RoomID;
}

export interface MessageUpdatedPayload {
  message: ChatMessage;
}

export interface MessageDeletedPayload {
  messageId: string;
  roomId: RoomID;
}

export interface ServerAck {
  ok: boolean;
  error?: string;
}

export interface ServerErrorPayload {
  code: string;
  message: string;
  details?: any;
}

export interface ConnectionStatePayload {
  connected: boolean;
  reconnecting: boolean;
  attempt?: number;
}

export interface PingPayload {
  timestamp: number;
}

export interface PongPayload {
  timestamp: number;
  latency: number;
}

export interface PresenceSummaryPayload {
  rooms: Array<{
    roomId: RoomID;
    onlineCount: number;
  }>;
}

export interface ClientToServerEvents {
  // Connection management
  "client:ping": (payload: PingPayload) => void;

  // Room lifecycle
  "room:join": (payload: JoinRoomPayload, callback?: (ack: ServerAck) => void) => void;
  "room:leave": (payload: LeaveRoomPayload, callback?: (ack: ServerAck) => void) => void;

  // Messaging
  "message:send": (payload: NewMessagePayload, callback?: (ack: ServerAck & { message?: ChatMessage }) => void) => void;
  "message:edit": (payload: EditMessagePayload, callback?: (ack: ServerAck) => void) => void;
  "message:delete": (payload: DeleteMessagePayload, callback?: (ack: ServerAck) => void) => void;

  // Typing indicators
  "typing:update": (payload: TypingPayload) => void;

  // Presence / metadata
  "presence:getSummary": (callback: (summary: PresenceSummaryPayload) => void) => void;
}

export interface ServerToClientEvents {
  // Connection lifecycle
  "server:connected": (payload: ConnectionStatePayload) => void;
  "server:disconnected": (payload: ConnectionStatePayload) => void;
  "server:reconnecting": (payload: ConnectionStatePayload) => void;
  "server:error": (payload: ServerErrorPayload) => void;

  // Ping / latency
  "server:pong": (payload: PongPayload) => void;

  // Room lifecycle
  "room:joined": (payload: RoomPresencePayload) => void;
  "room:left": (payload: { roomId: RoomID }) => void;
  "room:presence": (payload: RoomPresencePayload) => void;
  "room:userJoined": (payload: RoomUserJoinedPayload) => void;
  "room:userLeft": (payload: RoomUserLeftPayload) => void;

  // Messaging
  "message:new": (payload: NewMessagePayload) => void;
  "message:updated": (payload: MessageUpdatedPayload) => void;
  "message:deleted": (payload: MessageDeletedPayload) => void;

  // Typing indicators
  "typing:updated": (payload: TypingPayload) => void;

  // Presence / metadata
  "presence:summary": (payload: PresenceSummaryPayload) => void;
}

export interface InterServerEvents {
  "server:broadcast": (payload: { type: string; data: any }) => void;
}

export interface SocketData {
  user?: SocketUser;
  rooms?: RoomID[];
}

export type SocketEventName =
  | keyof ClientToServerEvents
  | keyof ServerToClientEvents;

export type ClientEmitFn = <TEvent extends keyof ClientToServerEvents>(
  event: TEvent,
  ...args: Parameters<ClientToServerEvents[TEvent]>
) => void;

export type ServerEmitFn = <TEvent extends keyof ServerToClientEvents>(
  event: TEvent,
  ...args: Parameters<ServerToClientEvents[TEvent]>
) => void;

export interface TypedSocketIOClient {
  on<TEvent extends keyof ServerToClientEvents>(
    event: TEvent,
    listener: ServerToClientEvents[TEvent]
  ): this;

  off<TEvent extends keyof ServerToClientEvents>(
    event: TEvent,
    listener?: ServerToClientEvents[TEvent]
  ): this;

  emit: ClientEmitFn;

  connect(): this;
  disconnect(): this;
  id?: SocketID;
}

export const SOCKET_EVENT_NAMES: Readonly<Record<SocketEventName, SocketEventName>> = {
  "client:ping": "client:ping",
  "room:join": "room:join",
  "room:leave": "room:leave",
  "message:send": "message:send",
  "message:edit": "message:edit",
  "message:delete": "message:delete",
  "typing:update": "typing:update",
  "presence:getSummary": "presence:getSummary",
  "server:connected": "server:connected",
  "server:disconnected": "server:disconnected",
  "server:reconnecting": "server:reconnecting",
  "server:error": "server:error",
  "server:pong": "server:pong",
  "room:joined": "room:joined",
  "room:left": "room:left",
  "room:presence": "room:presence",
  "room:userJoined": "room:userJoined",
  "room:userLeft": "room:userLeft",
  "message:new": "message:new",
  "message:updated": "message:updated",
  "message:deleted": "message:deleted",
  "typing:updated": "typing:updated",
  "presence:summary": "presence:summary",
};