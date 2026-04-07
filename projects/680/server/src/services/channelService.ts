import { PrismaClient, Channel, ChannelType, User, ChannelMembership, Prisma } from '@prisma/client';
import { ForbiddenError, NotFoundError, ValidationError } from '../utils/errors';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export type ChannelVisibility = 'public' | 'private' | 'direct';

export interface CreateChannelInput {
  name: string;
  description?: string | null;
  type: ChannelType;
  isPrivate?: boolean;
  memberIds?: string[];
}

export interface UpdateChannelInput {
  name?: string;
  description?: string | null;
  isArchived?: boolean;
}

export interface ChannelWithMembers extends Channel {
  members: (ChannelMembership & { user: User })[];
}

export interface ListUserChannelsOptions {
  includeArchived?: boolean;
  search?: string;
  cursor?: string | null;
  take?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  cursor: string | null;
  hasMore: boolean;
}

export interface AccessibleChannelFilter {
  includeDirect?: boolean;
  includePublic?: boolean;
  includePrivate?: boolean;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizePageSize(take?: number): number {
  if (!take || take <= 0) return DEFAULT_PAGE_SIZE;
  if (take > MAX_PAGE_SIZE) return MAX_PAGE_SIZE;
  return take;
}

async function ensureChannelExists(channelId: string): Promise<Channel> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  return channel;
}

async function isUserMemberOfChannel(userId: string, channelId: string): Promise<boolean> {
  const membership = await prisma.channelMembership.findUnique({
    where: {
      userId_channelId: {
        userId,
        channelId,
      },
    },
    select: { id: true },
  });

  return Boolean(membership);
}

async function ensureUserCanAccessChannel(userId: string, channel: Channel): Promise<void> {
  if (channel.type === 'PUBLIC') {
    return;
  }

  const isMember = await isUserMemberOfChannel(userId, channel.id);
  if (!isMember) {
    throw new ForbiddenError('You do not have access to this channel');
  }
}

async function validateChannelNameUnique(name: string): Promise<void> {
  const existing = await prisma.channel.findFirst({
    where: {
      name,
      isArchived: false,
    },
    select: { id: true },
  });

  if (existing) {
    throw new ValidationError('A channel with that name already exists', {
      field: 'name',
      code: 'CHANNEL_NAME_TAKEN',
    });
  }
}

async function validateChannelCreationRules(
  creatorId: string,
  input: CreateChannelInput,
): Promise<void> {
  if (!input.name || !input.name.trim()) {
    throw new ValidationError('Channel name is required', {
      field: 'name',
      code: 'REQUIRED',
    });
  }

  if (input.name.length > 80) {
    throw new ValidationError('Channel name is too long', {
      field: 'name',
      code: 'TOO_LONG',
    });
  }

  if (input.description && input.description.length > 500) {
    throw new ValidationError('Channel description is too long', {
      field: 'description',
      code: 'TOO_LONG',
    });
  }

  if (!['PUBLIC', 'PRIVATE', 'DIRECT'].includes(input.type)) {
    throw new ValidationError('Invalid channel type', {
      field: 'type',
      code: 'INVALID',
    });
  }

  if (input.type === 'DIRECT') {
    const memberCount = (input.memberIds?.length || 0) + 1;
    if (memberCount !== 2) {
      throw new ValidationError('Direct channels must have exactly two participants', {
        field: 'memberIds',
        code: 'INVALID_DIRECT_PARTICIPANTS',
      });
    }
  }

  if (input.type !== 'DIRECT') {
    await validateChannelNameUnique(input.name.trim());
  }
}

