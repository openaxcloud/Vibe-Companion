import { v4 as uuidv4 } from "uuid";
import { messageRepository } from "../repositories/messageRepository";
import { threadRepository } from "../repositories/threadRepository";
import { userRepository } from "../repositories/userRepository";
import { readReceiptService } from "./readReceiptService";
import { reactionService } from "./reactionService";
import { NotFoundError, ValidationError, AuthorizationError } from "../utils/errors";
import {
  Message,
  MessageContent,
  MessageMetadata,
  MessageStatus,
  MessageType,
  Thread,
  ThreadParticipant,
  ThreadWithMessages,
  PaginationOptions,
  PaginatedResult,
  CreateMessageOptions,
  CreateThreadOptions,
  SendMessageResult,
  ReplyMessageOptions,
  MessageQueryFilters,
  ThreadQueryFilters,
  SortDirection,
  ReactionSummary,
  ReadReceiptSummary,
} from "../types/messagingTypes";

export interface MessageService {
  createThread(options: CreateThreadOptions): Promise<Thread>;
  sendMessage(options: CreateMessageOptions): Promise<SendMessageResult>;
  replyToMessage(options: ReplyMessageOptions): Promise<SendMessageResult>;
  getThreadById(threadId: string, includeMessages?: boolean): Promise<Thread | ThreadWithMessages>;
  getMessageById(messageId: string): Promise<Message>;
  getThreadMessages(
    threadId: string,
    pagination?: PaginationOptions,
    filters?: MessageQueryFilters
  ): Promise<PaginatedResult<Message>>;
  getUserThreads(
    userId: string,
    pagination?: PaginationOptions,
    filters?: ThreadQueryFilters
  ): Promise<PaginatedResult<Thread>>;
  markThreadAsRead(userId: string, threadId: string): Promise<void>;
  markMessageAsRead(userId: string, messageId: string): Promise<void>;
  addReaction(
    userId: string,
    messageId: string,
    reactionType: string
  ): Promise<ReactionSummary>;
  removeReaction(
    userId: string,
    messageId: string,
    reactionType: string
  ): Promise<ReactionSummary>;
  getMessageReactions(messageId: string): Promise<ReactionSummary>;
  getMessageReadReceipts(messageId: string): Promise<ReadReceiptSummary>;
  deleteMessage(userId: string, messageId: string): Promise<void>;
  softDeleteMessage(userId: string, messageId: string): Promise<void>;
  restoreMessage(userId: string, messageId: string): Promise<void>;
  archiveThread(userId: string, threadId: string): Promise<void>;
  unarchiveThread(userId: string, threadId: string): Promise<void>;
}

class MessageServiceImpl implements MessageService {
  public async createThread(options: CreateThreadOptions): Promise<Thread> {
    const { creatorId, participantIds, subject, initialMessage, metadata } = options;

    if (!creatorId) {
      throw new ValidationError("creatorId is required");
    }

    const uniqueParticipantIds = Array.from(new Set([creatorId, ...(participantIds || [])]));

    await this.ensureUsersExist(uniqueParticipantIds);

    const now = new Date();

    const participants: ThreadParticipant[] = uniqueParticipantIds.map((userId) => ({
      userId,
      joinedAt: now,
      role: userId === creatorId ? "owner" : "participant",
      lastReadAt: null,
      isArchived: false,
      archivedAt: null,
    }));

    const thread: Thread = {
      id: uuidv4(),
      subject: subject || "",
      createdAt: now,
      updatedAt: now,
      createdBy: creatorId,
      participants,
      lastMessageId: null,
      metadata: metadata || {},
      isArchived: false,
      archivedAt: null,
    };

    await threadRepository.createThread(thread);

    if (initialMessage) {
      await this.sendMessage({
        threadId: thread.id,
        senderId: creatorId,
        content: initialMessage.content,
        type: initialMessage.type,
        metadata: initialMessage.metadata,
        attachments: initialMessage.attachments,
        silent: initialMessage.silent,
      });
    }

    return threadRepository.getThreadById(thread.id);
  }

