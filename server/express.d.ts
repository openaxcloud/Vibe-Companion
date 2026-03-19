// Override Express req.query to avoid ParsedQs type errors.
// All query parameters are strings at runtime when accessed individually.
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    query: Record<string, string>;
  }
}
