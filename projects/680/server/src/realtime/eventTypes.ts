export enum RealtimeEventKind {
  MESSAGE_NEW = 'MESSAGE_NEW',
  MESSAGE_EDIT = 'MESSAGE_EDIT',
  MESSAGE_DELETE = 'MESSAGE_DELETE',
  TYPING_START = 'TYPING_START',
  TYPING_STOP = 'TYPING_STOP',
  PRESENCE_UPDATE = 'PRESENCE_UPDATE',
  READ_RECEIPT = 'READ_RECEIPT',
  CHANNEL_JOIN = 'CHANNEL_JOIN',
  CHANNEL_LEAVE = 'CHANNEL_LEAVE'
}

export const MESSAGE_NEW = RealtimeEventKind.MESSAGE_NEW;
export const MESSAGE_EDIT = RealtimeEventKind.MESSAGE_EDIT;
export const MESSAGE_DELETE = RealtimeEventKind.MESSAGE_DELETE;
export const TYPING_START = RealtimeEventKind.TYPING_START;
export const TYPING_STOP = RealtimeEventKind.TYPING_STOP;
export const PRESENCE_UPDATE = RealtimeEventKind.PRESENCE_UPDATE;
export const READ_RECEIPT = RealtimeEventKind.READ_RECEIPT;
export const CHANNEL_JOIN = RealtimeEventKind.CHANNEL_JOIN;
export const CHANNEL_LEAVE = RealtimeEventKind.CHANNEL_LEAVE;

export type RealtimeEventKindString = `undefined`;

export interface BaseRealtimeEvent<TKind extends RealtimeEventKind = RealtimeEventKind, TPayload = unknown> {
  kind: TKind;
  payload: TPayload;
  /**
   * Server-side timestamp (ISO 8601) when the event was created.
   */
  timestamp: string;
  /**
   * Unique identifier for this event (for deduplication, idempotency, etc.).
   */
  eventId: string;
}

/**
 * MESSAGE_* events
 */
export interface MessageNewPayload {
  messageId: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
  /**
   * Optional client-generated temporary ID for optimistic UI updates.
   */
  clientTempId?: string;
  /**
   * Whether this message is a system-generated message.
   */
  isSystem?: boolean;
  /**
   * Optional metadata for custom features (e.g., attachments, reactions).
   */
  meta?: Record<string, unknown>;
}

export type MessageNewEvent = BaseRealtimeEvent<
  RealtimeEventKind.MESSAGE_NEW,
  MessageNewPayload
>;

export interface MessageEditPayload {
  messageId: string;
  channelId: string;
  editorId: string;
  content: string;
  editedAt: string;
  /**
   * Whether this is a partial edit (e.g., only metadata changed).
   */
  isPartial?: boolean;
  meta?: Record<string, unknown>;
}

export type MessageEditEvent = BaseRealtimeEvent<
  RealtimeEventKind.MESSAGE_EDIT,
  MessageEditPayload
>;

export interface MessageDeletePayload {
  messageId: string;
  channelId: string;
  deletedById: string;
  deletedAt: string;
  /**
   * Whether the message was soft-deleted (can be restored) or hard-deleted.
   */
  softDelete?: boolean;
  reason?: string;
}

export type MessageDeleteEvent = BaseRealtimeEvent<
  RealtimeEventKind.MESSAGE_DELETE,
  MessageDeletePayload
>;

/**
 * Typing events
 */
export interface TypingPayloadBase {
  channelId: string;
  userId: string;
}

export type TypingStartPayload = TypingPayloadBase & {
  /**
   * Optional timeout in ms after which the server/client
   * should consider typing to have stopped if no update arrives.
   */
  timeoutMs?: number;
};

export type TypingStopPayload = TypingPayloadBase;

export type TypingStartEvent = BaseRealtimeEvent<
  RealtimeEventKind.TYPING_START,
  TypingStartPayload
>;

export type TypingStopEvent = BaseRealtimeEvent<
  RealtimeEventKind.TYPING_STOP,
  TypingStopPayload
>;

/**
 * Presence events
 */
export type PresenceStatus = 'online' | 'offline' | 'away' | 'busy';

export interface PresenceUpdatePayload {
  userId: string;
  status: PresenceStatus;
  /**
   * Optional ISO timestamp of the last activity.
   */
  lastActiveAt?: string;
  /**
   * Optional map of device/platform-specific presence states.
   * Example: { web: 'online', mobile: 'offline' }
   */
  deviceStatus?: Record<string, PresenceStatus>;
}

