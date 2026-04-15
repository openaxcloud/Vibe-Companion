import { Request, Response } from 'express';
import { ChatRequest, ChatResponse, ApiResponse } from '../../shared/types';
import { OpenAIService } from '../services/OpenAIService';
import { ConversationService } from '../services/ConversationService';

export class ChatController {
  constructor(
    private openAIService: OpenAIService,
    private conversationService: ConversationService
  ) {}

  async sendMessage(req: Request, res: Response): Promise<void> {
    try {
      const { message, conversationId }: ChatRequest = req.body;

      if (!message || message.trim() === '') {
        res.status(400).json({
          success: false,
          error: 'Message content is required',
        } as ApiResponse<never>);
        return;
      }

      // Get or create conversation
      let conversation = conversationId 
        ? this.conversationService.getConversation(conversationId)
        : null;
      
      if (!conversation) {
        conversation = this.conversationService.createConversation();
      }

      // Add user message
      const userMessage = this.conversationService.addMessage(
        conversation.id,
        message,
        'user'
      );

      // Get conversation history for AI
      const conversationHistory = this.conversationService.getMessagesForAI(conversation.id);

      // Generate AI response
      const aiResponse = await this.openAIService.generateResponse(conversationHistory);

      // Add AI message
      const assistantMessage = this.conversationService.addMessage(
        conversation.id,
        aiResponse,
        'assistant'
      );

      const response: ChatResponse = {
        message: assistantMessage,
        conversationId: conversation.id,
      };

      res.json({
        success: true,
        data: response,
      } as ApiResponse<ChatResponse>);

    } catch (error) {
      console.error('Chat error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      } as ApiResponse<never>);
    }
  }

  async getConversations(req: Request, res: Response): Promise<void> {
    try {
      const conversations = this.conversationService.getAllConversations();
      res.json({
        success: true,
        data: conversations,
      } as ApiResponse<typeof conversations>);
    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversations',
      } as ApiResponse<never>);
    }
  }

  async getConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const conversation = this.conversationService.getConversation(id);

      if (!conversation) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
        } as ApiResponse<never>);
        return;
      }

      res.json({
        success: true,
        data: conversation,
      } as ApiResponse<typeof conversation>);
    } catch (error) {
      console.error('Get conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch conversation',
      } as ApiResponse<never>);
    }
  }

  async deleteConversation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const deleted = this.conversationService.deleteConversation(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Conversation not found',
        } as ApiResponse<never>);
        return;
      }

      res.json({
        success: true,
        data: { deleted: true },
      } as ApiResponse<{ deleted: boolean }>);
    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete conversation',
      } as ApiResponse<never>);
    }
  }
}