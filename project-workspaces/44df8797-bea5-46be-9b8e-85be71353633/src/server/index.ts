import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer } from 'http';
import dotenv from 'dotenv';
import path from 'path';

import { AIService } from './services/aiService';
import { ConversationService } from './services/conversationService';
import { createChatRoutes } from './routes/chatRoutes';
import { ChatSocketServer } from './websocket/chatSocket';
import { ApiResponse, HealthCheckResponse } from '@/types/api';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize services
const aiService = new AIService();
const conversationService = new ConversationService();

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  }
}));

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const aiAvailable = await aiService.validateApiKey();
    
    const response: HealthCheckResponse = {
      status: aiAvailable ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected', // In-memory for now, would be actual DB status
        ai: aiAvailable ? 'available' : 'unavailable'
      }
    };

    res.status(aiAvailable ? 200 : 503).json(response);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'disconnected',
        ai: 'unavailable'
      }
    } as HealthCheckResponse);
  }
});

// API routes
app.use('/api/chat', createChatRoutes(aiService, conversationService));

// Admin/debug endpoints
if (process.env.NODE_ENV === 'development') {
  app.get('/api/admin/conversations', (req, res) => {
    const conversations = conversationService.getAllConversations();
    res.json({
      success: true,
      data: conversations,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  });

  app.get('/api/admin/sessions', (req, res) => {
    const sessions = conversationService.getActiveSessions();
    res.json({
      success: true,
      data: sessions,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  });

  app.get('/api/admin/config', (req, res) => {
    const config = aiService.getConfig();
    res.json({
      success: true,
      data: config,
      timestamp: new Date().toISOString()
    } as ApiResponse);
  });
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
  });
}

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
    timestamp: new Date().toISOString()
  } as ApiResponse);
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    timestamp: new Date().toISOString()
  } as ApiResponse);
});

// Initialize WebSocket server
const chatSocket = new ChatSocketServer(server, aiService, conversationService);

// Cleanup function
const cleanup = async () => {
  console.log('Shutting down server...');
  
  // Cleanup inactive sessions
  await conversationService.cleanupInactiveSessions();
  
  // Close WebSocket server
  chatSocket.close();
  
  // Close HTTP server
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
};

// Handle graceful shutdown
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 API documentation: http://localhost:${PORT}/health`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}/ws`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🛠️  Admin endpoints available at /api/admin/*`);
  }
});

// Periodic cleanup of inactive sessions
setInterval(async () => {
  try {
    await conversationService.cleanupInactiveSessions();
  } catch (error) {
    console.error('Error during periodic cleanup:', error);
  }
}, 5 * 60 * 1000); // Every 5 minutes

export { app, server };