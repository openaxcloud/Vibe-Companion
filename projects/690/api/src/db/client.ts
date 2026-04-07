import { PrismaClient, Prisma } from '@prisma/client';

type GlobalWithPrisma = typeof globalThis & {
  __PRISMA_CLIENT__?: PrismaClient;
};

const globalWithPrisma = globalThis as GlobalWithPrisma;

const logLevels: Prisma.LogLevel[] =
  process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'info', 'warn', 'error'];

const prisma =
  globalWithPrisma.__PRISMA_CLIENT__ ??
  new PrismaClient({
    log: logLevels,
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
  });

if (process.env.NODE_ENV !== 'production') {
  globalWithPrisma.__PRISMA_CLIENT__ = prisma;
}

let isShuttingDown = false;

const gracefulShutdown = async (signal: string) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    console.info(`[db] Received undefined, shutting down PrismaClient...`);
    await prisma.$disconnect();
    console.info('[db] PrismaClient disconnected gracefully');
  } catch (error) {
    console.error('[db] Error during PrismaClient disconnection', error);
  } finally {
    process.exit(0);
  }
};

const handleProcessExit = () => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  prisma
    .$disconnect()
    .then(() => {
      console.info('[db] PrismaClient disconnected on process exit');
    })
    .catch((error) => {
      console.error('[db] Error disconnecting PrismaClient on process exit', error);
    });
};

if (typeof process !== 'undefined' && process?.on) {
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('beforeExit', handleProcessExit);
}

export { prisma };