async function createDirectChannel(
  creatorId: string,
  memberIds: string[],
): Promise<ChannelWithMembers> {
  const participantIds = Array.from(new Set([creatorId, ...memberIds]));
  if (participantIds.length !== 2) {
    throw new ValidationError('Direct channels must have exactly two unique participants', {
      field: 'memberIds',
      code: 'INVALID_DIRECT_PARTICIPANTS',
    });
  }

  const existing = await prisma.channel.findFirst({
    where: {
      type: 'DIRECT',
      memberships: {
        every: {
          userId: {
            in: participantIds,
          },
        },
      },
    },
  });

  if (existing) {
    const full = await prisma.channel.findUnique({
      where: { id: existing.id },
      include: {
        members: {
          include: { user: true },
        },
      },
    });
    if (!full) {
      throw new NotFoundError('Direct channel disappeared during creation');
    }
    return full;
  }

  const channel = await prisma.$transaction(async (tx) => {
    const created = await tx.channel.create({
      data: {
        name: null,
        description: null,
        type: 'DIRECT',
        isArchived: false,
        createdById: creatorId,
        memberships: {
          createMany: {
            data: participantIds.map((userId) => ({
              userId,
              role: 'MEMBER',
            })),
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return created;
  });

  return channel;
}

export async function createChannel(
  creatorId: string,
  input: CreateChannelInput,
): Promise<ChannelWithMembers> {
  await validateChannelCreationRules(creatorId, input);

  if (input.type === 'DIRECT') {
    const memberIds = input.memberIds || [];
    return createDirectChannel(creatorId, memberIds);
  }

  const memberIds = Array.from(new Set([creatorId, ...(input.memberIds || [])]));

  const channel = await prisma.$transaction(async (tx) => {
    const created = await tx.channel.create({
      data: {
        name: input.name.trim(),
        description: input.description?.trim() || null,
        type: input.type,
        isArchived: false,
        isPrivate: input.isPrivate ?? input.type === 'PRIVATE',
        createdById: creatorId,
        memberships: {
          createMany: {
            data: memberIds.map((userId, index) => ({
              userId,
              role: index === 0 ? 'OWNER' : 'MEMBER',
            })),
          },
        },
      },
      include: {
        members: {
          include: { user: true },
        },
      },
    });

    return created;
  });

  return channel;
}

export async function getChannelById(
  requestingUserId: string,
  channelId: string,
): Promise<ChannelWithMembers> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      members: {
        include: { user: true },
      },
    },
  });

  if (!channel) {
    throw new NotFoundError('Channel not found');
  }

  await ensureUserCanAccessChannel(requestingUserId, channel);

  return channel;
}

export async function updateChannel(
  requestingUserId: string,
  channelId: string,
  input: UpdateChannelInput,
): Promise<ChannelWithMembers> {
  const channel = await ensureChannelExists(channelId);

  const membership = await prisma.channelMembership.findUnique({
    where: {
      userId_channelId: {
        userId: requestingUserId,
        channelId,
      },
    },
    select: { role: true },
  });

  if (!membership || (membership.role !== 'OWNER' && membership.role !== 'ADMIN')) {
    throw new ForbiddenError('You are not allowed to update this channel');
  }

  const data: Prisma.ChannelUpdateInput = {};

  if (typeof input.name === 'string') {
    const trimmed = input.name.trim();
    if (!trimmed) {
      throw new ValidationError('Channel name cannot be empty', {
        field: 'name',
        code: 'REQUIRED',
      });
    }
    if (trimmed.length > 80) {
      throw new ValidationError('Channel name is too long', {
        field: 'name',
        code: 'TOO_LONG',
      });
    }
    if (trimmed !== channel.name) {
      await validateChannelNameUnique(trimmed);
      data.name = trimmed;
    }
  }

  if (typeof input.description !== 'undefined') {
    if (input.description && input.description.length > 500) {
      throw new ValidationError('Channel description is too long', {
        field: 'description',
        code: 'TOO_LONG',
      });
    }
    data.description = input.description?.trim() || null;
  }

  if (typeof input.isArchived === 'boolean') {
    data.isArchived = input.isArchived;
  }

  const updated = await prisma.channel.update({
    where: { id: channelId },
    data,
    include: