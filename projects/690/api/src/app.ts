import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const app: Application = express();

const isProduction = process.env.NODE_ENV === 'production';
const clientOrigin =
  process.env.CLIENT_ORIGIN ||
  (isProduction ? 'https://your-production-client.com' : 'http://localhost:3000');

const corsOptions: CorsOptions = {
  origin: clientOrigin,
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

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors(corsOptions));
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (!isProduction) {
  app.use(morgan('dev'));
} else {
  app.use(
    morgan('combined', {
      skip: (_req, res) => res.statusCode < 400,
    })
  );
}

app.use('/api', apiLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Auth routes placeholder
app.use('/api/auth', (req: Request, res: Response, _next: NextFunction) => {
  res.status(501).json({ message: 'Auth routes not implemented' });
});

// Products routes placeholder
app.use('/api/products', (req: Request, res: Response, _next: NextFunction) => {
  res.status(501).json({ message: 'Products routes not implemented' });
});

// Cart routes placeholder
app.use('/api/cart', (req: Request, res: Response, _next: NextFunction) => {
  res.status(501).json({ message: 'Cart routes not implemented' });
});

// Orders routes placeholder
app.use('/api/orders', (req: Request, res: Response, _next: NextFunction) => {
  res.status(501).json({ message: 'Orders routes not implemented' });
});

// Payments routes placeholder
app.use('/api/payments', (req: Request, res: Response, _next: NextFunction) => {
  res.status(501).json({ message: 'Payments routes not implemented' });
});

// Webhooks routes placeholder (Stripe, etc.)
app.use('/api/webhooks', (req: Request, res: Response, _next: NextFunction) => {
  res.status(501).json({ message: 'Webhooks routes not implemented' });
});

// Static assets (if serving client or docs)
const publicDir = path.join(__dirname, '..', 'public');
app.use(express.static(publicDir));

app.use((req: Request, res: Response, _next: NextFunction) => {
  if (req.path === '/' || req.path === '/api') {
    res.status(200).json({
      name: 'E-Commerce API',
      version: process.env.npm_package_version || '1.0.0',
      status: 'running',
      endpoints: {
        health: '/health',
        auth: '/api/auth',
        products: '/api/products',
        cart: '/api/cart',
        orders: '/api/orders',
        payments: '/api/payments',
        webhooks: '/api/webhooks',
      },
    });
    return;
  }

  res.status(404).json({
    message: 'Resource not found',
    path: req.originalUrl,
  });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use(
  (
    err: Error & { statusCode?: number },
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const statusCode = err.statusCode || 500;

    if (!isProduction) {
      // eslint-disable-next-line no-console
      console.error(err);
    }

    res.status(statusCode).json({
      message: err.message || 'Internal Server Error',
      ...(isProduction
        ? {}
        : {
            stack: err.stack,
          }),
    });
  }
);

export { app };