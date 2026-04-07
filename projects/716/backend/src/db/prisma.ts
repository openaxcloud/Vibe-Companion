import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

const isProd: boolean = process.env.NODE_ENV === 'production';

const logLevels: Prisma.LogLevel[] = isProd ? ['error', 'warn'] : ['query', 'info', 'warn', 'error'];

const prismaClientOptions: Prisma.PrismaClientOptions = {
  log: logLevels,
};

let prisma: PrismaClient;

if (!global.__PRISMA_CLIENT__) {
  prisma = new PrismaClient(prismaClientOptions);

  const handleExit = async (signal: NodeJS.Signals | 'exit'): Promise<void> => {
    try {
      await prisma.$disconnect();
    } catch {
      // Optional: log error with your preferred logger
    } finally {
      if (signal !== 'exit') {
        process.exit(0);
      }
    }
  };

  process.on('beforeExit', () => {
    void handleExit('exit');
  });

  process.on('SIGINT', () => {
    void handleExit('SIGINT');
  });

  process.on('SIGTERM', () => {
    void handleExit('SIGTERM');
  });

  process.on('SIGQUIT', () => {
    void handleExit('SIGQUIT');
  });

  global.__PRISMA_CLIENT__ = prisma;
} else {
  prisma = global.__PRISMA_CLIENT__;
}

export { prisma };
export default prisma;