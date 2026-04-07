import cors, { CorsOptions, CorsOptionsDelegate } from "cors";

const parseAllowlist = (value?: string | null): string[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const allowedOrigins: string[] = parseAllowlist(process.env.CORS_ALLOWLIST);

const defaultMethods: string[] = [
  "GET",
  "HEAD",
  "PUT",
  "PATCH",
  "POST",
  "DELETE",
  "OPTIONS",
];

const defaultAllowedHeaders: string[] = [
  "Origin",
  "X-Requested-With",
  "Content-Type",
  "Accept",
  "Authorization",
];

const defaultExposedHeaders: string[] = [
  "Content-Length",
  "X-Requested-With",
  "X-Response-Time",
];

const isOriginAllowed = (origin: string | undefined): boolean => {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.length === 0) {
    return true;
  }

  return allowedOrigins.includes(origin);
};

export const buildCorsOptions: CorsOptionsDelegate = (req, callback): void => {
  const originHeader = req.header("Origin") || undefined;
  const originAllowed = isOriginAllowed(originHeader);

  const options: CorsOptions = {
    origin: originAllowed ? originHeader || true : false,
    credentials: true,
    methods: defaultMethods,
    allowedHeaders: defaultAllowedHeaders,
    exposedHeaders: defaultExposedHeaders,
    optionsSuccessStatus: 204,
  };

  if (!originAllowed) {
    callback(null, { ...options, origin: false });
    return;
  }

  callback(null, options);
};

export const corsMiddleware = cors(buildCorsOptions);

export default corsMiddleware;