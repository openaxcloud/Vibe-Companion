import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import prisma from '../prismaClient';
import { authMiddleware } from '../middleware/authMiddleware';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

const createChannelSchema = z.object({
  name: z.string().min(1).max(100),
  isPrivate: z.boolean().optional().default(false),
  description: z.string().max(255).optional(),
  memberIds: z.array(z.string().cuid()).optional(),
});

const updateMembersSchema = z.object({
  memberIds: z.array(z.string().cuid()).min(1),
});

const validateBody =
  <T>(schema: z.ZodSchema<T>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const parseResult = schema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid request body',
        details: parseResult.error.flatten(),
      });
      return;
    }
    (req as any).validatedBody = parseResult.data;
    next();
  };

const ensureAuthenticated = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
};

// Helper to check channel membership
const isMemberOfChannel = async (userId: string, channelId: string): Promise<boolean> => {
  const membership = await prisma.channelMember.findFirst({
    where: {
      userId,
      channelId,
    },
    select: { id: true },
  });
  return !!membership;
};

// Helper to fetch channel with membership info
const getChannelForUser = async (userId: string, channelId: string) => {
  return prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
      _count: {
        select: { members: true },
      },
    },
  });
};

// POST /api/channels - create new channel
router.post(
  '/',
  authMiddleware,
  ensureAuthenticated,
  validateBody(createChannelSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name, isPrivate, description, memberIds } = (req as any).validatedBody as z.infer<
        typeof createChannelSchema
      >;

      const creatorId = req.user!.id;

      const uniqueMemberIds = new Set<string>([creatorId, ...(memberIds ?? [])]);

      const channel = await prisma.$transaction(async (tx) => {
        const createdChannel = await tx.channel.create({
          data: {
            name,
            isPrivate: Boolean(isPrivate),
            description: description ?? null,
            createdById: creatorId,
          },
        });

        await tx.channelMember.createMany({
          data: Array.from(uniqueMemberIds).map((userId) => ({
            channelId: createdChannel.id,
            userId,
          })),
          skipDuplicates: true,
        });

        return createdChannel;
      });

      const fullChannel = await getChannelForUser(creatorId, channel.id);

      res.status(201).json(fullChannel);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error creating channel:', error);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  }
);

// GET /api/channels - list channels the user has joined
router.get(
  '/',
  authMiddleware,
  ensureAuthenticated,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const channels = await prisma.channel.findMany({
        where: {
          members: {
            some: {
              userId,
            },
          },
        },
        include: {
          _count: {
            select: { members: true },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      res.json(channels);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching joined channels:', error);
      res.status(500).json({ error: 'Failed to fetch joined channels' });
    }
  }
);

// GET /api/channels/all - list all channels user can see
router.get(
  '/all',
  authMiddleware,
  ensureAuthenticated,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;

      const channels = await prisma.channel.findMany({
        where: {
          OR: [
            {
              isPrivate: false,
            },
            {
              isPrivate: true,
              members: {
                some: {
                  userId,
                },
              },
            },
          ],
        },
        include: {
          _count: {
            select: { members: true },
          },
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });

      res.json(channels);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching all channels:', error);
      res.status(500).json({ error: 'Failed to fetch channels' });
    }
  }
);

// GET /api/channels/:id - get channel details
router.get(
  '/:id',
  authMiddleware,
  ensureAuthenticated,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const channelId = req.params.id;

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          members: {
            include: {
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          _count: {
            select: { members: true },
          },
        },
      });

      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }

      if (channel.isPrivate) {
        const isMember = await isMemberOfChannel(userId, channelId);
        if (!isMember) {
          res.status(403).json({ error: 'Access denied to private channel' });
          return;
        }
      }

      res.json(channel);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching channel details:', error);
      res.status(500).json({ error: 'Failed to fetch channel details' });
    }
  }
);

// POST /api/channels/:id/members - add members to a channel
router.post(
  '/:id/members',
  authMiddleware,
  ensureAuthenticated,
  validateBody(updateMembersSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const channelId = req.params.id;
      const { memberIds } = (req as any).validatedBody as z.infer<typeof updateMembersSchema>;

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          members: {
            select: { userId: true },
          },
        },
      });

      if (!channel) {
        res.status(404).json({ error: 'Channel not found' });
        return;
      }

      const isMember = channel.members.some((m) => m.userId === userId);
      if (!isMember) {
        res.status(403).json({ error: 'Only channel members can add new members' });
        return;
      }

      const uniqueMemberIds = Array.from(new Set(memberIds));

      await prisma.channelMember.createMany({
        data: uniqueMemberIds.map((id) => ({
          channelId,
          userId: id,
        })),
        skipDuplicates: true,
      });

      const updatedChannel = await getChannelForUser(userId, channelId);

      res.status(200).json(updatedChannel);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error adding channel members:', error);
      res.status(500).json({ error: 'Failed to add channel members' });
    }
  }
);

// DELETE /api/channels/:id/members - remove members from a channel
router.delete(
  '/:id/members',
  authMiddleware,
  ensureAuthenticated,
  validateBody(updateMembersSchema),
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user!.id;
      const channelId = req.params.id;
      const { memberIds } = (req as any).validatedBody as z.infer<typeof updateMembersSchema>;

      const channel = await prisma.channel.findUnique({
        where: { id: channelId },
        include: {
          members: {
            select: { userId: true },
          },
        },
      });

      if (!channel) {
        res.status(404).json({ error: 'Channel