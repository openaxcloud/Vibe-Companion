import { PrismaClient, ReadReceipt } from '@prisma/client';
import { WebSocketServer } from 'ws';

const prisma = new PrismaClient();

export interface ReadReceiptPayload {
  messageId: string;
  userId: string;
  conversationId?: string;
  readAt?: Date;
}

export interface ReadReceiptEvent {
  type: 'read_receipt';
  payload: {
    messageId: string;
    userId: string;
    conversationId: string | null;
    readAt: string;
  };
}

export interface ReadReceiptServiceDependencies {
  prismaClient?: PrismaClient;
  websocketServer?: WebSocketServer;
}

export class ReadReceiptService {
  private prisma: PrismaClient;
  private wss: WebSocketServer | null;

  constructor(deps: ReadReceiptServiceDependencies = {}) {
    this.prisma = deps.prismaClient ?? prisma;
    this.wss = deps.websocketServer ?? null;
  }

  async markMessageAsRead(payload: ReadReceiptPayload): Promise<ReadReceipt> {
    const readAt = payload.readAt ?? new Date();

    const existing = await this.prisma.readReceipt.findFirst({
      where: {
        messageId: payload.messageId,
        userId: payload.userId,
      },
    });

    let receipt: ReadReceipt;

    if (existing) {
      if (existing.readAt >= readAt) {
        return existing;
      }

      receipt = await this.prisma.readReceipt.update({
        where: {
          id: existing.id,
        },
        data: {
          readAt,
        },
      });
    } else {
      receipt = await this.prisma.readReceipt.create({
        data: {
          messageId: payload.messageId,
          userId: payload.userId,
          conversationId: payload.conversationId ?? null,
          readAt,
        },
      });
    }

    this.emitReadReceiptEvent(receipt);

    return receipt;
  }

  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<ReadReceipt[]> {
    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
      },
      select: {
        id: true,
      },
    });

    if (!messages.length) {
      return [];
    }

    const now = new Date();

    const existingReceipts = await this.prisma.readReceipt.findMany({
      where: {
        userId,
        messageId: {
          in: messages.map((m) => m.id),
        },
      },
    });

    const existingByMessageId = new Map<string, ReadReceipt>();
    existingReceipts.forEach((r) => existingByMessageId.set(r.messageId, r));

    const operations: Promise<ReadReceipt>[] = [];

    for (const msg of messages) {
      const existing = existingByMessageId.get(msg.id);
      if (existing) {
        if (existing.readAt < now) {
          operations.push(
            this.prisma.readReceipt.update({
              where: { id: existing.id },
              data: { readAt: now },
            })
          );
        } else {
          operations.push(Promise.resolve(existing));
        }
      } else {
        operations.push(
          this.prisma.readReceipt.create({
            data: {
              messageId: msg.id,
              userId,
              conversationId,
              readAt: now,
            },
          })
        );
      }
    }

    const receipts = await Promise.all(operations);

    receipts.forEach((receipt) => this.emitReadReceiptEvent(receipt));

    return receipts;
  }

  async getReadReceiptsForMessage(messageId: string): Promise<ReadReceipt[]> {
    return this.prisma.readReceipt.findMany({
      where: { messageId },
    });
  }

  async getLatestReadReceiptsForConversation(
    conversationId: string
  ): Promise<ReadReceipt[]> {
    const receipts = await this.prisma.readReceipt.groupBy({
      by: ['userId'],
      where: {
        conversationId,
      },
      _max: {
        readAt: true,
      },
    });

    const latestReceipts = await this.prisma.readReceipt.findMany({
      where: {
        conversationId,
        OR: receipts.map((r) => ({
          userId: r.userId,
          readAt: r._max.readAt ?? undefined,
        })),
      },
    });

    return latestReceipts;
  }

  private emitReadReceiptEvent(receipt: ReadReceipt): void {
    if (!this.wss) return;

    const event: ReadReceiptEvent = {
      type: 'read_receipt',
      payload: {
        messageId: receipt.messageId,
        userId: receipt.userId,
        conversationId: receipt.conversationId,
        readAt: receipt.readAt.toISOString(),
      },
    };

    const data = JSON.stringify(event);

    this.wss.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        try {
          client.send(data);
        } catch {
          // Ignore send errors for individual clients
        }
      }
    });
  }
}

const defaultReadReceiptService = new ReadReceiptService();

export default defaultReadReceiptService;