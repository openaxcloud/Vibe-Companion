import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  const logLevels =
    process.env.NODE_ENV === 'development'
      ? ['query', 'info', 'warn', 'error'] as const
      : ['error', 'warn'] as const;

  const client = new PrismaClient({
    log: logLevels,
  });

  if (process.env.NODE_ENV === 'development') {
    client.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;

      if (duration > 200) {
        // eslint-disable-next-line no-console
        console.warn(
          `[Prisma] Slow query (undefinedms) on undefined.undefined`
        );
      }

      return result;
    });
  }

  return client;
};

let prisma: PrismaClient;

if (process.env.NODE_ENV === 'production') {
  prisma = createPrismaClient();
} else {
  if (!global.__PRISMA_CLIENT__) {
    global.__PRISMA_CLIENT__ = createPrismaClient();
  }
  prisma = global.__PRISMA_CLIENT__;
}

export { prisma };
export default prisma;