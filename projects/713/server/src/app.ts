import express, { Application, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import type { HttpError } from 'http-errors';

export interface AppConfig {
  corsOrigin?: string | RegExp | (string | RegExp)[];
  corsCredentials?: boolean;
  trustProxy?: boolean | string;
  jsonBodyLimit?: string;
  env?: 'development' | 'production' | 'test';
  baseApiPath?: string;
}

export interface ApiRouterFactory {
  (config?: AppConfig): express.Router;
}

export interface CreateAppOptions extends AppConfig {
  apiRouterFactory?: ApiRouterFactory;
}

const defaultCorsOptions: CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
  ],
  credentials: true,
};

function buildCorsOptions(config?: AppConfig): CorsOptions {
  const options: CorsOptions = { ...defaultCorsOptions };

  if (typeof config?.corsOrigin !== 'undefined') {
    options.origin = config.corsOrigin;
  }

  if (typeof config?.corsCredentials !== 'undefined') {
    options.credentials = config.corsCredentials;
  }

  return options;
}

function requestLogger(env: AppConfig['env']) {
  if (env === 'test') {
    return (req: Request, _res: Response, next: NextFunction): void => next();
  }
  return morgan(env === 'development' ? 'dev' : 'combined');
}

function notFoundHandler(req: Request, res: Response, _next: NextFunction): void {
  res.status(404).json({
    status: 404,
    message: 'Resource not found',
    path: req.originalUrl,
  });
}

function errorHandler(
  err: Error | HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const isHttpError = (error: any): error is HttpError =>
    typeof error.status === 'number' || typeof error.statusCode === 'number';

  const status = isHttpError(err) ? err.status || (err as any).statusCode || 500 : 500;
  const message = isHttpError(err) && err.message ? err.message : 'Internal server error';

  const responseBody: Record<string, unknown> = {
    status,
    message,
  };

  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    responseBody.error = {
      name: err.name,
      stack: err.stack,
    };
  }

  res.status(status).json(responseBody);
}

export function createApp(options: CreateAppOptions = {}): Application {
  const {
    env = (process.env.NODE_ENV as AppConfig['env']) || 'development',
    jsonBodyLimit = '1mb',
    trustProxy = process.env.TRUST_PROXY || false,
    baseApiPath = '/api',
    apiRouterFactory,
  } = options;

  const app = express();

  if (trustProxy) {
    app.set('trust proxy', trustProxy);
  }

  app.disable('x-powered-by');

  app.use(
    helmet({
      contentSecurityPolicy: env === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: env === 'production',
    }),
  );

  app.use(compression());

  app.use(requestLogger(env));

  app.use(cors(buildCorsOptions(options)));

  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
  app.use(cookieParser());

  if (apiRouterFactory) {
    app.use(baseApiPath, apiRouterFactory(options));
  }

  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      env,
    });
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;