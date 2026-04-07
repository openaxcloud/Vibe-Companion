import cors, { CorsOptions, CorsRequest } from "cors";
import { RequestHandler } from "express";

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

const allowedOrigins: string[] = [FRONTEND_ORIGIN];

const corsOptionsDelegate = (
  req: CorsRequest,
  callback: (err: Error | null, options?: CorsOptions) => void
): void => {
  const origin = req.header("Origin") || undefined;

  const isAllowedOrigin =
    !origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development";

  const corsOptions: CorsOptions = {
    origin: isAllowedOrigin ? origin || true : false,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Origin",
      "X-Requested-With",
      "Content-Type",
      "Accept",
      "Authorization",
      "X-CSRF-Token",
    ],
    exposedHeaders: ["Content-Length", "X-Request-Id"],
    maxAge: 86400,
  };

  callback(null, corsOptions);
};

export const corsMiddleware: RequestHandler = cors(corsOptionsDelegate);

export default corsMiddleware;