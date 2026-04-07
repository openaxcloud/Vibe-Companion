import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

const isProduction = process.env.NODE_ENV === 'production';

const prismaClientSingleton = (): PrismaClient => {
  const logConfig =
    !isProduction
      ? ['query', 'info', 'warn', 'error'] as const
      : ['error', 'warn'] as const;

  return new PrismaClient({
    log: logConfig,
  });
};

const prisma = (() => {
  if (isProduction) {
    return prismaClientSingleton();
  }

  if (!global.__PRISMA_CLIENT__) {
    global.__PRISMA_CLIENT__ = prismaClientSingleton();
  }

  return global.__PRISMA_CLIENT__;
})();

export { prisma };
export default prisma;