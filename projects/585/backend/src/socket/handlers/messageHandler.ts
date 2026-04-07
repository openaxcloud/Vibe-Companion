import { Server, Socket } from "socket.io";
import { Types } from "mongoose";
import { Logger } from "../../utils/logger";
import { AuthenticatedSocket } from "../types";
import {
  createMessage,
  editMessage,
  deleteMessage,
  getThreadMessages,
  markChannelAsRead,
} from "../../services/messageService";
import {
  MessagePayload,
  MessageEditPayload,
  MessageDeletePayload,
  ThreadFetchPayload,
  MessageEvents,
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
  ChannelReadPayload,
} from "../types/messageTypes";

const logger = new Logger("messageHandler");

export function registerMessageHandlers(
  io: Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>,
  socket: AuthenticatedSocket
): void {
  const userId = socket.user?.id;

  if (!userId) {
    logger.warn("Unauthenticated socket attempted to register message handlers", {
      socketId: socket.id,
    });
    socket.disconnect(true);
    return;
  }

  const emitToChannel = (channelId: string, event: keyof ServerToClientEvents, data: any) => {
    io.to(`channel:undefined`).emit(event, data);
  };

  const safeObjectId = (id: string): Types.ObjectId | null => {
    if (!Types.ObjectId.isValid(id)) return null;
    return new Types.ObjectId(id);
  };

  const handleSendMessage = async (
    payload: MessagePayload,
    callback?: (response: { ok: boolean; error?: string }) => void
  ) => {
    try {
      if (!payload || !payload.channelId || !payload.content?.trim()) {
        callback?.({ ok: false, error: "Invalid payload" });
        return;
      }

      const channelObjectId = safeObjectId(payload.channelId);
      if (!channelObjectId) {
        callback?.({ ok: false, error: "Invalid channel id" });
        return;
      }

      const threadParentId = payload.threadParentId
        ? safeObjectId(payload.threadParentId)
        : null;
      if (payload.threadParentId && !threadParentId) {
        callback?.({ ok: false, error: "Invalid thread parent id" });
        return;
      }

      const message = await createMessage({
        channelId: channelObjectId,
        authorId: new Types.ObjectId(userId),
        content: payload.content.trim(),
        attachments: payload.attachments || [],
        threadParentId: threadParentId || undefined,
        metadata: payload.metadata,
      });

      const response = {
        ...message.toJSON(),
        channelId: payload.channelId,
        authorId: userId,
        threadParentId: payload.threadParentId || null,
      };

      emitToChannel(payload.channelId, MessageEvents.MESSAGE_CREATED, response);
      callback?.({ ok: true });
    } catch (error) {
      logger.error("Error sending message", { error, userId, payload });
      callback?.({ ok: false, error: "Failed to send message" });
    }
  };

  const handleEditMessage = async (
    payload: MessageEditPayload,
    callback?: (response: { ok: boolean; error?: string }) => void
  ) => {
    try {
      if (!payload || !payload.messageId || !payload.content?.trim()) {
        callback?.({ ok: false, error: "Invalid payload" });
        return;
      }

      const messageObjectId = safeObjectId(payload.messageId);
      if (!messageObjectId) {
        callback?.({ ok: false, error: "Invalid message id" });
        return;
      }

      const updated = await editMessage({
        messageId: messageObjectId,
        userId: new Types.ObjectId(userId),
        content: payload.content.trim(),
      });

      if (!updated) {
        callback?.({ ok: false, error: "Message not found or no permission" });
        return;
      }

      const response = {
        ...updated.toJSON(),
        channelId: updated.channelId.toString(),
        authorId: updated.authorId.toString(),
      };

      emitToChannel(response.channelId, MessageEvents.MESSAGE_UPDATED, response);
      callback?.({ ok: true });
    } catch (error) {
      logger.error("Error editing message", { error, userId, payload });
      callback?.({ ok: false, error: "Failed to edit message" });
    }
  };

  const handleDeleteMessage = async (
    payload: MessageDeletePayload,
    callback?: (response: { ok: boolean; error?: string }) => void
  ) => {
    try {
      if (!payload || !payload.messageId || !payload.channelId) {
        callback?.({ ok: false, error: "Invalid payload" });
        return;
      }

      const messageObjectId = safeObjectId(payload.messageId);
      if (!messageObjectId) {
        callback?.({ ok: false, error: "Invalid message id" });
        return;
      }

      const deleted = await deleteMessage({
        messageId: messageObjectId,
        userId: new Types.ObjectId(userId),
      });

      if (!deleted) {
        callback?.({ ok: false, error: "Message not found or no permission" });
        return;
      }

      emitToChannel(payload.channelId, MessageEvents.MESSAGE_DELETED, {
        messageId: payload.messageId,
        channelId: payload.channelId,
        deletedBy: userId,
      });

      callback?.({ ok: true });
    } catch (error) {
      logger.error("Error deleting message", { error, userId, payload });
      callback?.({ ok: false, error: "Failed to delete message" });
    }
  };

  const handleFetchThread = async (
    payload: ThreadFetchPayload,
    callback?: (response: {
      ok: boolean;
      error?: string;
      messages?: any[];
      threadParentId?: string;
    }) => void
  ) => {
    try {
      if (!payload || !payload.threadParentId) {
        callback?.({ ok: false, error: "Invalid payload" });
        return;
      }

      const threadParentObjectId = safeObjectId(payload.threadParentId);
      if (!threadParentObjectId) {
        callback?.({ ok: false, error: "Invalid thread parent id" });
        return;
      }

      const messages = await getThreadMessages(threadParentObjectId);

      callback?.({
        ok: true,
        messages: messages.map((m) => ({
          ...m.toJSON(),
          channelId: m.channelId.toString(),
          authorId: m.authorId.toString(),
          threadParentId: m.threadParentId ? m.threadParentId.toString() : null,
        })),
        threadParentId: payload.threadParentId,
      });
    } catch (error) {
      logger.error("Error fetching thread messages", { error, userId, payload });
      callback?.({ ok: false, error: "Failed to fetch thread messages" });
    }
  };

  const handleMarkChannelRead = async (
    payload: ChannelReadPayload,
    callback?: (response: { ok: boolean; error?: string }) => void
  ) => {
    try {
      if (!payload || !payload.channelId) {
        callback?.({ ok: false, error: "Invalid payload" });
        return;
      }

      const channelObjectId = safeObjectId(payload.channelId);
      if (!channelObjectId) {
        callback?.({ ok: false, error: "Invalid channel id" });
        return;
      }

      const result = await markChannelAsRead({
        channelId: channelObjectId,
        userId: new Types.ObjectId(userId),
      });

      if (!result) {
        callback?.({ ok: false, error: "Failed to mark channel as read" });
        return;
      }

      socket.emit(MessageEvents.CHANNEL_READ, {
        channelId: payload.channelId,
        userId,
        lastReadAt: result.lastReadAt.toISOString(),
      });

      callback?.({ ok: true });
    } catch (error) {
      logger.error("Error marking channel as read", { error, userId, payload });
      callback?.({ ok: false, error: "Failed to mark channel as read" });
    }
  };

  socket.on(MessageEvents.SEND_MESSAGE, handleSendMessage);
  socket.on(MessageEvents.EDIT_MESSAGE, handleEditMessage);
  socket.on(MessageEvents.DELETE_MESSAGE, handleDeleteMessage);
  socket.on(MessageEvents.FETCH_THREAD, handleFetchThread);
  socket.on(MessageEvents.MARK_CHANNEL_READ, handleMarkChannelRead);

  socket.on("disconnect", (reason: string) => {
    logger.debug("Socket disconnected from message handlers", {
      socketId: socket.id,
      userId,
      reason,
    });
  });
}