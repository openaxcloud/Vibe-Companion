import { Router, Request, Response, NextFunction } from 'express';
import { storage } from '../storage';
import { previewEvents } from '../preview/preview-websocket';

const fname = (f: any): string => f.filename || f.name || '';

const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).session?.userId || (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (!(req as any).user) {
    (req as any).user = { id: userId };
  }
  next();
};

// Hot-reload script to inject into HTML files
// This connects to the preview WebSocket and reloads when file changes are detected
function getHotReloadScript(projectId: string): string {
  return `
    <script data-hot-reload="true">
      (function() {
        // Hot-reload WebSocket connection for live preview
        const projectId = '${projectId}';
        let ws = null;
        let reconnectAttempts = 0;
        const maxReconnectAttempts = 10;
        const reconnectDelay = 2000;
        
        function connect() {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          const wsUrl = protocol + '//' + window.location.host + '/ws/preview';
          
          try {
            ws = new WebSocket(wsUrl);
            
            ws.onopen = function() {
              console.log('[Hot-Reload] Connected to preview server');
              reconnectAttempts = 0;
              // Subscribe to this project's updates
              ws.send(JSON.stringify({ type: 'subscribe', projectId: parseInt(projectId) }));
            };
            
            ws.onmessage = function(event) {
              try {
                const data = JSON.parse(event.data);
                
                if (data.type === 'preview:file-change') {
                  console.log('[Hot-Reload] File changed:', data.filePath);
                  
                  // Check if it's a CSS file - we can hot-swap CSS without full reload
                  if (data.filePath && data.filePath.endsWith('.css')) {
                    hotSwapCSS(data.filePath);
                  } else {
                    // For HTML/JS changes, do a full reload with cache-busting
                    console.log('[Hot-Reload] Reloading page...');
                    var url = new URL(window.location.href);
                    url.searchParams.set('_t', Date.now().toString());
                    window.location.href = url.toString();
                  }
                } else if (data.type === 'preview:rebuild') {
                  console.log('[Hot-Reload] Rebuild triggered, reloading...');
                  var url = new URL(window.location.href);
                  url.searchParams.set('_t', Date.now().toString());
                  window.location.href = url.toString();
                } else if (data.type === 'ping') {
                  ws.send(JSON.stringify({ type: 'pong' }));
                }
              } catch (e) {
                console.error('[Hot-Reload] Message parse error:', e);
              }
            };
            
            ws.onclose = function() {
              console.log('[Hot-Reload] Connection closed');
              attemptReconnect();
            };
            
            ws.onerror = function(error) {
              console.error('[Hot-Reload] WebSocket error:', error);
            };
          } catch (e) {
            console.error('[Hot-Reload] Failed to create WebSocket:', e);
            attemptReconnect();
          }
        }
        
        function attemptReconnect() {
          if (reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log('[Hot-Reload] Reconnecting in ' + reconnectDelay + 'ms (attempt ' + reconnectAttempts + ')');
            setTimeout(connect, reconnectDelay);
          } else {
            console.log('[Hot-Reload] Max reconnection attempts reached');
          }
        }
        
        function hotSwapCSS(cssPath) {
          // Find all link elements and update matching CSS files
          const links = document.querySelectorAll('link[rel="stylesheet"]');
          links.forEach(function(link) {
            const href = link.getAttribute('href');
            if (href && (href.includes(cssPath) || cssPath.includes(href.split('?')[0]))) {
              // Add cache-busting timestamp
              const newHref = href.split('?')[0] + '?_t=' + Date.now();
              link.setAttribute('href', newHref);
              console.log('[Hot-Reload] CSS hot-swapped:', newHref);
            }
          });
          
          // Also handle inline style elements if needed
          const styles = document.querySelectorAll('style[data-file]');
          styles.forEach(function(style) {
            const filePath = style.getAttribute('data-file');
            if (filePath && filePath.includes(cssPath)) {
              // For inline styles, we need a full reload
              window.location.reload();
            }
          });
        }
        
        // Connect when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', connect);
        } else {
          connect();
        }
      })();
    </script>`;
}

