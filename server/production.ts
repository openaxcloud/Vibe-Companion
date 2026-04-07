// Production server for deployment
import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { configureCors } from "./middleware/cors-config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Secure CORS configuration - must be before other middleware
configureCors(app);

// Basic middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// PORT is set by Docker (3000) or Cloud Run, fallback to 5000 for local development
const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;

// Create HTTP server
const httpServer = createServer(app);

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Production server is running' });
});

// CORS configuration health check endpoint
app.get('/api/cors-health', async (_req, res) => {
  try {
    const { verifyCorsConfiguration } = await import('./middleware/cors-config');
    const corsStatus = verifyCorsConfiguration();
    
    if (corsStatus.isValid) {
      res.json({
        status: 'healthy',
        message: corsStatus.message,
        origins: corsStatus.origins,
        environment: process.env.NODE_ENV || 'production'
      });
    } else {
      res.status(500).json({
        status: 'unhealthy',
        message: corsStatus.message,
        environment: process.env.NODE_ENV || 'production'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to verify CORS configuration',
      error: error.message,
      environment: process.env.NODE_ENV || 'production'
    });
  }
});

// Load routes
(async () => {
  try {
    // Import modular routes
    const { MainRouter } = await import("./routes");
    const { getStorage } = await import("./storage");
    const storage = getStorage();
    
    const mainRouter = new MainRouter(storage);
    mainRouter.registerRoutes(app);
  } catch (error) {
    console.error('[PRODUCTION SERVER] Failed to register routes:', error);
  }

  // Serve static files from the React build
  const possiblePaths = [
    path.resolve(__dirname, "..", "dist", "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(__dirname, "..", "client", "dist"),
    path.resolve(process.cwd(), "client", "dist"),
  ];
  
  let staticPath = null;
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      staticPath = p;
      break;
    }
  }
  
  if (staticPath) {
    // Serve static files
    app.use(express.static(staticPath));
    
    // Handle client-side routing - serve index.html for all non-API routes
    app.get('{*path}', (req, res) => {
      if (!req.path.startsWith('/api')) {
        const indexPath = path.join(staticPath, 'index.html');
        if (existsSync(indexPath)) {
          res.sendFile(indexPath);
        } else {
          res.status(404).send('Build files not found. Please ensure the application is built.');
        }
      }
    });
  } else {
    console.error('[PRODUCTION SERVER] No build files found!');
    console.error('[PRODUCTION SERVER] Tried:', possiblePaths);
    
    // Fallback response
    app.get('{*path}', (req, res) => {
      if (!req.path.startsWith('/api')) {
        res.status(500).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>E-Code Platform - Build Required</title>
              <style>
                body { font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto; }
                h1 { color: #e53e3e; }
                pre { background: #f7f7f7; padding: 10px; border-radius: 4px; }
              </style>
            </head>
            <body>
              <h1>Build Required</h1>
              <p>The React application has not been built. Please run:</p>
              <pre>npm run build</pre>
              <p>Then restart the server.</p>
            </body>
          </html>
        `);
      }
    });
  }

  // Initialize database
  try {
    const { initializeDatabase } = await import("./db-init");
    await initializeDatabase();
  } catch (error) {
    console.warn('[PRODUCTION SERVER] Database initialization failed (non-critical):', error.message);
  }
})();

// Start listening
httpServer.listen(port, "0.0.0.0", () => {
});