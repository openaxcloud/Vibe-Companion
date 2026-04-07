import express, { Application } from "express";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import path from "path";
import channelsRouter from "./routes/channels";
import messagesRouter from "./routes/messages";
import pushRouter from "./routes/push";

dotenv.config();

const app: Application = express();

const FRONTEND_ORIGIN =
  process.env.FRONTEND_ORIGIN ||
  process.env.CLIENT_ORIGIN ||
  "http://localhost:3000";

const corsOptions: CorsOptions = {
  origin: FRONTEND_ORIGIN,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Origin",
    "X-Requested-With",
    "Content-Type",
    "Accept",
    "Authorization",
  ],
};

app.use(cors(corsOptions));

app.options("*", cors(corsOptions));

app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

const apiBasePath = process.env.API_BASE_PATH || "/api";

app.use(path.join(apiBasePath, "channels"), channelsRouter);
app.use(path.join(apiBasePath, "messages"), messagesRouter);
app.use(path.join(apiBasePath, "push"), pushRouter);

app.get(path.join(apiBasePath, "health"), (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(
  (
    err: any,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    // eslint-disable-next-line no-console
    console.error("Unhandled error:", err);
    const status = err.status || 500;
    const message =
      err.message || "An unexpected error occurred. Please try again later.";
    res.status(status).json({ error: message });
  }
);

export default app;