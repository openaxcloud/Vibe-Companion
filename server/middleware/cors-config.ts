import cors from 'cors';
import { Express, Request, Response, NextFunction } from 'express';

function getAllowedOrigins(): string[] {
  const allowedOrigins: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  if (process.env.ALLOWED_ORIGINS) {
    const origins = process.env.ALLOWED_ORIGINS.split(',')
      .map(origin => origin.trim())
      .filter(origin => origin.length > 0);
    allowedOrigins.push(...origins);
  }

  if (isProduction) {
    if (!process.env.ALLOWED_ORIGINS && process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',')
        .map(domain => domain.trim())
        .filter(domain => domain.length > 0)
        .map(domain => {
          if (domain.startsWith('https://') || domain.startsWith('http://')) {
            return domain;
          }
          return `https://${domain}`;
        });
      allowedOrigins.push(...domains);
    }
  } else {
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    if (process.env.APP_URL) {
      allowedOrigins.push(process.env.APP_URL);
    }
    if (process.env.REPLIT_DOMAINS) {
      const domains = process.env.REPLIT_DOMAINS.split(',')
        .map(d => d.trim()).filter(d => d.length > 0)
        .map(d => d.startsWith('http') ? d : `https://${d}`);
      allowedOrigins.push(...domains);
    }
    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
      allowedOrigins.push(`https://${process.env.REPL_SLUG}-${process.env.REPL_OWNER}.replit.app`);
      allowedOrigins.push(`https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    }
    if (process.env.REPLIT_DEV_DOMAIN) {
      allowedOrigins.push(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    allowedOrigins.push(
      'http://localhost:3000',
      'http://localhost:5000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5000',
      'http://127.0.0.1:5173'
    );
  }

  return [...new Set(allowedOrigins)];
}

function validateProductionCors(origins: string[]): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    if (origins.length === 0) {
      console.error('');
      console.error('════════════════════════════════════════════════════════════════');
      console.error('  CRITICAL: CORS CONFIGURATION MISSING IN PRODUCTION');
      console.error('════════════════════════════════════════════════════════════════');
      console.error('');
      console.error('Production environments MUST have CORS origins configured.');
      console.error('Set ALLOWED_ORIGINS to a comma-separated list of allowed origins.');
      console.error('  Example: ALLOWED_ORIGINS=https://app.example.com,https://www.example.com');
      console.error('');
      console.error('For Replit deployments, REPLIT_DOMAINS is auto-detected as a fallback.');
      console.error('');
      console.error('════════════════════════════════════════════════════════════════');
      console.error('');
      process.exit(1);
    }

    for (const origin of origins) {
      if (origin.startsWith('http://') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        console.warn(`[CORS WARNING] Insecure HTTP origin in production: ${origin}`);
      }
    }
  }
}

export function createCorsMiddleware(): cors.CorsOptions {
  const allowedOrigins = getAllowedOrigins();
  const isProduction = process.env.NODE_ENV === 'production';

  validateProductionCors(allowedOrigins);

  const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
      // Requests with no Origin header (curl, wget, server-side health checks)
      // skip the origin check and are always allowed through.
      if (!origin || origin === 'null') {
        if (isProduction && origin === 'null') {
          console.warn(`[CORS] Rejected explicit null origin in production`);
          const err = new Error('Not allowed by CORS');
          (err as any).statusCode = 403;
          return callback(err);
        }
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      if (!isProduction) {
        const originWithoutPort = origin.replace(/:\d+$/, '');
        if (originWithoutPort !== origin && allowedOrigins.includes(originWithoutPort)) {
          return callback(null, true);
        }

        const replitDevPatterns = [
          /^https:\/\/[a-f0-9-]+-\d+-[a-z0-9]+\.riker\.replit\.dev(:\d+)?$/,
          /^https:\/\/[a-f0-9-]+-\d+-[a-z0-9]+\.kirk\.replit\.dev(:\d+)?$/,
          /^https:\/\/[a-f0-9-]+-\d+-[a-z0-9]+\.spock\.replit\.dev(:\d+)?$/,
          /^https:\/\/[a-z0-9-]+\.replit\.app(:\d+)?$/,
          /^https:\/\/[a-z0-9-]+\.repl\.co(:\d+)?$/,
        ];

        if (replitDevPatterns.some(pattern => pattern.test(origin))) {
          return callback(null, true);
        }
      }

      console.warn(`[CORS] Rejected origin: ${origin}`);
      const err = new Error('Not allowed by CORS');
      (err as any).statusCode = 403;
      callback(err);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'Accept',
      'Origin'
    ],
    exposedHeaders: [
      'X-Total-Count',
      'X-Page',
      'X-Per-Page',
      'X-CSRF-Token'
    ],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204
  };

  return corsOptions;
}

export function configureCors(app: Express): void {
  try {
    const corsOptions = createCorsMiddleware();
    app.use(cors(corsOptions));

    app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
      if (err && err.message === 'Not allowed by CORS') {
        return res.status(403).json({ error: 'Forbidden: origin not allowed by CORS policy' });
      }
      next(err);
    });
  } catch (error) {
    console.error('[CORS] Failed to configure CORS:', error);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

export function verifyCorsConfiguration(): { isValid: boolean; message: string; origins?: string[] } {
  try {
    const allowedOrigins = getAllowedOrigins();

    if (process.env.NODE_ENV === 'production') {
      if (allowedOrigins.length === 0) {
        return {
          isValid: false,
          message: 'No allowed origins configured for production'
        };
      }

      return {
        isValid: true,
        message: 'CORS properly configured for production',
        origins: allowedOrigins
      };
    }

    return {
      isValid: true,
      message: 'CORS configured for development',
      origins: allowedOrigins.length > 0 ? allowedOrigins : ['Development mode - localhost allowed']
    };
  } catch (error: any) {
    return {
      isValid: false,
      message: `CORS configuration error: ${error.message}`
    };
  }
}

export { getAllowedOrigins, validateProductionCors };
