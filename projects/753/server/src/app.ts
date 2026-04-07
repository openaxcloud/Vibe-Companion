import express, { Application, Request, Response, NextFunction } from 'express';
import cors, { CorsOptions } from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import routes from './routes';
import { NotFoundError } from './errors/NotFoundError';
import { errorHandler } from './middleware/errorHandler';

const createApp = (): Application => {
  const app = express();

  // Basic security headers
  app.use(helmet());

  // CORS configuration
  const corsOptions: CorsOptions = {
    origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
    ],
  };
  app.use(cors(corsOptions));

  // HTTP request logging (skip in test)
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('combined'));
  }

  // Compression
  app.use(compression());

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Cookie parsing
  app.use(cookieParser());

  // Static files (if needed)
  const publicDir = path.resolve(__dirname, '..', 'public');
  app.use('/public', express.static(publicDir));

  // Health check
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  // Mount main API routes
  app.use('/api', routes);

  // 404 handler for unmatched routes
  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('Route not found'));
  });

  // Global error handler
  app.use(errorHandler);

  return app;
};

const app: Application = createApp();

export { createApp, app };
export default app;