// Rewrite root-absolute asset paths in HTML to use project-relative URLs
// This transforms /path/to/asset → /api/preview/projects/${projectId}/preview/path/to/asset
// Only rewrites paths that start with "/" (root-absolute), not:
// - Relative paths like "./style.css" or "style.css"
// - External URLs like "https://cdn.example.com/"
// - Data URIs like "data:image/png;base64,..."
// - Protocol-relative URLs like "//cdn.example.com/"
function rewriteAssetPaths(html: string, projectId: string): string {
  const basePrefix = `/api/preview/projects/${projectId}/preview`;
  
  // Pattern to match href="/path" or src="/path" attributes (root-absolute paths)
  // Captures: (1) attribute prefix with quote, (2) the path after leading slash
  // Excludes paths that start with //, http, https, data:, or are already rewritten
  const attrPattern = /((?:href|src|action|poster|data)\s*=\s*["'])\/(?!\/|api\/preview)([^"']*)/gi;
  
  // Pattern to match url(/path) in CSS (inline styles or style tags)
  // Captures: (1) url( with optional quote, (2) the path after leading slash
  const cssUrlPattern = /(url\s*\(\s*["']?)\/(?!\/|api\/preview)([^"'\)]*)/gi;
  
  // Pattern to match srcset attribute values with root-absolute paths
  const srcsetPattern = /(srcset\s*=\s*["'])([^"']+)(["'])/gi;
  
  let result = html;
  
  // Rewrite href, src, action, poster, data attributes with root-absolute paths
  // Example: href="/style.css" → href="/api/preview/projects/123/preview/style.css"
  result = result.replace(attrPattern, (match, prefix, path) => {
    return `${prefix}${basePrefix}/${path}`;
  });
  
  // Rewrite CSS url() with root-absolute paths
  // Example: url(/fonts/font.woff) → url(/api/preview/projects/123/preview/fonts/font.woff)
  result = result.replace(cssUrlPattern, (match, urlStart, path) => {
    return `${urlStart}${basePrefix}/${path}`;
  });
  
  // Rewrite srcset attribute (contains multiple paths with sizes)
  result = result.replace(srcsetPattern, (match, prefix, srcsetValue, suffix) => {
    const rewrittenValue = srcsetValue.replace(/(\s|^)\/(?!\/|api\/preview)([^\s,]+)/g, (m: string, space: string, path: string) => {
      return `${space}${basePrefix}/${path}`;
    });
    return `${prefix}${rewrittenValue}${suffix}`;
  });
  
  return result;
}

function getFetchInterceptorScript(projectId: string): string {
  return `
    <script data-fetch-interceptor="true">
      (function() {
        var basePrefix = '/api/preview/projects/${projectId}/preview';

        function rewriteUrl(url) {
          if (typeof url !== 'string') return url;
          if (url.startsWith(basePrefix)) return url;
          if (url.startsWith('//') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) return url;
          if (url.startsWith('/')) return basePrefix + url;
          return url;
        }

        var origFetch = window.fetch;
        window.fetch = function(input, init) {
          if (typeof input === 'string') {
            input = rewriteUrl(input);
          } else if (input instanceof Request) {
            var newUrl = rewriteUrl(input.url.replace(window.location.origin, ''));
            if (newUrl !== input.url.replace(window.location.origin, '')) {
              input = new Request(newUrl, {
                method: input.method,
                headers: input.headers,
                body: input.method !== 'GET' && input.method !== 'HEAD' ? input.body : undefined,
                mode: input.mode,
                credentials: input.credentials,
                cache: input.cache,
                redirect: input.redirect,
                referrer: input.referrer,
                referrerPolicy: input.referrerPolicy,
                integrity: input.integrity,
                keepalive: input.keepalive,
                signal: input.signal
              });
            }
          }
          return origFetch.call(this, input, init);
        };

        var origOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url) {
          arguments[1] = rewriteUrl(url);
          return origOpen.apply(this, arguments);
        };
      })();
    </script>`;
}

function injectPreviewScripts(content: string, projectId: string): string {
  const hotReload = getHotReloadScript(projectId);
  const fetchInterceptor = getFetchInterceptorScript(projectId);
  const scripts = fetchInterceptor + '\n' + hotReload;
  
  let modifiedContent = rewriteAssetPaths(content, projectId);
  
  if (/<head>/i.test(modifiedContent)) {
    return modifiedContent.replace(/<head>/i, `<head>\n    ${scripts}`);
  }
  
  if (/<html/i.test(modifiedContent)) {
    return modifiedContent.replace(/<html([^>]*)>/i, `<html$1>\n  <head>\n    ${scripts}\n  </head>`);
  }
  
  return `<head>\n    ${scripts}\n  </head>\n${modifiedContent}`;
}

// Middleware to ensure user has access to project
const ensureProjectAccess = async (req: any, res: any, next: any) => {
  const userId = req.user?.id || req.session?.userId;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const projectIdParam = req.params.projectId || req.params.id;
  
  if (!projectIdParam || typeof projectIdParam !== 'string' || projectIdParam.length === 0) {
    return res.status(400).json({ message: "Invalid project ID" });
  }
  
  const projectId = projectIdParam;
  req.validatedProjectId = projectId;
  
  const project = await storage.getProject(projectId);
  if (!project) {
    return res.status(404).json({ message: "Project not found" });
  }
  
  if (project.userId === userId || project.ownerId === userId) {
    return next();
  }
  
  const collaborators = await storage.getProjectCollaborators(projectId);
  const isCollaborator = collaborators.some((c: any) => c.userId === userId);
  
  if (isCollaborator) {
    return next();
  }
  
  res.status(403).json({ message: "You don't have access to this project" });
};

import path from 'path';

const router = Router();

// Get preview URL - matches frontend query endpoint
// Note: Router is mounted at /api/preview, so this becomes /api/preview/url
router.get('/url', requireAuth, async (req, res) => {
  try {
    // Extract projectId from query params (TanStack Query may pass it here)
    const projectIdParam = req.query.projectId || req.query.id;
    
    if (!projectIdParam) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Validate projectId is a positive integer
    const projectIdNum = parseInt(projectIdParam as string, 10);
    if (isNaN(projectIdNum) || projectIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid project ID' });
    }
    const projectId = String(projectIdNum);
    
    // Check project access
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const project = await storage.getProject(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check access permissions
    if (project.ownerId !== userId) {
      const collaborators = await storage.getProjectCollaborators(projectId);
      const isCollaborator = collaborators.some((c: any) => c.userId === userId);
      
      if (!isCollaborator) {
        return res.status(403).json({ error: "You don't have access to this project" });
      }
    }
    
    // Check if project has runnable files
    const files = await storage.getFiles(projectId);
    const hasHtmlFile = files.some(f => fname(f).endsWith('.html') && !f.isDirectory);
    const hasPackageJson = files.some(f => fname(f) === 'package.json' && !f.isDirectory);
    const hasPythonFiles = files.some(f => fname(f).endsWith('.py') && !f.isDirectory);
    
    if (!hasHtmlFile && !hasPackageJson && !hasPythonFiles) {
      // No runnable files, return null URL
      return res.json({ 
        previewUrl: null,
        status: 'no_runnable_files',
        message: 'No runnable files found in project'
      });
    }
    
    // Check if preview service is running
    const { previewService } = await import('../preview/preview-service');
    const preview = previewService.getPreview(projectId);
    
    // If preview is starting, propagate that status so the client shows a loading state
    if (preview && preview.status === 'starting') {
      return res.json({
        previewUrl: null,
        status: 'starting',
        message: 'Preview server is starting...'
      });
    }

    // If preview errored, tell the client so it can show a retry button (not loop)
    if (preview && preview.status === 'error') {
      const errorMessage = (preview as any).errorMessage || 'Preview server failed to start';
      return res.json({
        previewUrl: null,
        status: 'error',
        message: errorMessage
      });
    }
    
    if (!preview || preview.status !== 'running') {
      // For HTML-only projects, return static preview URL
      if (hasHtmlFile && !hasPackageJson && !hasPythonFiles) {
        const previewUrl = `/api/preview/projects/${projectId}/preview/`;
        return res.json({ 
          previewUrl,
          status: 'static',
          message: 'Static HTML preview available'
        });
      }
      
      // For projects needing a server, indicate it's not running
      return res.json({ 
        previewUrl: null,
        status: 'stopped',
        message: 'Preview server not running'
      });
    }
    
    // Preview is running, return the URL
    const previewUrl = previewService.getPreviewUrl(projectId, preview.primaryPort);
    const availablePorts = previewService.getPreviewPorts(projectId);
    const services = previewService.getPreviewServices(projectId);
    
    res.json({ 
      previewUrl,
      status: preview.status,
      runId: preview.runId,
      ports: availablePorts,
      primaryPort: preview.primaryPort,
      services,
      frameworkType: preview.frameworkType,
      lastHealthCheck: preview.lastHealthCheck
    });
  } catch (error) {
    console.error('Error getting preview URL:', error);
    res.status(500).json({ error: 'Failed to get preview URL' });
  }
});

// Helper to find a file by path in the files array
function findFileByPath(files: any[], requestedPath: string): any | null {
  const normalizedPath = requestedPath.startsWith('/') ? requestedPath.slice(1) : requestedPath;
  
  return files.find(f => {
    if (f.isDirectory) return false;
    const filePath = (f.filename || f.path || '').startsWith('/') ? (f.filename || f.path || '').slice(1) : (f.filename || f.path || '');
    return filePath === normalizedPath || f.name === normalizedPath || f.filename === normalizedPath;
  }) || null;
}

// Helper to find index.html in a directory
function findIndexInDirectory(files: any[], dirPath: string): any | null {
  const normalizedDir = dirPath.startsWith('/') ? dirPath.slice(1) : dirPath;
  const indexPath = normalizedDir ? `${normalizedDir}/index.html` : 'index.html';
  
  return files.find(f => {
    if (f.isDirectory) return false;
    const filePath = (f.filename || f.path || '').startsWith('/') ? (f.filename || f.path || '').slice(1) : (f.filename || f.path || '');
    return filePath === indexPath || f.filename === indexPath;
  }) || null;
}

// Helper to set cache control headers for all preview responses
function setCacheHeaders(res: any): void {
  res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
}

// Live preview for HTML/CSS/JS projects - root path (serves index.html)
// Supports ?file=path/to/file.html query param for specific file selection
// Note: This route handles /api/preview/projects/:id/preview/
router.get('/projects/:id/preview/', requireAuth, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Add cache-control headers to prevent stale content
    setCacheHeaders(res);
    
    // Get all project files
    const files = await storage.getFiles(projectId);
    
    // Check for ?file= query parameter for specific file selection
    const fileParam = req.query.file as string | undefined;
    if (fileParam) {
      const requestedFile = findFileByPath(files, fileParam);
      if (requestedFile) {
        const content = requestedFile.content ?? '';
        if (fileParam.endsWith('.html')) {
          const modifiedContent = content ? injectPreviewScripts(content, projectId) : '';
          res.type('html').send(modifiedContent);
        } else {
          const ext = path.extname(fileParam).toLowerCase();
          switch (ext) {
            case '.css': res.type('text/css'); break;
            case '.js': res.type('application/javascript'); break;
            case '.json': res.type('application/json'); break;
            default: res.type('text/plain');
          }
          res.send(content);
        }
        return;
      }
      return res.status(404).send(`File not found: ${fileParam}`);
    }
    
    // Find root index.html by path (not just name) to avoid matching nested index.html
    const rootIndexFile = findFileByPath(files, 'index.html');
    if (rootIndexFile) {
      const content = rootIndexFile.content ?? '';
      if (!content) {
        res.type('html').send('');
        return;
      }
      const modifiedContent = injectPreviewScripts(content, projectId);
      res.type('html').send(modifiedContent);
      return;
    }
    
    // No root index.html found, return 404
    return res.status(404).send('No index.html found in project root');
  } catch (error) {
    console.error('Error serving preview root:', error);
    res.status(500).send('Failed to serve preview');
  }
});

// IMPORTANT: These specific routes MUST come BEFORE the wildcard route below
// to prevent Express from matching "status", "start", "stop", "switch-port" as filepath

// Get preview status and health
// Note: This route handles /api/preview/projects/:id/preview/status
router.get('/projects/:id/preview/status', requireAuth, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const { previewService } = await import('../preview/preview-service');
    const preview = previewService.getPreview(projectId);
    
    if (!preview) {
      return res.json({
        status: 'stopped',
        message: 'No preview session found'
      });
    }
    
    res.json({
      status: preview.status,
      runId: preview.runId,
      ports: preview.ports,
      primaryPort: preview.primaryPort,
      services: preview.exposedServices,
      healthChecks: Object.fromEntries(preview.healthChecks),
      lastHealthCheck: preview.lastHealthCheck,
      frameworkType: preview.frameworkType,
      logs: preview.logs.slice(-50)
    });
  } catch (error) {
    console.error('Error getting preview status:', error);
    res.status(500).json({ error: 'Failed to get preview status' });
  }
});

// Start preview server
// Note: This route handles /api/preview/projects/:id/preview/start
// If a port is supplied, proxy to an already-running runtime.
// If no port is supplied, auto-detect the framework from DB files and spawn the server.
router.post('/projects/:id/preview/start', requireAuth, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { runId, port } = req.body;
    
    const { previewService } = await import('../preview/preview-service');
    
    let preview;
    if (port) {
      // Proxy mode: runtime already running on a known port
      preview = await previewService.startPreview(projectId, { port, runId });
    } else {
      // Auto mode: read files from DB, detect framework, spawn server
      preview = await previewService.startPreviewFromProject(projectId);
    }
    
    res.json({
      success: true,
      preview: {
        runId: preview.runId,
        status: preview.status,
        ports: preview.ports,
        primaryPort: preview.primaryPort,
        services: preview.exposedServices,
        frameworkType: preview.frameworkType
      }
    });
  } catch (error) {
    console.error('Error starting preview:', error);
    res.status(500).json({ error: 'Failed to start preview server' });
  }
});