  public async sendMessage(options: CreateMessageOptions): Promise<SendMessageResult> {
    const {
      threadId,
      senderId,
      content,
      type = "text",
      metadata,
      attachments,
      silent = false,
    } = options;

    if (!threadId) {
      throw new ValidationError("threadId is required");
    }
    if (!senderId) {
      throw new ValidationError("senderId is required");
    }
    if (!content || !content.text?.trim()) {
      throw new ValidationError("content.text is required");
    }

    const thread = await threadRepository.getThreadById(threadId);
    if (!thread) {
      throw new NotFoundError("Thread not found");
    }

    this.ensureUserIsParticipant(senderId, thread);

    const now = new Date();

    const message: Message = {
      id: uuidv4(),
      threadId,
      senderId,
      content: this.normalizeContent(content),
      type: type as MessageType,
      metadata: this.normalizeMetadata(metadata),
      attachments: attachments || [],
      createdAt: now,
      updatedAt: now,
      status: "sent",
      parentId: null,
      replyCount: 0,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    };

    await messageRepository.createMessage(message);

    await threadRepository.updateThread(threadId, {
      lastMessageId: message.id,
      updatedAt: now,
    });

    if (!silent) {
      await readReceiptService.markMessageAsReadForUser(message.id, senderId);
    }

    const reactions = await reactionService.getReactionSummary(message.id);
    const readReceipts = await readReceiptService.getReadReceiptSummary(message.id);

    return {
      threadId,
      message,
      reactions,
      readReceipts,
    };
  }

  public async replyToMessage(options: ReplyMessageOptions): Promise<SendMessageResult> {
    const {
      parentMessageId,
      senderId,
      content,
      type = "text",
      metadata,
      attachments,
      silent = false,
    } = options;

    if (!parentMessageId) {
      throw new ValidationError("parentMessageId is required");
    }
    if (!senderId) {
      throw new ValidationError("senderId is required");
    }
    if (!content || !content.text?.trim()) {
      throw new ValidationError("content.text is required");
    }

    const parentMessage = await messageRepository.getMessageById(parentMessageId);
    if (!parentMessage) {
      throw new NotFoundError("Parent message not found");
    }

    const thread = await threadRepository.getThreadById(parentMessage.threadId);
    if (!thread) {
      throw new NotFoundError("Thread not found for parent message");
    }

    this.ensureUserIsParticipant(senderId, thread);

    const now = new Date();

    const replyMessage: Message = {
      id: uuidv4(),
      threadId: parentMessage.threadId,
      senderId,
      content: this.normalizeContent(content),
      type: type as MessageType,
      metadata: this.normalizeMetadata(metadata),
      attachments: attachments || [],
      createdAt: now,
      updatedAt: now,
      status: "sent",
      parentId: parentMessageId,
      replyCount: 0,
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
    };

    await messageRepository.createMessage(replyMessage);

    await messageRepository.incrementReplyCount(parentMessageId);

    await threadRepository.updateThread(parentMessage.threadId, {
      lastMessageId: replyMessage.id,
      updatedAt: now,
    });

    if (!silent) {
      await readReceiptService.markMessageAsReadForUser(replyMessage.id, senderId);
    }

    const reactions = await reactionService.getReactionSummary(replyMessage.id);
    const readReceipts = await readReceiptService.getReadReceiptSummary(replyMessage.id);

    return {
      threadId: parentMessage.threadId,
      message: replyMessage,
      reactions,
      readReceipts,
    };
  }

  public async getThreadById(
    threadId: string,
    includeMessages: boolean = false
  ): Promise<Thread | ThreadWithMessages> {
    const thread = await threadRepository.getThreadById(threadId);
    if (!thread) {
      throw new NotFoundError("Thread not found");
    }

    if (!includeMessages) {
      return thread;
    }

    const messages = await messageRepository.getMessagesByThreadId(threadId, {
      page: 1,
      pageSize: 50,
      sortBy: "createdAt",
      sortDirection: "asc",
    });

    return {
      ...thread,
      messages: messages.items,
      pagination: {
        page: messages.page,
        pageSize: messages.pageSize,
        totalItems: messages.totalItems,
        totalPages: messages.totalPages,
      },
    };
  }

  public async getMessageById(messageId: string): Promise<Message> {
    const message = await messageRepository.getMessageById(messageId);
    if (!message) {
      throw new NotFoundError("Message not found");
    }
    return message;
  }

  public async getThreadMessages(
    threadId: string,
    pagination?: PaginationOptions,
    filters?: MessageQueryFilters
  ): Promise<PaginatedResult<Message>> {
    const thread = await threadRepository.getThreadById(thread