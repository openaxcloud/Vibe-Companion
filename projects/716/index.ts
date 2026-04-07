/**
 * Root entry module: index.ts
 *
 * This file serves as a lightweight, framework-agnostic entry point for the project.
 * It intentionally does NOT start the backend/server directly so it does not conflict
 * with the dedicated backend entry (e.g., `server.ts` or `src/server/index.ts`).
 *
 * Primary purposes:
 * - Provide a central, documented export surface for core modules.
 * - Offer a single location for tools/bundlers/CLIs to reference as "main" without
 *   tightly coupling to the backend bootstrapping logic.
 * - Make it explicit where the actual server entry and other layers live.
 *
 * Project structure conventions (example):
 * - src/
 *   - server/        -> HTTP server / API entry (e.g. Express/Fastify/etc.)
 *   - config/        -> Configuration, env loading, schema validation
 *   - modules/       -> Domain modules, business logic
 *   - shared/        -> Reusable utilities, types, helpers
 *
 * This file re-exports selected, stable pieces of the project so that consumers can:
 * - Import the configured server instance (without starting it).
 * - Access core types/utilities without depending on internal paths.
 *
 * If your project layout differs, adjust the re-exports accordingly.
 */

// Example: Re-export the configured server application instance (without listening).
// Update the import path to match your actual backend entry/module.
let serverExport: unknown = undefined;

// These try/catch blocks are defensive so that the root index can be safely imported
// even in environments where the backend entry might not exist or be resolvable
// (for example, during certain build steps or partial tooling runs).
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const maybeServer = require("./server");
  // Common patterns:
  // - module.exports = app
  // - export default app
  // - export const server = app
  serverExport =
    (maybeServer && (maybeServer.default || maybeServer.server || maybeServer.app || maybeServer)) ??
    undefined;
} catch {
  // Intentionally ignore resolution errors to avoid crashing tools that only
  // need type information or auxiliary exports from this index.
}

/**
 * A minimal, typed handle to the server export.
 * The type is intentionally broad to avoid taking a hard dependency on a specific
 * web framework. Downstream code can narrow this as needed.
 */
export const server: unknown = serverExport;

/**
 * Optional: re-export commonly used shared utilities, types, or config.
 * Adjust or extend this section to match your actual project structure.
 */

// Example: shared types/utilities (update paths to match your project structure)
export type { Logger } from "./src/shared/logger";
export { createLogger } from "./src/shared/logger";
export type { AppConfig } from "./src/config/types";
export { loadConfig } from "./src/config/loadConfig";

/**
 * Returns a short, programmatic description of the project layout and purpose
 * of this root module. This can be helpful for CLIs, tooling, or debugging.
 */
export function getRootModuleInfo(): {
  name: string;
  description: string;
  hasServerExport: boolean;
  notes: string[];
} {
  return {
    name: "root-index",
    description:
      "Root entry module that exposes stable exports and documentation for the project structure without bootstrapping the server.",
    hasServerExport: Boolean(serverExport),
    notes: [
      "The actual HTTP/API server entry should live in a dedicated backend module (e.g., ./server.ts or ./src/server/index.ts).",
      "This index.ts is safe to import in tooling and build steps because it does not perform any I/O or side-effectful initialization.",
      "Update the re-exports in this file to surface stable public APIs from your project.",
    ],
  };
}

/**
 * No side-effectful code (such as starting HTTP listeners) should be placed here.
 * Backend startup logic must live in the dedicated server entry to avoid conflicts.
 */