export type PresenceUpdateEvent = BaseRealtimeEvent<
  RealtimeEventKind.PRESENCE_UPDATE,
  PresenceUpdatePayload
>;

/**
 * Read receipt events
 */
export interface ReadReceiptPayload {
  messageId: string;
  channelId: string;
  userId: string;
  /**
   * Time when the user read the message.
   */
  readAt: string;
}

export type ReadReceiptEvent = BaseRealtimeEvent<
  RealtimeEventKind.READ_RECEIPT,
  ReadReceiptPayload
>;

/**
 * Channel membership events
 */
export interface ChannelJoinPayload {
  channelId: string;
  userId: string;
  joinedAt: string;
  /**
   * Optional flag to indicate whether this is the first time
   * the user joins this channel.
   */
  isFirstJoin?: boolean;
}

export type ChannelJoinEvent = BaseRealtimeEvent<
  RealtimeEventKind.CHANNEL_JOIN,
  ChannelJoinPayload
>;

export interface ChannelLeavePayload {
  channelId: string;
  userId: string;
  leftAt: string;
  /**
   * Whether the user left voluntarily or was removed.
   */
  reason?: 'left' | 'kicked' | 'banned' | string;
}

export type ChannelLeaveEvent = BaseRealtimeEvent<
  RealtimeEventKind.CHANNEL_LEAVE,
  ChannelLeavePayload
>;

/**
 * Union type of all specific event payloads and events
 */
export type RealtimeEventPayloadMap = {
  [RealtimeEventKind.MESSAGE_NEW]: MessageNewPayload;
  [RealtimeEventKind.MESSAGE_EDIT]: MessageEditPayload;
  [RealtimeEventKind.MESSAGE_DELETE]: MessageDeletePayload;
  [RealtimeEventKind.TYPING_START]: TypingStartPayload;
  [RealtimeEventKind.TYPING_STOP]: TypingStopPayload;
  [RealtimeEventKind.PRESENCE_UPDATE]: PresenceUpdatePayload;
  [RealtimeEventKind.READ_RECEIPT]: ReadReceiptPayload;
  [RealtimeEventKind.CHANNEL_JOIN]: ChannelJoinPayload;
  [RealtimeEventKind.CHANNEL_LEAVE]: ChannelLeavePayload;
};

export type RealtimeEventForKind<K extends RealtimeEventKind> = BaseRealtimeEvent<
  K,
  RealtimeEventPayloadMap[K]
>;

export type AnyRealtimeEvent =
  | MessageNewEvent
  | MessageEditEvent
  | MessageDeleteEvent
  | TypingStartEvent
  | TypingStopEvent
  | PresenceUpdateEvent
  | ReadReceiptEvent
  | ChannelJoinEvent
  | ChannelLeaveEvent;

/**
 * Type guards
 */
export function isRealtimeEventOfKind<
  K extends RealtimeEventKind
>(event: AnyRealtimeEvent, kind: K): event is RealtimeEventForKind<K> {
  return event.kind === kind;
}

export function isMessageNewEvent(event: AnyRealtimeEvent): event is MessageNewEvent {
  return event.kind === RealtimeEventKind.MESSAGE_NEW;
}

export function isMessageEditEvent(event: AnyRealtimeEvent): event is MessageEditEvent {
  return event.kind === RealtimeEventKind.MESSAGE_EDIT;
}

export function isMessageDeleteEvent(event: AnyRealtimeEvent): event is MessageDeleteEvent {
  return event.kind === RealtimeEventKind.MESSAGE_DELETE;
}

export function isTypingStartEvent(event: AnyRealtimeEvent): event is TypingStartEvent {
  return event.kind === RealtimeEventKind.TYPING_START;
}

export function isTypingStopEvent(event: AnyRealtimeEvent): event is TypingStopEvent {
  return event.kind === RealtimeEventKind.TYPING_STOP;
}

export function isPresenceUpdateEvent(event: AnyRealtimeEvent): event is PresenceUpdateEvent {
  return event.kind === RealtimeEventKind.PRESENCE_UPDATE;
}

export function isReadReceiptEvent(event: AnyRealtimeEvent): event is ReadReceiptEvent {
  return event.kind === RealtimeEventKind.READ_RECEIPT;
}

export function isChannelJoinEvent(event: AnyRealtimeEvent): event is ChannelJoinEvent {
  return event.kind === RealtimeEventKind.CHANNEL_JOIN;
}

export function isChannelLeaveEvent(event: AnyRealtimeEvent): event is ChannelLeaveEvent {
  return event.kind === RealtimeEventKind.CHANNEL_LEAVE;
}