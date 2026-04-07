import { PrismaClient } from '@prisma/client';

type Environment = 'development' | 'test' | 'production';

const env = (process.env.NODE_ENV as Environment) || 'development';

declare global {
  // eslint-disable-next-line no-var
  var __PRISMA_CLIENT__: PrismaClient | undefined;
}

const createPrismaClient = (): PrismaClient => {
  const log: Array<'query' | 'info' | 'warn' | 'error'> =
    env === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'];

  const client = new PrismaClient({ log });

  if (env === 'development') {
    client.$on('query', (event) => {
      // eslint-disable-next-line no-console
      console.debug(
        `[Prisma Query] undefined undefined` : ''} - Duration: undefinedms`
      );
    });
  }

  return client;
};

const prisma: PrismaClient =
  globalThis.__PRISMA_CLIENT__ ??
  (() => {
    const client = createPrismaClient();

    const gracefulShutdown = async (signal: NodeJS.Signals | 'exit') => {
      try {
        await client.$disconnect();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Error during PrismaClient disconnection:', error);
      } finally {
        if (signal !== 'exit') {
          process.exit(0);
        }
      }
    };

    process.on('beforeExit', () => gracefulShutdown('exit'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGQUIT', () => gracefulShutdown('SIGQUIT'));

    return client;
  })();

if (env === 'development') {
  globalThis.__PRISMA_CLIENT__ = prisma;
}

export { prisma };
export default prisma;