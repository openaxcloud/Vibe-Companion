// Override Express req.query to simplify string types.
// This prevents ParsedQs union type errors throughout routes.ts.
import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    query: Record<string, string>;
  }
}
