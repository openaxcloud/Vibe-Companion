import { WebSocket } from "ws";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { RealtimeBus } from "./realtimeBus";
import { logger } from "../logger";
import {
  saveMessage,
  updateMessage,
  deleteMessage,
  getRoomById,
  persistTypingStatus,
} from "../services/messageService";
import {
  AuthenticatedWebSocket,
  OutgoingRealtimeEvent,
  RealtimeEventType,
  BroadcastOptions,
} from "./types";

const baseEventSchema = z.object({
  type: z.string(),
  requestId: z.string().optional(),
});

const joinRoomSchema = baseEventSchema.extend({
  type: z.literal("join_room"),
  roomId: z.string().min(1),
});

const leaveRoomSchema = baseEventSchema.extend({
  type: z.literal("leave_room"),
  roomId: z.string().min(1),
});

const sendMessageSchema = baseEventSchema.extend({
  type: z.literal("send_message"),
  roomId: z.string().min(1),
  tempId: z.string().optional(),
  content: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

const updateMessageSchema = baseEventSchema.extend({
  type: z.literal("update_message"),
  roomId: z.string().min(1),
  messageId: z.string().min(1),
  content: z.string().min(1),
});

const deleteMessageSchema = baseEventSchema.extend({
  type: z.literal("delete_message"),
  roomId: z.string().min(1),
  messageId: z.string().min(1),
  hardDelete: z.boolean().optional(),
});

const typingSchema = baseEventSchema.extend({
  type: z.literal("typing"),
  roomId: z.string().min(1),
  isTyping: z.boolean(),
});

const pingSchema = baseEventSchema.extend({
  type: z.literal("ping"),
});

const anyClientEventSchema = z.discriminatedUnion("type", [
  joinRoomSchema,
  leaveRoomSchema,
  sendMessageSchema,
  updateMessageSchema,
  deleteMessageSchema,
  typingSchema,
  pingSchema,
]);

type AnyClientEvent = z.infer<typeof anyClientEventSchema>;

type MessageHandlersDeps = {
  bus: RealtimeBus;
};

export class MessageHandlers {
  private bus: RealtimeBus;

  constructor(deps: MessageHandlersDeps) {
    this.bus = deps.bus;
  }

  public attachConnection(ws: AuthenticatedWebSocket): void {
    ws.on("message", (raw: WebSocket.RawData) => {
      this.handleRawMessage(ws, raw);
    });
  }

  private handleRawMessage(ws: AuthenticatedWebSocket, raw: WebSocket.RawData): void {
    let parsed: unknown;
    try {
      const text = typeof raw === "string" ? raw : raw.toString("utf-8");
      parsed = JSON.parse(text);
    } catch (err) {
      logger.warn({ err }, "Failed to parse incoming WebSocket message as JSON");
      this.safeSend(ws, {
        type: "error",
        error: "invalid_json",
        message: "Unable to parse message as JSON",
      });
      return;
    }

    const parseResult = anyClientEventSchema.safeParse(parsed);
    if (!parseResult.success) {
      logger.warn(
        {
          issues: parseResult.error.issues,
        },
        "Incoming WebSocket message failed schema validation",
      );
      this.safeSend(ws, {
        type: "error",
        error: "invalid_payload",
        message: "Payload validation failed",
        details: parseResult.error.issues,
      });
      return;
    }

    const event = parseResult.data;
    void this.routeEvent(ws, event);
  }

  private async routeEvent(ws: AuthenticatedWebSocket, event: AnyClientEvent): Promise<void> {
    try {
      switch (event.type) {
        case "join_room":
          await this.handleJoinRoom(ws, event);
          break;
        case "leave_room":
          await this.handleLeaveRoom(ws, event);
          break;
        case "send_message":
          await this.handleSendMessage(ws, event);
          break;
        case "update_message":
          await this.handleUpdateMessage(ws, event);
          break;
        case "delete_message":
          await this.handleDeleteMessage(ws, event);
          break;
        case "typing":
          await this.handleTyping(ws, event);
          break;
        case "ping":
          this.handlePing(ws, event);
          break;
        default:
          this.safeSend(ws, {
            type: "error",
            error: "unknown_event",
            message: `Unknown event type: undefined`,
          });
          break;
      }
    } catch (err) {
      logger.error({ err, eventType: event.type }, "Error while handling WebSocket event");
      this.safeSend(ws, {
        type: "error",
        error: "internal_error",
        message: "An internal error occurred while processing the request",
        requestId: event.requestId,
      });
    }
  }

  private async handleJoinRoom(ws: AuthenticatedWebSocket, event: z.infer<typeof joinRoomSchema>): Promise<void> {
    const { roomId, requestId } = event;

    const room = await getRoomById(roomId);
    if (!room) {
      this.safeSend(ws, {
        type: "join_room_error",
        requestId,
        roomId,
        error: "room_not_found",
        message: "Room does not exist",
      });
      return;
    }

    this.bus.subscribeToRoom(roomId, ws);

    const joinedEvent: OutgoingRealtimeEvent = {
      type: "room_joined",
      roomId,
      userId: ws.user.id,
      requestId,
    };
    this.safeSend(ws, joinedEvent);

    const presenceEvent: OutgoingRealtimeEvent = {
      type: "user_joined",
      roomId,
      userId: ws.user.id,
      isSelf: false,
    };
    this.broadcast(roomId, presenceEvent, { exclude: ws });
  }

  private async handleLeaveRoom(ws: AuthenticatedWebSocket, event: z.infer<typeof leaveRoomSchema>): Promise<void> {
    const { roomId, requestId } = event;

    this.bus.unsubscribeFromRoom(roomId, ws);

    const leftEvent: OutgoingRealtimeEvent = {
      type: "room_left",
      roomId,
      userId: ws.user.id,
      requestId,
    };
    this.safeSend(ws, leftEvent);

    const presenceEvent: OutgoingRealtimeEvent = {
      type: "user_left",
      roomId,
      userId: ws.user.id,
      isSelf: false,
    };
    this.broadcast(roomId, presenceEvent, { exclude: ws });
  }

  private async handleSendMessage(ws: AuthenticatedWebSocket, event: z.infer<typeof sendMessageSchema>): Promise<void> {
    const { roomId, content, tempId, metadata, requestId } = event;

    const room = await getRoomById(roomId);
    if (!room) {
      this.safeSend(ws, {
        type: "send_message_error",
        roomId,
        tempId,
        error: "room_not_found",
        message: "Room does not exist",
        requestId,
      });
      return;
    }

    const id = uuidv4();
    const saved = await saveMessage({
      id,
      roomId,
      userId: ws.user.id,
      content,
      metadata: metadata ?? {},
    });

    const ackEvent: OutgoingRealtimeEvent = {
      type: "message_sent_ack",
      roomId,
      tempId,
      message: saved,
      requestId,
    };
    this.safeSend(ws, ackEvent);

    const broadcastEvent: OutgoingRealtimeEvent = {
      type: "message_created",
      roomId,
      message: saved,
    };
    this.broadcast(roomId, broadcastEvent, { exclude: ws });
  }

  private async handleUpdateMessage(
    ws: AuthenticatedWebSocket,
    event: z.infer<typeof updateMessageSchema>,
  ): Promise<void> {
    const { roomId, messageId, content, requestId } = event;

    const updated = await updateMessage({
      id: messageId,
      roomId,
      userId: ws.user.id,
      content,
    });

    if (!updated) {
      this.safeSend(ws, {
        type: "update_message_error",
        roomId,
        messageId,
        error: "not_found_or_forbidden",
        message: "Message not found or permission denied",
        requestId,
      });
      return;
    }

    const ackEvent: OutgoingRealtimeEvent = {
      type: "message_updated_ack",
      roomId,
      message: updated,
      requestId,
    };
    this.safeSend(ws, ackEvent);

    const broadcastEvent: OutgoingRealtimeEvent = {
      type: "message_updated",
      roomId,
      message: updated,
    };
    this.broadcast(roomId, broadcastEvent, { exclude: ws });
  }

  private async handleDeleteMessage(
    ws: AuthenticatedWebSocket,
    event: z.infer<typeof deleteMessageSchema>,
  ): Promise<void> {
    const { roomId, messageId, hardDelete = false, requestId } = event;

    const result = await deleteMessage({
      id: messageId,