// Stop preview server
// Note: This route handles /api/preview/projects/:id/preview/stop
router.post('/projects/:id/preview/stop', requireAuth, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    const { previewService } = await import('../preview/preview-service');
    await previewService.stopPreview(projectId);
    
    res.json({ success: true, message: 'Preview server stopped' });
  } catch (error) {
    console.error('Error stopping preview:', error);
    res.status(500).json({ error: 'Failed to stop preview server' });
  }
});

// Switch preview port
// Note: This route handles /api/preview/projects/:id/preview/switch-port
router.post('/projects/:id/preview/switch-port', requireAuth, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { port } = req.body;
    
    if (!port || typeof port !== 'number') {
      return res.status(400).json({ error: 'Port number is required' });
    }
    
    const { previewService } = await import('../preview/preview-service');
    const success = await previewService.switchPort(projectId, port);
    
    if (success) {
      res.json({ 
        success: true, 
        port,
        url: previewService.getPreviewUrl(projectId, port)
      });
    } else {
      res.status(400).json({ error: 'Failed to switch to port. Port may not be available or unhealthy.' });
    }
  } catch (error) {
    console.error('Error switching preview port:', error);
    res.status(500).json({ error: 'Failed to switch preview port' });
  }
});

// Live preview for HTML/CSS/JS projects - specific files
// IMPORTANT: This wildcard route MUST come AFTER the specific routes above
// Supports:
// - Direct file paths: /api/preview/projects/:id/preview/css/style.css
// - Directory paths: /api/preview/projects/:id/preview/public/ (serves public/index.html)
// - Nested index.html: /api/preview/projects/:id/preview/public/index.html
// Note: This route handles /api/preview/projects/:id/preview/:filepath
router.get('/projects/:id/preview/{*filepath}', requireAuth, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    let filepath = req.params.filepath || 'index.html';
    
    // Add cache-control headers to prevent stale content for ALL responses
    setCacheHeaders(res);
    
    // Get all project files
    const files = await storage.getFiles(projectId);
    
    // Normalize the filepath
    const normalizedPath = filepath.startsWith('/') ? filepath.slice(1) : filepath;
    
    // Check if path ends with / (directory request) - serve its index.html
    if (normalizedPath.endsWith('/')) {
      const dirPath = normalizedPath.slice(0, -1);
      const indexFile = findIndexInDirectory(files, dirPath);
      if (indexFile) {
        const content = indexFile.content ?? '';
        const modifiedContent = content ? injectPreviewScripts(content, projectId) : '';
        res.type('html').send(modifiedContent);
        return;
      }
      return res.status(404).send(`No index.html found in directory: ${dirPath || 'root'}`);
    }
    
    // Try to find the file by exact path
    let file = findFileByPath(files, normalizedPath);
    
    // If not found and no extension, it might be a directory - try to find its index.html
    if (!file && !path.extname(normalizedPath)) {
      const indexFile = findIndexInDirectory(files, normalizedPath);
      if (indexFile) {
        const content = indexFile.content ?? '';
        const modifiedContent = content ? injectPreviewScripts(content, projectId) : '';
        res.type('html').send(modifiedContent);
        return;
      }
    }
    
    if (!file) {
      return res.status(404).send(`File not found: ${normalizedPath}`);
    }
    
    // Set appropriate content type
    const ext = path.extname(filepath).toLowerCase();
    switch (ext) {
      case '.html':
        res.type('text/html');
        break;
      case '.css':
        res.type('text/css');
        break;
      case '.js':
        res.type('application/javascript');
        break;
      case '.json':
        res.type('application/json');
        break;
      case '.png':
        res.type('image/png');
        break;
      case '.jpg':
      case '.jpeg':
        res.type('image/jpeg');
        break;
      case '.gif':
        res.type('image/gif');
        break;
      case '.svg':
        res.type('image/svg+xml');
        break;
      case '.woff':
      case '.woff2':
        res.type('font/woff2');
        break;
      case '.ttf':
        res.type('font/ttf');
        break;
      case '.ico':
        res.type('image/x-icon');
        break;
      default:
        res.type('text/plain');
    }
    
    // For HTML files, inject hot-reload script for live updates
    if (ext === '.html' && file.content) {
      const modifiedContent = injectPreviewScripts(file.content, projectId);
      res.send(modifiedContent);
    } else {
      res.send(file.content || '');
    }
  } catch (error) {
    console.error('Error serving preview:', error);
    res.status(500).send('Failed to serve preview');
  }
});

