import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

type ExtendedPrismaClient = PrismaClient & {
  $connectIfNeeded: () => Promise<void>;
  $disconnectIfPossible: () => Promise<void>;
  readonly isConnected: boolean;
};

const createPrismaClient = (): ExtendedPrismaClient => {
  const logLevels: Parameters<typeof PrismaClient>[0]['log'] =
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'info', 'warn', 'error'];

  const client = new PrismaClient({
    log: logLevels,
  }) as ExtendedPrismaClient;

  let connected = false;

  client.$use(async (params, next) => {
    const start = performance.now();
    try {
      const result = await next(params);
      const duration = performance.now() - start;

      if (process.env.PRISMA_QUERY_LOG === 'true') {
        // Lightweight structured log, can be wired to a logger later
        // eslint-disable-next-line no-console
        console.debug(
          `[Prisma] undefined.undefined (undefined ms)`,
        );
      }

      return result;
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Prisma] Error executing query', {
        model: params.model,
        action: params.action,
        error,
      });
      throw error;
    }
  });

  client.$connectIfNeeded = async () => {
    if (connected) return;
    try {
      await client.$connect();
      connected = true;
      // eslint-disable-next-line no-console
      console.info('[Prisma] Connected to database');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Prisma] Failed to connect to database', error);
      throw error;
    }
  };

  client.$disconnectIfPossible = async () => {
    if (!connected) return;
    try {
      await client.$disconnect();
      connected = false;
      // eslint-disable-next-line no-console
      console.info('[Prisma] Disconnected from database');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[Prisma] Error during disconnection', error);
    }
  };

  Object.defineProperty(client, 'isConnected', {
    get: () => connected,
  });

  const handleProcessExit = async (signal: NodeJS.Signals | 'exit') => {
    try {
      await client.$disconnectIfPossible();
    } finally {
      if (signal !== 'exit') {
        process.exit(0);
      }
    }
  };

  process.once('beforeExit', () => void handleProcessExit('exit'));
  process.once('SIGINT', () => void handleProcessExit('SIGINT'));
  process.once('SIGTERM', () => void handleProcessExit('SIGTERM'));

  return client;
};

const prisma: ExtendedPrismaClient =
  globalThis.__PRISMA_CLIENT__ ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__PRISMA_CLIENT__ = prisma;
}

export { prisma };
export type { ExtendedPrismaClient };