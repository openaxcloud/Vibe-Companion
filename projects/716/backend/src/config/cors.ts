import cors, { CorsOptions, CorsOptionsDelegate, CorsRequest } from 'cors';
import { RequestHandler } from 'express';

const ALLOWED_ORIGINS: string[] = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
];

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] as const;
const DEFAULT_ALLOWED_HEADERS = [
  'Origin',
  'X-Requested-With',
  'Content-Type',
  'Accept',
  'Authorization',
  'X-CSRF-Token',
] as const;

export const corsOptions: CorsOptions | CorsOptionsDelegate<CorsRequest> = (
  request,
  callback,
) => {
  const origin = request.header('Origin');
  const isAllowed =
    !origin || ALLOWED_ORIGINS.includes(origin) || ALLOWED_ORIGINS.includes('*');

  const options: CorsOptions = {
    origin: isAllowed ? origin : false,
    methods: DEFAULT_ALLOWED_METHODS.join(','),
    allowedHeaders: DEFAULT_ALLOWED_HEADERS.join(','),
    credentials: true,
    optionsSuccessStatus: 204,
    maxAge: 600,
  };

  callback(null, options);
};

export const initCors = (): RequestHandler => {
  return cors(corsOptions);
};

export default initCors;