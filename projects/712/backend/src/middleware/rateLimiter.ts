import { Request, Response, NextFunction } from "express";

type RateLimiterKeyFn = (req: Request) => string | null | undefined;

export interface RateLimiterOptions {
  windowMs: number;
  max: number;
  message?: string | Record<string, unknown>;
  keyGenerator?: RateLimiterKeyFn;
  skip?: (req: Request) => boolean;
  onLimitReached?: (req: Request, res: Response, options: RateLimiterOptions) => void;
}

interface RateLimiterState {
  count: number;
  firstRequestTimestamp: number;
}

interface RateLimiterStore {
  get(key: string): RateLimiterState | undefined;
  set(key: string, value: RateLimiterState): void;
  delete(key: string): void;
}

class MemoryStore implements RateLimiterStore {
  private store: Map<string, RateLimiterState>;
  private cleanupInterval: NodeJS.Timeout;

  constructor(private windowMs: number) {
    this.store = new Map<string, RateLimiterState>();
    this.cleanupInterval = setInterval(() => this.cleanup(), Math.max(windowMs, 60_000));
    this.cleanupInterval.unref();
  }

  get(key: string): RateLimiterState | undefined {
    return this.store.get(key);
  }

  set(key: string, value: RateLimiterState): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.store.entries()) {
      if (now - value.firstRequestTimestamp > this.windowMs) {
        this.store.delete(key);
      }
    }
  }

  shutdown(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

export interface RateLimiterMiddleware {
  (req: Request, res: Response, next: NextFunction): void;
  shutdown?: () => void;
}

export interface CreateRateLimiterParams extends RateLimiterOptions {
  store?: RateLimiterStore;
}

const DEFAULT_MESSAGE = "Too many requests, please try again later.";

const defaultKeyGenerator: RateLimiterKeyFn = (req: Request): string | null => {
  const ip =
    (req.headers["x-forwarded-for"] as string | string[] | undefined) ||
    req.socket.remoteAddress ||
    req.ip;

  if (Array.isArray(ip)) {
    return ip[0];
  }

  return ip ?? null;
};

export function createRateLimiter(options: CreateRateLimiterParams): RateLimiterMiddleware {
  const {
    windowMs,
    max,
    message = DEFAULT_MESSAGE,
    keyGenerator = defaultKeyGenerator,
    skip,
    onLimitReached,
    store: providedStore,
  } = options;

  if (!windowMs || windowMs <= 0) {
    throw new Error("RateLimiter: 'windowMs' must be a positive number.");
  }

  if (!max || max <= 0) {
    throw new Error("RateLimiter: 'max' must be a positive number.");
  }

  const store = providedStore ?? new MemoryStore(windowMs);
  const isMemoryStore = store instanceof MemoryStore;

  const rateLimiter: RateLimiterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (skip && skip(req)) {
        next();
        return;
      }

      const key = keyGenerator(req);
      if (!key) {
        next();
        return;
      }

      const now = Date.now();
      const record = store.get(key);

      if (!record || now - record.firstRequestTimestamp > windowMs) {
        store.set(key, { count: 1, firstRequestTimestamp: now });
        next();
        return;
      }

      record.count += 1;
      store.set(key, record);

      const remaining = max - record.count;

      res.setHeader("X-RateLimit-Limit", max.toString());
      res.setHeader("X-RateLimit-Remaining", Math.max(0, remaining).toString());
      const resetSeconds = Math.ceil((record.firstRequestTimestamp + windowMs - now) / 1000);
      res.setHeader("X-RateLimit-Reset", Math.max(0, resetSeconds).toString());

      if (record.count > max) {
        if (onLimitReached) {
          onLimitReached(req, res, options);
        }
        res.status(429).json(
          typeof message === "string"
            ? { error: "rate_limit_exceeded", message }
            : message
        );
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };

  rateLimiter.shutdown = (): void => {
    if (isMemoryStore) {
      (store as MemoryStore).shutdown();
    }
  };

  return rateLimiter;
}

export function createLoginRateLimiter(): RateLimiterMiddleware {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many login attempts. Please try again in 15 minutes.",
  });
}

export function createStrictLoginRateLimiter(): RateLimiterMiddleware {
  return createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts. Please try again in 15 minutes.",
  });
}