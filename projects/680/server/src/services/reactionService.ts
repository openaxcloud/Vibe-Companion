import { PrismaClient, Reaction, ReactionType } from '@prisma/client';

const prisma = new PrismaClient();

export type ToggleReactionInput = {
  userId: string;
  messageId: string;
  type: ReactionType;
};

export type ReactionCountByType = {
  type: ReactionType;
  count: number;
};

export type MessageReactionsSummary = {
  messageId: string;
  totalCount: number;
  countsByType: ReactionCountByType[];
  userReactions: ReactionType[];
};

export class ReactionService {
  async toggleReaction(input: ToggleReactionInput): Promise<MessageReactionsSummary> {
    const { userId, messageId, type } = input;

    const existingReaction = await prisma.reaction.findFirst({
      where: {
        userId,
        messageId,
      },
    });

    if (existingReaction && existingReaction.type === type) {
      await prisma.reaction.delete({
        where: {
          id: existingReaction.id,
        },
      });
    } else if (existingReaction && existingReaction.type !== type) {
      await prisma.reaction.update({
        where: {
          id: existingReaction.id,
        },
        data: {
          type,
        },
      });
    } else if (!existingReaction) {
      await prisma.reaction.create({
        data: {
          userId,
          messageId,
          type,
        },
      });
    }

    return this.getReactionsSummaryForMessage(messageId, userId);
  }

  async getReactionsSummaryForMessage(
    messageId: string,
    userId?: string
  ): Promise<MessageReactionsSummary> {
    const [aggregates, userReactions] = await Promise.all([
      prisma.reaction.groupBy({
        by: ['type'],
        where: {
          messageId,
        },
        _count: {
          _all: true,
        },
      }),
      userId
        ? prisma.reaction.findMany({
            where: {
              messageId,
              userId,
            },
            select: {
              type: true,
            },
          })
        : Promise.resolve([] as { type: ReactionType }[]),
    ]);

    const countsByType: ReactionCountByType[] = aggregates.map((agg) => ({
      type: agg.type,
      count: agg._count._all,
    }));

    const totalCount = countsByType.reduce((sum, item) => sum + item.count, 0);

    return {
      messageId,
      totalCount,
      countsByType,
      userReactions: userReactions.map((r) => r.type),
    };
  }

  async clearReactionsForMessage(messageId: string): Promise<void> {
    await prisma.reaction.deleteMany({
      where: {
        messageId,
      },
    });
  }

  async clearUserReactionsForMessage(userId: string, messageId: string): Promise<void> {
    await prisma.reaction.deleteMany({
      where: {
        userId,
        messageId,
      },
    });
  }

  async getUserReactionsForMessage(
    userId: string,
    messageId: string
  ): Promise<ReactionType[]> {
    const reactions = await prisma.reaction.findMany({
      where: {
        userId,
        messageId,
      },
      select: {
        type: true,
      },
    });

    return reactions.map((r) => r.type);
  }

  async getReactionsForMessage(messageId: string): Promise<Reaction[]> {
    return prisma.reaction.findMany({
      where: {
        messageId,
      },
    });
  }
}

const reactionService = new ReactionService();
export default reactionService;