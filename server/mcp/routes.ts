/**
 * MCP Server Routes with Authentication and CORS
 * Integrates all MCP endpoints with security layers
 */

import { Router } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { MCPHttpServer } from './http-transport';
import MCPServer from './server';
import { 
  authenticateMCP, 
  oauthAuthorize, 
  oauthToken, 
  getAuthInfo 
} from './auth';
import { 
  mcpCorsOptions, 
  mcpSecurityHeaders, 
  mcpRateLimitOptions 
} from './cors';
import githubRoutes from './api/github';
import postgresRoutes from './api/postgres';
import memoryRoutes from './api/memory';

const router = Router();

// Apply CORS to all MCP routes
router.use(cors(mcpCorsOptions));

// Apply security headers
router.use(mcpSecurityHeaders());

// Apply rate limiting
const limiter = rateLimit(mcpRateLimitOptions);
router.use(limiter);

// OAuth endpoints (no authentication required)
router.get('/oauth/authorize', oauthAuthorize);
router.post('/oauth/token', oauthToken);

// Authentication info endpoint
router.get('/auth/info', (req, res) => {
  const authInfo = getAuthInfo();
  res.json({
    ...authInfo,
    serverUrl: process.env.MCP_SERVER_URL || `https://${req.hostname}`,
    documentation: 'https://modelcontextprotocol.io/docs',
    version: '1.0.0',
    status: 'active'
  });
});

// Health check endpoint (no auth required)
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
      oauth: true,
      apiKey: true
    }
  });
});

// MCP Server API Routes
router.use('/github', githubRoutes);
router.use('/postgres', postgresRoutes);
router.use('/memory', memoryRoutes);

// Initialize HTTP transport (applied to existing Express app)
let httpServer: MCPHttpServer | null = null;
let mcpServerInstance: MCPServer | null = null;

import type { Express, Request, Response, NextFunction } from 'express';

export function initializeMCPRoutes(app: Express) {
  // Create MCP server instance
  mcpServerInstance = new MCPServer();
  
  // Create HTTP transport
  httpServer = new MCPHttpServer(app);
  
  // Connect MCP server to HTTP transport
  if (mcpServerInstance && httpServer) {
    httpServer.setMCPServer(mcpServerInstance.getServer());
  }
  
  // Apply MCP routes to the app
  app.use('/mcp', router);
  
  // Protected endpoints (require authentication)
  app.post('/mcp/connect', authenticateMCP, async (req: Request, res: Response, next: NextFunction) => {
    // Connection handled by http-transport
    next();
  });
  
  app.post('/mcp/message', authenticateMCP, async (req: Request, res: Response, next: NextFunction) => {
    // Message handling by http-transport
    next();
  });
  
  app.get('/mcp/tools', authenticateMCP, async (req: Request, res: Response, next: NextFunction) => {
    // Tools listing by http-transport
    next();
  });
  
  app.get('/mcp/resources', authenticateMCP, async (req: Request, res: Response, next: NextFunction) => {
    // Resources listing by http-transport
    next();
  });
  
  app.get('/mcp/events', authenticateMCP, async (req: Request, res: Response, next: NextFunction) => {
    // Events SSE by http-transport
    next();
  });
  
  return {
    httpServer,
    mcpServer: mcpServerInstance
  };
}

export default router;