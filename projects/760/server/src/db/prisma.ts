import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

const isProd: boolean = process.env.NODE_ENV === 'production';
const isTest: boolean = process.env.NODE_ENV === 'test';

const prismaClientSingleton = (): PrismaClient => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  const logConfig =
    isProd || isTest
      ? []
      : ([
          { emit: 'stdout', level: 'query' },
          { emit: 'stdout', level: 'info' },
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
        ] as const);

  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    log: logConfig,
  });
};

let prisma: PrismaClient;

if (!isProd) {
  if (!global.__PRISMA_CLIENT__) {
    global.__PRISMA_CLIENT__ = prismaClientSingleton();
  }
  prisma = global.__PRISMA_CLIENT__;
} else {
  prisma = prismaClientSingleton();
}

const registerShutdownHooks = (client: PrismaClient): void => {
  const shutdown = async (signal: NodeJS.Signals | 'exit') => {
    try {
      await client.$disconnect();
    } catch {
      // ignore disconnection errors during shutdown
    } finally {
      if (signal !== 'exit' && typeof process.exit === 'function') {
        process.exit(0);
      }
    }
  };

  if (typeof process !== 'undefined' && process.listenerCount) {
    if (!process.listenerCount('beforeExit')) {
      process.once('beforeExit', () => shutdown('exit'));
    }
    if (!process.listenerCount('SIGINT')) {
      process.once('SIGINT', () => shutdown('SIGINT'));
    }
    if (!process.listenerCount('SIGTERM')) {
      process.once('SIGTERM', () => shutdown('SIGTERM'));
    }
  }
};

registerShutdownHooks(prisma);

export { prisma };
export default prisma;