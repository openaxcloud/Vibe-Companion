import { createLogger } from '../utils/logger';

const logger = createLogger('graceful-shutdown');

interface ShutdownHandler {
  name: string;
  handler: () => Promise<void> | void;
  priority: number;
}

class GracefulShutdownManager {
  private handlers: ShutdownHandler[] = [];
  private isShuttingDown = false;
  private shutdownTimeout = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);

  constructor() {
    this.setupSignalHandlers();
  }

  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT', 'SIGHUP'];
    
    signals.forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, initiating graceful shutdown...`);
        await this.shutdown(signal);
      });
    });

    process.on('uncaughtException', async (error) => {
      logger.error('Uncaught exception:', error);
      await this.shutdown('uncaughtException');
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled rejection at:', promise, 'reason:', reason);
    });

    logger.info('Signal handlers registered for graceful shutdown');
  }

  register(name: string, handler: () => Promise<void> | void, priority: number = 50): void {
    this.handlers.push({ name, handler, priority });
    this.handlers.sort((a, b) => a.priority - b.priority);
    logger.debug(`Registered shutdown handler: ${name} (priority: ${priority})`);
  }

  unregister(name: string): void {
    this.handlers = this.handlers.filter(h => h.name !== name);
    logger.debug(`Unregistered shutdown handler: ${name}`);
  }

  async shutdown(reason: string = 'unknown'): Promise<void> {
    if (this.isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring duplicate request');
      return;
    }

    this.isShuttingDown = true;
    logger.info(`Starting graceful shutdown (reason: ${reason})...`);

    const shutdownPromise = this.executeHandlers();
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Shutdown timeout after ${this.shutdownTimeout}ms`));
      }, this.shutdownTimeout);
    });

    try {
      await Promise.race([shutdownPromise, timeoutPromise]);
      logger.info('Graceful shutdown completed successfully');
    } catch (error) {
      logger.error('Graceful shutdown error:', error);
    }

    if (reason !== 'uncaughtException') {
      process.exit(0);
    }
  }

  private async executeHandlers(): Promise<void> {
    for (const { name, handler } of this.handlers) {
      try {
        logger.info(`Executing shutdown handler: ${name}`);
        await Promise.resolve(handler());
        logger.info(`Shutdown handler completed: ${name}`);
      } catch (error) {
        logger.error(`Shutdown handler failed: ${name}`, error);
      }
    }
  }

  isInShutdown(): boolean {
    return this.isShuttingDown;
  }
}

export const gracefulShutdownManager = new GracefulShutdownManager();

export function registerShutdownHandler(
  name: string,
  handler: () => Promise<void> | void,
  priority: number = 50
): void {
  gracefulShutdownManager.register(name, handler, priority);
}

export function initializeGracefulShutdown(): void {
  logger.info('Graceful shutdown manager initialized');
}
