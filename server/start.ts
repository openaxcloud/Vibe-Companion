// Minimal server entry point to debug startup issues

async function startServer() {
  try {
    await import('./index.js');
  } catch (error) {
    console.error('[START] Failed to import server module:', error);
    process.exit(1);
  }
}

startServer().catch(error => {
  console.error('[START] Fatal error starting server:', error);
  process.exit(1);
});