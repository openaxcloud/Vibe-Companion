import express, { Application } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import compression from "compression";
import type { Request, Response } from "express";
import { corsOptions } from "./config/corsOptions";
import { apiRouter } from "./routes";
import { notFoundHandler } from "./middleware/notFoundHandler";
import { errorHandler } from "./middleware/errorHandler";

const app: Application = express();

app.set("trust proxy", true);

app.use(helmet());
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(compression());

if (process.env.NODE_ENV !== "test") {
  app.use(
    morgan("combined", {
      skip: (_req: Request, res: Response) => res.statusCode < 400,
    })
  );
}

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", apiRouter);

app.use(notFoundHandler);

app.use(errorHandler);

export { app };