import { Request, Response, NextFunction } from 'express';

type CorsOptions = {
  allowedOrigin?: string;
  allowedMethods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  allowCredentials?: boolean;
  maxAgeSeconds?: number;
};

const DEFAULT_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
];

const DEFAULT_HEADERS = [
  'Origin',
  'X-Requested-With',
  'Content-Type',
  'Accept',
  'Authorization',
];

const DEFAULT_EXPOSED_HEADERS: string[] = [];

const parseEnvList = (value: string | undefined): string[] | undefined => {
  if (!value) return undefined;
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
};

const resolveAllowedOrigins = (): string[] | '*' => {
  const envVal =
    process.env.CORS_ALLOWED_ORIGINS ||
    process.env.FRONTEND_ORIGIN ||
    process.env.FRONTEND_URL;

  if (!envVal) {
    return '*';
  }

  const list = parseEnvList(envVal);
  if (!list || list.length === 0) {
    return '*';
  }

  if (list.length === 1 && list[0] === '*') {
    return '*';
  }

  return list;
};

const isOriginAllowed = (origin: string, allowed: string[] | '*'): boolean => {
  if (allowed === '*') return true;
  return allowed.includes(origin);
};

export const createCorsMiddleware = (options: CorsOptions = {}) => {
  const allowedOrigins = resolveAllowedOrigins();
  const allowedMethods = options.allowedMethods || DEFAULT_METHODS;
  const allowedHeaders = options.allowedHeaders || DEFAULT_HEADERS;
  const exposedHeaders = options.exposedHeaders || DEFAULT_EXPOSED_HEADERS;
  const allowCredentials =
    typeof options.allowCredentials === 'boolean'
      ? options.allowCredentials
      : true;
  const maxAgeSeconds =
    typeof options.maxAgeSeconds === 'number' ? options.maxAgeSeconds : 600;

  const allowedMethodsHeader = allowedMethods.join(', ');
  const allowedHeadersHeader = allowedHeaders.join(', ');
  const exposedHeadersHeader =
    exposedHeaders.length > 0 ? exposedHeaders.join(', ') : undefined;

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const requestOrigin = req.headers.origin as string | undefined;

    if (!requestOrigin) {
      return next();
    }

    const originIsAllowed = isOriginAllowed(requestOrigin, allowedOrigins);

    if (originIsAllowed) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
    } else if (allowedOrigins === '*') {
      res.header('Access-Control-Allow-Origin', '*');
    }

    if (allowCredentials && originIsAllowed) {
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (exposedHeadersHeader) {
      res.header('Access-Control-Expose-Headers', exposedHeadersHeader);
    }

    if (req.method === 'OPTIONS') {
      res.header('Vary', 'Origin');

      res.header('Access-Control-Allow-Methods', allowedMethodsHeader);
      res.header('Access-Control-Allow-Headers', allowedHeadersHeader);

      if (maxAgeSeconds > 0) {
        res.header('Access-Control-Max-Age', String(maxAgeSeconds));
      }

      if (!res.headersSent) {
        return res.sendStatus(204);
      }

      return;
    }

    res.header('Vary', 'Origin');

    return next();
  };

  return middleware;
};

const defaultCorsMiddleware = createCorsMiddleware();

export default defaultCorsMiddleware;