// Get preview URL for a project with port support
// Note: This route handles /api/preview/projects/:id/preview-url
router.get('/projects/:id/preview-url', requireAuth, ensureProjectAccess, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { port } = req.query;
    const project = await storage.getProject(projectId);
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Check if it's an HTML project or has runnable code
    const files = await storage.getFiles(projectId);
    const hasHtmlFile = files.some(f => fname(f).endsWith('.html') && !f.isDirectory);
    const hasPackageJson = files.some(f => fname(f) === 'package.json' && !f.isDirectory);
    const hasPythonFiles = files.some(f => fname(f).endsWith('.py') && !f.isDirectory);
    
    if (!hasHtmlFile && !hasPackageJson && !hasPythonFiles) {
      return res.status(400).json({ error: 'No runnable files found in project' });
    }
    
    const { previewService } = await import('../preview/preview-service');
    const preview = previewService.getPreview(projectId);
    
    if (!preview || preview.status !== 'running') {
      // Return potential preview URL for client to start preview
      const previewUrl = `/api/preview/projects/${projectId}/preview/`;
      return res.json({ 
        previewUrl,
        status: 'stopped',
        message: 'Preview server not running. Click start to begin.'
      });
    }
    
    const targetPort = port ? parseInt(port as string) : preview.primaryPort;
    const previewUrl = previewService.getPreviewUrl(projectId, targetPort);
    const availablePorts = previewService.getPreviewPorts(projectId);
    const services = previewService.getPreviewServices(projectId);
    
    res.json({ 
      previewUrl,
      status: preview.status,
      runId: preview.runId,
      ports: availablePorts,
      primaryPort: preview.primaryPort,
      currentPort: targetPort,
      services,
      frameworkType: preview.frameworkType,
      lastHealthCheck: preview.lastHealthCheck
    });
  } catch (error) {
    console.error('Error getting preview URL:', error);
    res.status(500).json({ error: 'Failed to get preview URL' });
  }
});

export default router;