/**
 * Legacy root index.ts
 *
 * This file is kept for backward compatibility.
 * The main application entrypoint has moved to: api/src/index.ts
 *
 * TODO:
 * - Prefer importing from "api/src/index" directly in new code.
 * - This shim may be removed in a future major release.
 */

import { startServer } from "./api/src/index";

export * from "./api/src/index";

export const main = async (): Promise<void> => {
  await startServer();
};

if (require.main === module) {
  // eslint-disable-next-line no-console
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start server from legacy root index.ts shim:", err);
    process.exitCode = 1;
  });
}