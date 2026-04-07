import { Sequelize, Options } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const {
  DB_HOST,
  DB_PORT,
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  DB_LOGGING,
  NODE_ENV,
} = process.env;

if (!DB_HOST || !DB_PORT || !DB_NAME || !DB_USER) {
  throw new Error(
    'Database configuration error: DB_HOST, DB_PORT, DB_NAME, and DB_USER must be provided in environment variables.'
  );
}

const isProduction = NODE_ENV === 'production';

const sequelizeOptions: Options = {
  host: DB_HOST,
  port: Number(DB_PORT),
  database: DB_NAME,
  username: DB_USER,
  password: DB_PASSWORD,
  dialect: 'postgres',
  logging:
    DB_LOGGING === 'true'
      ? (msg: string) => {
          // Centralized logging hook for SQL queries
          // Replace with a proper logger (e.g., Winston, Pino) if available
          // eslint-disable-next-line no-console
          console.debug(`[Sequelize] undefined`);
        }
      : false,
  pool: {
    max: isProduction ? 15 : 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    underscored: true,
    freezeTableName: false,
    timestamps: true,
    paranoid: false,
  },
  dialectOptions: isProduction
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
      }
    : {},
};

export const sequelize = new Sequelize(sequelizeOptions);

export const initializeDatabase = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    // eslint-disable-next-line no-console
    console.log('Database connection has been established successfully.');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Unable to connect to the database:', error);
    throw error;
  }
};

export default sequelize;