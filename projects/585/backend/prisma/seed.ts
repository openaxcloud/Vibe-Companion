import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

type SeedUser = {
  email: string;
  name: string;
  password: string;
  avatarUrl?: string | null;
};

type SeedChannel = {
  name: string;
  description?: string | null;
  isPrivate?: boolean;
  memberEmails: string[];
};

type SeedMessage = {
  authorEmail: string;
  channelName: string;
  content: string;
  createdAtOffsetMinutes?: number;
};

const SALT_ROUNDS = 10;

const usersSeed: SeedUser[] = [
  {
    email: 'alice@example.com',
    name: 'Alice Johnson',
    password: 'Password123!',
    avatarUrl: 'https://i.pravatar.cc/150?img=1',
  },
  {
    email: 'bob@example.com',
    name: 'Bob Smith',
    password: 'Password123!',
    avatarUrl: 'https://i.pravatar.cc/150?img=2',
  },
  {
    email: 'charlie@example.com',
    name: 'Charlie Davis',
    password: 'Password123!',
    avatarUrl: 'https://i.pravatar.cc/150?img=3',
  },
  {
    email: 'diana@example.com',
    name: 'Diana Prince',
    password: 'Password123!',
    avatarUrl: 'https://i.pravatar.cc/150?img=4',
  },
];

const channelsSeed: SeedChannel[] = [
  {
    name: 'general',
    description: 'General discussion for all team members',
    isPrivate: false,
    memberEmails: usersSeed.map((u) => u.email),
  },
  {
    name: 'random',
    description: 'Off-topic conversations and fun stuff',
    isPrivate: false,
    memberEmails: usersSeed.map((u) => u.email),
  },
  {
    name: 'engineering',
    description: 'Technical discussions and code reviews',
    isPrivate: true,
    memberEmails: ['alice@example.com', 'bob@example.com', 'charlie@example.com'],
  },
  {
    name: 'product',
    description: 'Product roadmap and planning',
    isPrivate: true,
    memberEmails: ['alice@example.com', 'diana@example.com'],
  },
];

const messagesSeed: SeedMessage[] = [
  {
    authorEmail: 'alice@example.com',
    channelName: 'general',
    content: 'Welcome to the workspace, everyone! 🎉',
    createdAtOffsetMinutes: -120,
  },
  {
    authorEmail: 'bob@example.com',
    channelName: 'general',
    content: 'Hey all, excited to be here.',
    createdAtOffsetMinutes: -115,
  },
  {
    authorEmail: 'charlie@example.com',
    channelName: 'general',
    content: 'Hi team, looking forward to collaborating.',
    createdAtOffsetMinutes: -110,
  },
  {
    authorEmail: 'diana@example.com',
    channelName: 'general',
    content: 'Hello everyone! Let’s build something great.',
    createdAtOffsetMinutes: -105,
  },
  {
    authorEmail: 'alice@example.com',
    channelName: 'engineering',
    content: 'I pushed a new branch for the authentication flow. Please review when you have time.',
    createdAtOffsetMinutes: -90,
  },
  {
    authorEmail: 'bob@example.com',
    channelName: 'engineering',
    content: 'I’ll take a look this afternoon and leave some comments.',
    createdAtOffsetMinutes: -85,
  },
  {
    authorEmail: 'charlie@example.com',
    channelName: 'engineering',
    content: 'Let’s standardize our error handling patterns in the new code.',
    createdAtOffsetMinutes: -80,
  },
  {
    authorEmail: 'alice@example.com',
    channelName: 'product',
    content: 'I’ve shared the latest product requirements in the docs folder.',
    createdAtOffsetMinutes: -70,
  },
  {
    authorEmail: 'diana@example.com',
    channelName: 'product',
    content: 'Thanks, Alice. I’ll add some notes about the user onboarding flow.',
    createdAtOffsetMinutes: -65,
  },
  {
    authorEmail: 'bob@example.com',
    channelName: 'random',
    content: 'Anyone up for a virtual coffee later today? ☕',
    createdAtOffsetMinutes: -50,
  },
  {
    authorEmail: 'charlie@example.com',
    channelName: 'random',
    content: 'Count me in!',
    createdAtOffsetMinutes: -48,
  },
  {
    authorEmail: 'alice@example.com',
    channelName: 'random',
    content: 'Sounds good to me.',
    createdAtOffsetMinutes: -47,
  },
];

async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

async function clearDatabase(): Promise<void> {
  // Order matters if there are foreign key constraints
  await prisma.message.deleteMany();
  await prisma.channelMembership.deleteMany().catch(() => undefined);
  await prisma.channel.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers(): Promise<Record<string, { id: string }>> {
  const userMap: Record<string, { id: string }> = {};

  for (const user of usersSeed) {
    const passwordHash = await hashPassword(user.password);

    const data: Prisma.UserCreateInput = {
      email: user.email,
      name: user.name,
      passwordHash,
      avatarUrl: user.avatarUrl ?? null,
    };

    const created = await prisma.user.create({ data });
    userMap[user.email] = { id: created.id };
  }

  return userMap;
}

async function seedChannels(userMap: Record<string, { id: string }>): Promise<Record<string, { id: string }>> {
  const channelMap: Record<string, { id: string }> = {};

  for (const channel of channelsSeed) {
    const memberIds = channel.memberEmails
      .map((email) => userMap[email]?.id)
      .filter((id): id is string => Boolean(id));

    const data: Prisma.ChannelCreateInput = {
      name: channel.name,
      description: channel.description ?? null,
      isPrivate: channel.isPrivate ?? false,
      memberships: {
        create: memberIds.map((userId) => ({
          user: { connect: { id: userId } },
        })),
      },
    };

    const created = await prisma.channel.create({ data });
    channelMap[channel.name] = { id: created.id };
  }

  return channelMap;
}

async function seedMessages(
  userMap: Record<string, { id: string }>,
  channelMap: Record<string, { id: string }>
): Promise<void> {
  const now = new Date();

  for (const message of messagesSeed) {
    const author = userMap[message.authorEmail];
    const channel = channelMap[message.channelName];

    if (!author || !channel) {
      continue;
    }

    const createdAt = new Date(
      now.getTime() + (message.createdAtOffsetMinutes ?? 0) * 60 * 1000
    );

    const data: Prisma.MessageCreateInput = {
      content: message.content,
      createdAt,
      author: {
        connect: { id: author.id },
      },
      channel: {
        connect: { id: channel.id },
      },
    };

    await prisma.message.create({ data });
  }
}

async function main(): Promise<void> {
  console.log('🌱 Starting database seeding...');
  await clearDatabase();
  console.log('✅ Cleared existing data');

  const userMap = await seedUsers();
  console.log(`✅ Seeded undefined users`);

  const channelMap = await seedChannels(userMap);
  console.log(`✅ Seeded undefined channels with memberships`);

  await seedMessages(userMap, channelMap);
  console.log('✅ Seeded messages');

  console.log('🌱 Database seeding completed successfully');
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('❌ Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });