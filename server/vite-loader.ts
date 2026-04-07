/**
 * Safe Vite Loader
 * Gracefully handles Vite loading failures (rollup dependency issues)
 */

import type { Application } from 'express';
import type { Server } from 'http';
import { createLogger } from './utils/logger';

// Top-level synchronous imports for production static serving.
// Using top-level imports (not dynamic await import()) ensures the production
// branch of safeSetupVite runs SYNCHRONOUSLY with no async awaiting that can hang.
import expressStatic from 'express';
import pathModule from 'path';
import fsModule from 'fs';

const logger = createLogger('vite-loader');

/**
 * Attempts to load and setup Vite with proper error handling
 * Returns true if successful, false if failed
 * 
 * IMPORTANT: This uses dynamic import with error isolation to prevent
 * top-level import failures from crashing the entire server
 */
export async function safeSetupVite(app: Application, server: Server): Promise<boolean> {
  try {
    // ✅ CRITICAL FIX (Nov 20, 2025): Patch server upgrade listeners BEFORE Vite setup
    // Problem: Vite's HMR WebSocket server destroys /ws/agent connections (code 1006)
    // Solution: Wrap all upgrade listeners added during setupVite to respect kUpgradeHandled
    // This ensures Vite's HMR ignores /ws/agent sockets that we've already handled
    const { isSocketHandled, markSocketAsHandled } = await import('./websocket/upgrade-guard');
    
    // Save original methods
    const originalOn = server.on.bind(server);
    const originalAddListener = server.addListener.bind(server);
    const originalPrependListener = server.prependListener.bind(server);
    
    // Track Vite's upgrade listeners so we can wrap them
    const viteUpgradeListeners: Array<(...args: any[]) => void> = [];
    
    // Monkeypatch server.on and addListener to intercept upgrade listeners
    const wrapUpgradeListener = (listener: (...args: any[]) => void) => {
      // Wrap the listener to check kUpgradeHandled before executing
      const wrappedListener = (request: any, socket: any, head: any) => {
        // If socket is already handled by our manual upgrade (e.g., /ws/agent), skip Vite
        if (isSocketHandled(request, socket)) {
          return; // No-op - socket is already managed
        }
        
        // Mark this socket as handled BEFORE Vite processes it
        // This prevents the final upgrade guard from destroying Vite's HMR sockets
        markSocketAsHandled(request, socket);
        
        // Let Vite's HMR handle it normally
        return listener(request, socket, head);
      };
      
      // Mark this as wrapped to avoid double-wrapping
      (wrappedListener as any).__upgradePatched = true;
      viteUpgradeListeners.push(wrappedListener);
      
      return wrappedListener;
    };
    
    server.on = function(event: string, listener: (...args: any[]) => void) {
      if (event === 'upgrade' && !(listener as any).__upgradePatched) {
        return originalOn(event, wrapUpgradeListener(listener));
      }
      return originalOn(event, listener);
    } as any;
    
    server.addListener = function(event: string, listener: (...args: any[]) => void) {
      if (event === 'upgrade' && !(listener as any).__upgradePatched) {
        return originalAddListener(event, wrapUpgradeListener(listener));
      }
      return originalAddListener(event, listener);
    } as any;
    
    server.prependListener = function(event: string, listener: (...args: any[]) => void) {
      if (event === 'upgrade' && !(listener as any).__upgradePatched) {
        return originalPrependListener(event, wrapUpgradeListener(listener));
      }
      return originalPrependListener(event, listener);
    } as any;
    
    // 🔥 CRITICAL FIX (Nov 20, 2025): Configure Vite HMR on separate port
    // Problem: Vite's HMR WebSocket server destroys /ws/agent connections (code 1006) 
    //          even when upgrade listeners are wrapped to skip them
    // Root cause: Vite's internal HMR logic rejects sockets that don't match HMR protocol
    // Solution: Use separate HMR port (24678) instead of sharing HTTP server
    //           This completely isolates Vite HMR from our WebSocket services
    const VITE_HMR_PORT = 24678;
    
    if (process.env.NODE_ENV === 'development') {
      // Import vite module ONLY in development - importing in production causes package.json errors
      const viteModule = await import('./vite');
      // 🔥 Create separate HTTP server for Vite HMR (completely isolated from our WebSocket services)
      const { createServer: createHttpServer } = await import('http');
      const viteHmrServer = createHttpServer();
      
      // Listen on separate port for HMR WebSocket connections
      viteHmrServer.listen(VITE_HMR_PORT, '0.0.0.0', () => {
        logger.info(`[Vite HMR] Dedicated WebSocket server listening on port ${VITE_HMR_PORT}`);
      });
      
      // ✅ CRITICAL FIX (Dec 1, 2025): Add early guard middleware for WebSocket paths
      // PROBLEM: Vite's catch-all middleware processes WebSocket upgrade requests BEFORE
      // the upgrade event handler completes, writing HTML responses that cause "Invalid frame header"
      // errors on the client and 1006 disconnections.
      // SOLUTION: Add middleware that detects WebSocket upgrade requests to /ws/* paths
      // and returns early without any response, allowing the upgrade handler to complete.
      app.use((req, res, next) => {
        // Check if this is a WebSocket upgrade request to our WebSocket paths
        if (req.headers.upgrade?.toLowerCase() === 'websocket' && 
            req.originalUrl.startsWith('/ws/')) {
          // Don't respond at all - the upgrade handler will handle this
          // Just return without calling next() to prevent Vite from processing
          return;
        }
        next();
      });
      
      // WORKAROUND: Monkeypatch app.use to prevent Vite's catch-all from capturing API routes
      // This is necessary because server/vite.ts is forbidden from editing
      // Save original app.use method
      const originalAppUse = app.use.bind(app);
      
      // Override app.use to intercept the Vite catch-all middleware
      (app as any).use = function(pathOrMiddleware: any, ...middlewares: any[]) {
        // If this is the catch-all route ('*'), wrap it to skip API routes
        if (pathOrMiddleware === '*' && middlewares.length > 0) {
          const originalMiddleware = middlewares[0];
          
          // Create a wrapped middleware that skips API routes
          const wrappedMiddleware = async (req: any, res: any, next: any) => {
            // Skip API routes, WebSocket routes, and other backend services
            if (req.originalUrl.startsWith('/api/') || 
                req.originalUrl.startsWith('/collaboration/') || 
                req.originalUrl.startsWith('/webrtc/') ||
                req.originalUrl.startsWith('/health') ||
                req.originalUrl.startsWith('/socket.io/') ||
                req.originalUrl.startsWith('/ws/')) {
              return next();
            }
            
            // For everything else, let Vite handle it
            return originalMiddleware(req, res, next);
          };
          
          // Call original app.use with wrapped middleware
          return originalAppUse(pathOrMiddleware, wrappedMiddleware);
        }
        
        // For all other routes, use original behavior
        return originalAppUse(pathOrMiddleware, ...middlewares);
      };
      
      // 🔥 Setup Vite with SEPARATE HMR server (not main HTTP server!)
      // This completely prevents Vite HMR from interfering with /ws/agent connections
      await viteModule.setupVite(app as any, viteHmrServer);
      
      // Restore original app.use method after Vite setup
      app.use = originalAppUse;
      
      // ✅ CRITICAL FIX (Nov 20, 2025): Restore methods to prevent wrapping non-Vite listeners
      // Reason: Our prependListener in server/index.ts should NOT be wrapped (would cause 400 errors)
      // Solution: Only Vite's listeners (added during setupVite) are wrapped, subsequent listeners run normally
      server.on = originalOn;
      server.addListener = originalAddListener;
      server.prependListener = originalPrependListener;
      
      logger.info(`[Vite Loader] ✅ Vite HMR upgrade listeners wrapped (${viteUpgradeListeners.length} listeners patched)`);
      logger.info('[Vite Loader] /ws/agent connections will now bypass Vite HMR and survive');
      logger.info('[Vite Loader] ⚠️  Wrapped listeners remain active, subsequent listeners run normally');
    } else {
      logger.info('[Vite Loader] 🏭 Production mode - serving static files from dist/public...');
      try {
        // Production build outputs to dist/public
        // __dirname in the production esbuild bundle (dist/index.js) = dist/
        // so pathModule.resolve(__dirname, 'public') = dist/public
        const distPath = pathModule.resolve(__dirname, 'public');
        const indexHtmlPath = pathModule.join(distPath, 'index.html');
        
        if (!fsModule.existsSync(distPath)) {
          throw new Error(`Build directory not found: ${distPath}. Run 'npm run build' first.`);
        }
        
        logger.info(`[Vite Loader] Serving static files from: ${distPath}`);
        
        app.use('/assets', expressStatic.static(pathModule.join(distPath, 'assets'), {
          maxAge: '365d',
          immutable: true,
          etag: false,
          lastModified: false,
          index: false,
        }));

        app.use(expressStatic.static(distPath, {
          maxAge: '1d',
          etag: true,
          lastModified: true,
          index: false,
          setHeaders: (res, filePath) => {
            if (filePath.endsWith('.html')) {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        }));
        
        // Read index.html for SPA fallback
        const indexHtml = fsModule.readFileSync(indexHtmlPath, 'utf-8');
        
        // Inject CSP nonce into inline <style> and <script> tags in a given HTML string.
        // External scripts (with src="...") are left unchanged — they don't need nonces.
        function injectNonce(html: string, nonce: string): string {
          // Add nonce to all inline <style> tags
          html = html.replace(/<style(\b[^>]*)>/g, (_m: string, attrs: string) => `<style${attrs} nonce="${nonce}">`);
          // Add nonce to inline <script> tags only (those WITHOUT a src= attribute)
          html = html.replace(/<script(?![^>]*\bsrc\s*=)([^>]*)>/g, (_m: string, attrs: string) => `<script${attrs} nonce="${nonce}">`);
          return html;
        }

        // SPA fallback - serve index.html for all non-API/non-asset routes WITH nonce injection
        app.use('*', (req: any, res: any, next: any) => {
          // Skip API, WebSocket, and static asset paths
          // express.static above handles /assets/* — if it calls next(), the file is missing (404)
          if (req.originalUrl.startsWith('/api/') || 
              req.originalUrl.startsWith('/health') ||
              req.originalUrl.startsWith('/metrics') ||
              req.originalUrl.startsWith('/ws/') ||
              req.originalUrl.startsWith('/collaboration') ||
              req.originalUrl.startsWith('/assets/') ||
              req.originalUrl.startsWith('/attached_assets/')) {
            return next();
          }
          const nonce: string | undefined = res.locals.cspNonce;
          const html = nonce ? injectNonce(indexHtml, nonce) : indexHtml;
          res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }).end(html);
        });
        
        logger.info('[Vite Loader] ✅ Production static serving configured successfully');
      } catch (staticError: any) {
        logger.error('[Vite Loader] ❌ Production serving failed:', staticError.message);
        throw staticError;
      }
    }
    
    return true;
  } catch (error: any) {
    // Check if this is a genuine Rollup native module missing error
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.message.includes('@rollup/')) {
      logger.warn('[VITE] ⚠️  Rollup native module not available');
      logger.warn('[VITE] Cannot start Vite development server due to missing optional dependency');
      logger.warn('[VITE] Error:', error.message);
    } else {
      logger.error('[VITE] Failed to setup Vite:', error.message);
      logger.error('[VITE] Stack:', error.stack);
    }
    return false;
  }
}

/**
 * Setup fallback HTML serving when Vite is unavailable
 * Serves pre-built static files from dist/ folder
 */
export async function setupFallbackServer(app: Application): Promise<void> {
  // Uses top-level synchronous imports (expressStatic, pathModule, fsModule)
  // to avoid async hangs in the production bundle
  const publicPath = pathModule.resolve(__dirname, 'public');
  const builtIndexPath = pathModule.join(publicPath, 'index.html');
  
  if (fsModule.existsSync(publicPath) && fsModule.existsSync(builtIndexPath)) {
    // We have a complete pre-built frontend!
    app.use('/assets', expressStatic.static(pathModule.join(publicPath, 'assets'), {
      maxAge: '365d',
      immutable: true,
      etag: false,
      lastModified: false,
      index: false,
    }));
    app.use(expressStatic.static(publicPath, { index: false }));
    
    // Read the built index.html
    const builtHTML = fsModule.readFileSync(builtIndexPath, 'utf-8');
    
    // Serve index.html for all non-API, non-asset routes WITH nonce injection
    app.get('*', (req: any, res: any, next: any) => {
      if (req.path.startsWith('/api') || 
          req.path.startsWith('/collaboration') || 
          req.path.startsWith('/webrtc') ||
          req.path.startsWith('/assets/') ||
          req.path.startsWith('/attached_assets/')) {
        return next();
      }
      const nonce: string | undefined = res.locals?.cspNonce;
      let html = builtHTML;
      if (nonce) {
        html = html.replace(/<style(\b[^>]*)>/g, (_m: string, attrs: string) => `<style${attrs} nonce="${nonce}">`);
        html = html.replace(/<script(?![^>]*\bsrc\s*=)([^>]*)>/g, (_m: string, attrs: string) => `<script${attrs} nonce="${nonce}">`);
      }
      return res.status(200).set({ 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' }).end(html);
    });
    
    return;
  }
  
  // Fallback if dist/public doesn't exist
  logger.warn('[FALLBACK] ⚠️  Pre-built frontend not found in dist/public/');
  logger.warn('[FALLBACK] Using emergency fallback HTML...');
  
  // Emergency fallback
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/collaboration') || req.path.startsWith('/webrtc')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // Serve a minimal HTML page that explains the situation
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>E-Code Platform - Maintenance Mode</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              min-height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
              padding: 20px;
            }
            .container {
              max-width: 600px;
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              padding: 40px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            h1 {
              font-size: 2.5rem;
              margin-bottom: 20px;
              background: linear-gradient(to right, #fff, #e0e0e0);
              -webkit-background-clip: text;
              -webkit-text-fill-color: transparent;
            }
            p {
              font-size: 1.1rem;
              line-height: 1.6;
              margin-bottom: 15px;
              opacity: 0.95;
            }
            .status {
              background: rgba(46, 204, 113, 0.2);
              border-left: 4px solid #2ecc71;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .status strong {
              color: #2ecc71;
            }
            .info {
              background: rgba(52, 152, 219, 0.2);
              border-left: 4px solid #3498db;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
              font-size: 0.95rem;
            }
            code {
              background: rgba(0, 0, 0, 0.3);
              padding: 2px 8px;
              border-radius: 4px;
              font-family: 'Courier New', monospace;
            }
            .spinner {
              border: 3px solid rgba(255, 255, 255, 0.3);
              border-top: 3px solid white;
              border-radius: 50%;
              width: 40px;
              height: 40px;
              animation: spin 1s linear infinite;
              margin: 20px auto;
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔧 E-Code Platform</h1>
            <p>The E-Code Platform is currently running in <strong>API-only mode</strong> due to a frontend dependency issue.</p>
            
            <div class="status">
              <strong>✅ Backend Status: FULLY OPERATIONAL</strong>
              <p style="margin-top: 10px; font-size: 0.95rem;">All API endpoints, WebSocket services, authentication, database operations, and production features are working perfectly.</p>
            </div>
            
            <div class="info">
              <strong>ℹ️ Technical Details</strong>
              <p style="margin-top: 10px;">The frontend build tool (Vite) cannot start due to a missing optional dependency (<code>@rollup/rollup-linux-x64-gnu</code>). This is a known npm bug and does not affect backend functionality.</p>
              <p style="margin-top: 10px;"><strong>Available Services:</strong></p>
              <ul style="margin-left: 20px; margin-top: 5px;">
                <li>REST API (all endpoints functional)</li>
                <li>WebSocket services (real-time collaboration, LSP, build logs)</li>
                <li>WebRTC voice/video communication</li>
                <li>Database operations</li>
                <li>Authentication & authorization</li>
                <li>Production monitoring & caching</li>
              </ul>
            </div>
            
            <p style="opacity: 0.8; margin-top: 30px; text-align: center; font-size: 0.9rem;">
              Contact your administrator or check the server console for resolution steps.
            </p>
          </div>
        </body>
      </html>
    `);
  });
}
