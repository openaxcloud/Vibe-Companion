import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import cookieSession from 'cookie-session';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app: Application = express();

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';
const TRUST_PROXY = process.env.TRUST_PROXY === 'true';
const SESSION_SECRET = process.env.SESSION_SECRET || 'change_this_secret';

if (TRUST_PROXY) {
  app.set('trust proxy', 1);
}

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }
    if (origin === CLIENT_ORIGIN) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization'
  ],
  optionsSuccessStatus: 204
};

if (!isTest) {
  app.use(cors(corsOptions));
}

if (isProduction) {
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
  });
  app.use('/api', limiter);
} else {
  app.use(
    helmet({
      contentSecurityPolicy: false
    })
  );
}

if (!isTest) {
  app.use(morgan(isProduction ? 'combined' : 'dev'));
}

app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  cookieSession({
    name: 'session',
    secret: SESSION_SECRET,
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'strict' : 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    signed: true
  })
);

// Example health check route
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    environment: NODE_ENV,
    timestamp: new Date().toISOString()
  });
});

// Example API route placeholder
app.get('/api/example', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Example endpoint' });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.originalUrl
  });
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (!isTest) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  const statusCode = (res.statusCode && res.statusCode !== 200) ? res.statusCode : 500;

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error'
  });
});

export default app;