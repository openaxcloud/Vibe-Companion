import { PrismaClient, Prisma } from '@prisma/client';

type ExtendedPrismaClient = PrismaClient & {
  readonly isConnected: boolean;
};

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: ExtendedPrismaClient | undefined;
}

const createPrismaClient = (): ExtendedPrismaClient => {
  const logLevels: Prisma.LogLevel[] =
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['query', 'error', 'warn', 'info'];

  const client = new PrismaClient({
    log: logLevels,
  }) as ExtendedPrismaClient;

  let connected = false;

  Object.defineProperty(client, 'isConnected', {
    get() {
      return connected;
    },
    enumerable: true,
    configurable: false,
  });

  const connect = async () => {
    if (!connected) {
      await client.$connect();
      connected = true;
    }
  };

  const disconnect = async () => {
    if (connected) {
      await client.$disconnect();
      connected = false;
    }
  };

  // Attach lifecycle helpers without changing the type surface
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$ensureConnected = connect;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (client as any).$dispose = disconnect;

  client.$on('query', (e: Prisma.QueryEvent) => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    const duration = `undefinedms`;
    // Replace with your preferred logger if available
    // Example structured logging to stdout:
    console.debug(
      `[Prisma] Query`,
      JSON.stringify(
        {
          timestamp: e.timestamp,
          duration,
          target: e.target,
          query: e.query,
          params: e.params,
        },
        null,
        2
      )
    );
  });

  client.$on('error', (e: Prisma.LogEvent) => {
    console.error('[Prisma] Error', {
      timestamp: e.timestamp,
      target: e.target,
      message: e.message,
    });
  });

  client.$on('warn', (e: Prisma.LogEvent) => {
    console.warn('[Prisma] Warn', {
      timestamp: e.timestamp,
      target: e.target,
      message: e.message,
    });
  });

  client.$on('info', (e: Prisma.LogEvent) => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    console.info('[Prisma] Info', {
      timestamp: e.timestamp,
      target: e.target,
      message: e.message,
    });
  });

  return client;
};

const prisma: ExtendedPrismaClient =
  global.__PRISMA_CLIENT__ ??
  (() => {
    const client = createPrismaClient();
    if (process.env.NODE_ENV !== 'production') {
      global.__PRISMA_CLIENT__ = client;
    }
    return client;
  })();

export { prisma };
export type { ExtendedPrismaClient };