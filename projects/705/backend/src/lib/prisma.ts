import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

type Environment = 'development' | 'test' | 'production';

const env = (process.env.NODE_ENV || 'development') as Environment;

const isProduction = env === 'production';

const logLevels: Parameters<typeof PrismaClient>[0]['log'] =
  process.env.PRISMA_LOG
    ? (process.env.PRISMA_LOG.split(',')
        .map((l) => l.trim())
        .filter(Boolean) as any)
    : isProduction
    ? ['error']
    : ['query', 'info', 'warn', 'error'];

const prismaClientSingleton = () =>
  new PrismaClient({
    log: logLevels,
  });

const prisma = global.prisma ?? prismaClientSingleton();

if (!isProduction) {
  global.prisma = prisma;
}

const handlePrismaShutdown = async (signal: NodeJS.Signals) => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`Error during Prisma disconnect on undefined:`, error);
  } finally {
    process.exit(0);
  }
};

if (typeof process !== 'undefined' && process.on) {
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];

  for (const signal of signals) {
    process.on(signal, () => {
      void handlePrismaShutdown(signal);
    });
  }

  process.on('beforeExit', async () => {
    try {
      await prisma.$disconnect();
    } catch {
      // ignore
    }
  });
}

export { prisma };
export default prisma;