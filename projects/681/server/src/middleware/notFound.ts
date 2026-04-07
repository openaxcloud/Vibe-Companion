import { Request, Response, NextFunction } from "express";

export const notFound = (req: Request, res: Response, _next: NextFunction): void => {
  const debugInfo = {
    method: req.method,
    originalUrl: req.originalUrl,
    path: req.path,
    ip: req.ip,
    query: req.query,
    timestamp: new Date().toISOString(),
  };

  // In a real application, replace this with a proper logger
  if (process.env.NODE_ENV !== "test") {
    // eslint-disable-next-line no-console
    console.warn("[404 Not Found]", debugInfo);
  }

  res.status(404).json({
    error: "Not Found",
    message: "The requested resource could not be found.",
    path: req.originalUrl,
  });
};

export default notFound;