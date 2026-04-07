import 'dotenv/config';
import { Sequelize } from 'sequelize';
import models from '../models';
import { logger } from '../utils/logger';

type SyncOptions = {
  force?: boolean;
  alter?: boolean;
};

const isProd = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test';

const DEFAULT_SYNC_OPTIONS: SyncOptions = {
  force: false,
  alter: !isProd && !isTest,
};

function getSequelizeInstance(): Sequelize {
  if (!process.env.DB_URI) {
    throw new Error('DB_URI environment variable is not defined.');
  }

  return new Sequelize(process.env.DB_URI, {
    logging: (msg: string) => logger.debug(msg),
    dialectOptions: {
      ssl:
        process.env.DB_SSL === 'true'
          ? {
              require: true,
              rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
            }
          : undefined,
    },
  });
}

async function testConnection(sequelize: Sequelize): Promise<void> {
  try {
    await sequelize.authenticate();
    logger.info('Database connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    throw error;
  }
}

async function syncModels(sequelize: Sequelize, options: SyncOptions): Promise<void> {
  const syncOptions = {
    force: options.force ?? DEFAULT_SYNC_OPTIONS.force,
    alter: options.alter ?? DEFAULT_SYNC_OPTIONS.alter,
  };

  if (syncOptions.force) {
    logger.warn('Running sync with FORCE=true. THIS WILL DROP AND RECREATE TABLES.');
  } else if (syncOptions.alter) {
    logger.info('Running sync with ALTER=true. This will attempt to alter existing tables.');
  } else {
    logger.info('Running sync with default options (no force, no alter).');
  }

  try {
    // Ensure models are initialized with the sequelize instance
    Object.values(models).forEach((model: any) => {
      if (typeof model.initialize === 'function') {
        model.initialize(sequelize);
      }
    });

    // Setup associations if defined
    Object.values(models).forEach((model: any) => {
      if (typeof model.associate === 'function') {
        model.associate(models);
      }
    });

    await sequelize.sync(syncOptions);
    logger.info('All models were synchronized successfully.');
  } catch (error) {
    logger.error('Failed to synchronize models:', error);
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  const noAlter = args.includes('--no-alter');
  const alter = !noAlter && (args.includes('--alter') || DEFAULT_SYNC_OPTIONS.alter);

  const sequelize = getSequelizeInstance();

  try {
    logger.info('Starting database synchronization script...');
    logger.info(`Environment: undefined`);
    logger.info(`Sync options -> force: undefined, alter: undefined`);

    await testConnection(sequelize);
    await syncModels(sequelize, { force, alter });

    logger.info('Database synchronization completed successfully.');
    process.exitCode = 0;
  } catch (error) {
    logger.error('Database synchronization failed.', error);
    process.exitCode = 1;
  } finally {
    try {
      await sequelize.close();
      logger.info('Database connection closed.');
    } catch (closeError) {
      logger.error('Error closing database connection:', closeError);
    }
  }
}

if (require.main === module) {
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  main();
}

export { main as syncDatabase };