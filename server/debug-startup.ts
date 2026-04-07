

process.on('uncaughtException', (error) => {
  console.error('[DEBUG] Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[DEBUG] Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

import('./index.js').then(() => {
  
}).catch((error) => {
  console.error('[DEBUG] Failed to load server module:', error);
  process.exit(1);
});