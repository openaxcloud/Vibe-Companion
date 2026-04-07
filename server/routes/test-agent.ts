import { Router } from 'express';
import { agentOrchestrator } from '../services/agent-orchestrator.service';
import { ensureAuthenticated } from '../middleware/auth';

const router = Router();

// SECURITY FIX: Test endpoint now requires authentication and uses authenticated user's ID
// Only available in development mode
router.post('/test/agent', ensureAuthenticated, async (req, res) => {
  // Block in production for security
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Test endpoints are disabled in production',
      code: 'PRODUCTION_BLOCKED'
    });
  }

  try {
    // Use authenticated user's ID instead of hardcoded admin ID
    const userId = req.user?.id?.toString();
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const session = await agentOrchestrator.createSession(userId, undefined, 'gpt-4o');
    
    // Execute agent with test message
    const messages = req.body.messages || [{
      role: 'user',
      content: 'Hello GPT-5! Confirm you are working on the E-Code Platform.'
    }];
    
    const result = await agentOrchestrator.executeAgent(
      session.id,
      messages,
      userId
    );
    
    res.json({
      success: true,
      sessionId: session.id,
      response: result.message,
      functionCalls: result.functionCalls
    });
  } catch (error: any) {
    console.error('[Test Agent] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      // Don't expose stack trace in production
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Health check for agent service
router.get('/test/agent/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Agent test endpoint is available',
    aiIntegrations: {
      baseUrl: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'not set',
      apiKeySet: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY
    }
  });
});

export default router;