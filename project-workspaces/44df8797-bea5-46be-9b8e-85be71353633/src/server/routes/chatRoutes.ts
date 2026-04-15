import express from 'express';
import { AIService } from '../services/aiService';
import { ConversationService } from '../services/conversationService';
import { 
  SendMessageRequest, 
  SendMessageResponse,
  Message,
  ConversationContext 
} from '@/types/chatbot';
import { ApiResponse } from '@/types/api';
import { createMessage, generateId } from '@/utils/helpers';
import { isValidMessage, validateContext, isValidConversationId } from '@/utils/validation';

const router = express.Router();

export function createChatRoutes(
  aiService: AIService, 
  conversationService: ConversationService
) {
  // Send a message and get AI response
  router.post('/message', async (req, res) => {
    try {
      const { content, conversationId, context }: SendMessageRequest = req.body;
      const userId = req.headers['x-user-id'] as string || 'anonymous';

      // Validation
      if (!isValidMessage(content)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid message content',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      if (context && !validateContext(context)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation context',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Get or create conversation
      let conversation;
      if (conversationId && isValidConversationId(conversationId)) {
        conversation = await conversationService.getConversation(conversationId);
        if (!conversation) {
          return res.status(404).json({
            success: false,
            error: 'Conversation not found',
            timestamp: new Date().toISOString()
          } as ApiResponse);
        }
      } else {
        conversation = await conversationService.createConversation(userId, context);
      }

      // Create user message
      const userMessage = createMessage(content, 'user');
      await conversationService.addMessage(conversation.id, userMessage);

      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        [...conversation.messages, userMessage],
        conversation.context || context
      );

      // Create assistant message
      const assistantMessage = createMessage(
        aiResponse.content,
        'assistant',
        aiResponse.metadata
      );
      await conversationService.addMessage(conversation.id, assistantMessage);

      const response: SendMessageResponse = {
        message: userMessage,
        aiResponse: assistantMessage,
        conversationId: conversation.id
      };

      res.json({
        success: true,
        data: response,
        timestamp: new Date().toISOString()
      } as ApiResponse<SendMessageResponse>);

    } catch (error) {
      console.error('Error handling message:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  });

  // Get conversation history
  router.get('/conversation/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.headers['x-user-id'] as string || 'anonymous';

      if (!isValidConversationId(conversationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation ID',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const conversation = await conversationService.getConversation(conversationId);
      if (!conversation) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      // Security check - users can only access their own conversations
      if (conversation.userId !== userId && userId !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: conversation,
        timestamp: new Date().toISOString()
      } as ApiResponse);

    } catch (error) {
      console.error('Error fetching conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  });

  // Get user's conversations
  router.get('/conversations', async (req, res) => {
    try {
      const userId = req.headers['x-user-id'] as string || 'anonymous';
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const allConversations = await conversationService.getUserConversations(userId);
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const conversations = allConversations.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: conversations,
        pagination: {
          page,
          limit,
          total: allConversations.length,
          pages: Math.ceil(allConversations.length / limit)
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  });

  // Update conversation context
  router.patch('/conversation/:conversationId/context', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const context: ConversationContext = req.body;
      const userId = req.headers['x-user-id'] as string || 'anonymous';

      if (!isValidConversationId(conversationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation ID',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      if (!validateContext(context)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation context',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const conversation = await conversationService.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      await conversationService.updateConversationContext(conversationId, context);

      res.json({
        success: true,
        data: { message: 'Context updated successfully' },
        timestamp: new Date().toISOString()
      } as ApiResponse);

    } catch (error) {
      console.error('Error updating conversation context:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  });

  // Delete conversation
  router.delete('/conversation/:conversationId', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.headers['x-user-id'] as string || 'anonymous';

      if (!isValidConversationId(conversationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation ID',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const deleted = await conversationService.deleteConversation(conversationId, userId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      res.json({
        success: true,
        data: { message: 'Conversation deleted successfully' },
        timestamp: new Date().toISOString()
      } as ApiResponse);

    } catch (error) {
      console.error('Error deleting conversation:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  });

  // Get conversation statistics
  router.get('/conversation/:conversationId/stats', async (req, res) => {
    try {
      const { conversationId } = req.params;
      const userId = req.headers['x-user-id'] as string || 'anonymous';

      if (!isValidConversationId(conversationId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid conversation ID',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const conversation = await conversationService.getConversation(conversationId);
      if (!conversation || conversation.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Conversation not found',
          timestamp: new Date().toISOString()
        } as ApiResponse);
      }

      const stats = await conversationService.getConversationStats(conversationId);

      res.json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      } as ApiResponse);

    } catch (error) {
      console.error('Error fetching conversation stats:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      } as ApiResponse);
    }
  });

  return router;
}