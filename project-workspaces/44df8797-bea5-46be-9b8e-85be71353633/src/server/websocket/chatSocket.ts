import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { parse as parseUrl } from 'url';
import { AIService } from '../services/aiService';
import { ConversationService } from '../services/conversationService';
import { ChatEvent, Message, ChatSession } from '@/types/chatbot';
import { createMessage } from '@/utils/helpers';
import { isValidMessage, validateContext, isValidConversationId } from '@/utils/validation';

interface WebSocketClient extends WebSocket {
  sessionId?: string;
  userId?: string;
  conversationId?: string;
  isAlive?: boolean;
}

export class ChatSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocketClient> = new Map();
  private aiService: AIService;
  private conversationService: ConversationService;
  private heartbeatInterval: NodeJS.Timeout;

  constructor(
    server: any, // HTTP server
    aiService: AIService,
    conversationService: ConversationService
  ) {
    this.aiService = aiService;
    this.conversationService = conversationService;

    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    
    // Setup heartbeat to detect broken connections
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: WebSocketClient) => {
        if (ws.isAlive === false) {
          console.log('Terminating dead connection');
          return ws.terminate();
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private async handleConnection(ws: WebSocketClient, request: IncomingMessage) {
    try {
      // Parse connection parameters
      const url = parseUrl(request.url || '', true);
      const userId = url.query.userId as string || 'anonymous';
      const conversationId = url.query.conversationId as string;

      ws.userId = userId;
      ws.isAlive = true;

      // Validate conversation if provided
      if (conversationId && !isValidConversationId(conversationId)) {
        ws.close(1008, 'Invalid conversation ID');
        return;
      }

      // Get or create conversation
      let conversation;
      if (conversationId) {
        conversation = await this.conversationService.getConversation(conversationId);
        if (!conversation || conversation.userId !== userId) {
          ws.close(1008, 'Conversation not found or access denied');
          return;
        }
      } else {
        conversation = await this.conversationService.createConversation(userId);
      }

      // Create session
      const session = await this.conversationService.createSession(conversation.id);
      ws.sessionId = session.sessionId;
      ws.conversationId = conversation.id;
      
      // Store client
      this.clients.set(session.sessionId, ws);

      // Send connection confirmation
      this.sendEvent(ws, {
        type: 'connected',
        payload: { sessionId: session.sessionId }
      });

      console.log(`WebSocket client connected: ${session.sessionId}`);

      // Setup message handlers
      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleClose(ws));
      ws.on('error', (error) => this.handleError(ws, error));
      ws.on('pong', () => { ws.isAlive = true; });

    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  }

  private async handleMessage(ws: WebSocketClient, data: any) {
    try {
      const message = JSON.parse(data.toString());
      
      if (!ws.sessionId || !ws.conversationId) {
        this.sendEvent(ws, {
          type: 'error',
          payload: { error: 'Session not initialized' }
        });
        return;
      }

      // Update session activity
      await this.conversationService.updateSessionActivity(ws.sessionId);

      switch (message.type) {
        case 'message':
          await this.handleChatMessage(ws, message.payload);
          break;
          
        case 'typing':
          this.handleTypingIndicator(ws, message.payload);
          break;
          
        default:
          this.sendEvent(ws, {
            type: 'error',
            payload: { error: 'Unknown message type' }
          });
      }

    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      this.sendEvent(ws, {
        type: 'error',
        payload: { error: 'Invalid message format' }
      });
    }
  }

  private async handleChatMessage(ws: WebSocketClient, payload: any) {
    try {
      const { content, context } = payload;

      if (!isValidMessage(content)) {
        this.sendEvent(ws, {
          type: 'error',
          payload: { error: 'Invalid message content' }
        });
        return;
      }

      if (context && !validateContext(context)) {
        this.sendEvent(ws, {
          type: 'error',
          payload: { error: 'Invalid conversation context' }
        });
        return;
      }

      // Get conversation
      const conversation = await this.conversationService.getConversation(ws.conversationId!);
      if (!conversation) {
        this.sendEvent(ws, {
          type: 'error',
          payload: { error: 'Conversation not found' }
        });
        return;
      }

      // Create and store user message
      const userMessage = createMessage(content, 'user');
      await this.conversationService.addMessage(ws.conversationId!, userMessage);

      // Send user message confirmation
      this.sendEvent(ws, {
        type: 'message',
        payload: userMessage
      });

      // Show typing indicator while generating response
      this.sendEvent(ws, {
        type: 'typing',
        payload: { isTyping: true, userId: 'assistant' }
      });

      try {
        // Generate AI response
        const aiResponse = await this.aiService.generateResponse(
          [...conversation.messages, userMessage],
          conversation.context || context
        );

        // Create assistant message
        const assistantMessage = createMessage(
          aiResponse.content,
          'assistant',
          aiResponse.metadata
        );
        
        await this.conversationService.addMessage(ws.conversationId!, assistantMessage);

        // Stop typing indicator
        this.sendEvent(ws, {
          type: 'typing',
          payload: { isTyping: false, userId: 'assistant' }
        });

        // Send AI response
        this.sendEvent(ws, {
          type: 'message',
          payload: assistantMessage
        });

      } catch (error) {
        console.error('Error generating AI response:', error);
        
        this.sendEvent(ws, {
          type: 'typing',
          payload: { isTyping: false, userId: 'assistant' }
        });
        
        this.sendEvent(ws, {
          type: 'error',
          payload: { 
            error: 'Failed to generate response',
            messageId: userMessage.id
          }
        });
      }

    } catch (error) {
      console.error('Error handling chat message:', error);
      this.sendEvent(ws, {
        type: 'error',
        payload: { error: 'Internal server error' }
      });
    }
  }

  private handleTypingIndicator(ws: WebSocketClient, payload: any) {
    // For now, just echo typing indicators to other clients in the same conversation
    // In a multi-user scenario, you would broadcast to other users in the conversation
    const { isTyping } = payload;
    
    if (typeof isTyping === 'boolean') {
      // Update session activity when user is typing
      if (ws.sessionId) {
        this.conversationService.updateSessionActivity(ws.sessionId);
      }
    }
  }

  private async handleClose(ws: WebSocketClient) {
    try {
      if (ws.sessionId) {
        console.log(`WebSocket client disconnected: ${ws.sessionId}`);
        
        // Deactivate session
        await this.conversationService.deactivateSession(ws.sessionId);
        
        // Remove from clients map
        this.clients.delete(ws.sessionId);

        // Send disconnect event to remaining clients if needed
        this.sendEvent(ws, {
          type: 'disconnected',
          payload: { sessionId: ws.sessionId }
        });
      }
    } catch (error) {
      console.error('Error handling WebSocket close:', error);
    }
  }

  private handleError(ws: WebSocketClient, error: Error) {
    console.error('WebSocket error:', error);
    this.sendEvent(ws, {
      type: 'error',
      payload: { error: 'Connection error' }
    });
  }

  private sendEvent(ws: WebSocketClient, event: ChatEvent) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(event));
      } catch (error) {
        console.error('Error sending WebSocket event:', error);
      }
    }
  }

  public broadcastToConversation(conversationId: string, event: ChatEvent, excludeSessionId?: string) {
    for (const [sessionId, client] of this.clients.entries()) {
      if (client.conversationId === conversationId && sessionId !== excludeSessionId) {
        this.sendEvent(client, event);
      }
    }
  }

  public getActiveConnections(): number {
    return this.clients.size;
  }

  public getConnectionsForConversation(conversationId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.conversationId === conversationId) {
        count++;
      }
    }
    return count;
  }

  public close() {
    clearInterval(this.heartbeatInterval);
    this.wss.close();
  }
}