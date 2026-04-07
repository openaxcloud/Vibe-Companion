/**
 * @file index.ts
 * @description
 * Deprecated root entry point.
 *
 * The application structure has changed:
 * - Backend entry point has moved to: /server/index.ts
 * - Frontend entry point has moved to: /client/src/main.ts (or equivalent)
 *
 * This file is kept only for backwards compatibility and should not be used
 * as the primary entry point for new code.
 */

export const deprecationMessage: string =
  'Deprecated entry point: use /server for backend and /client for frontend entry points instead.';

export function getDeprecationMessage(): string {
  return deprecationMessage;
}

// If this module is accidentally executed directly (in Node),
// log a clear deprecation notice.
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  // eslint-disable-next-line no-console
  console.warn(deprecationMessage);
}