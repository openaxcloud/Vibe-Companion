import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { ChatbotService } from '../services/ChatbotService.js';
import { WebSocketMessage } from '../../types/index.js';

interface ConnectedClient {
  ws: WebSocket;
  id: string;
  conversationId?: string;
}

export class WebSocketHandler {
  private clients: Map<string, ConnectedClient> = new Map();
  private chatbotService: ChatbotService;

  constructor(chatbotService: ChatbotService) {
    this.chatbotService = chatbotService;
  }

  handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = this.generateClientId();
    const client: ConnectedClient = { ws, id: clientId };
    
    this.clients.set(clientId, client);
    console.log(`🔗 Client ${clientId} connected. Total clients: ${this.clients.size}`);

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      data: { clientId, message: 'Connected to chatbot server' }
    });

    // Handle incoming messages
    ws.on('message', async (data: Buffer) => {
      try {
        const message: WebSocketMessage = JSON.parse(data.toString());
        await this.handleClientMessage(client, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        this.sendMessage(ws, {
          type: 'error',
          data: { message: 'Invalid message format' }
        });
      }
    });

    // Handle client disconnect
    ws.on('close', () => {
      this.clients.delete(clientId);
      console.log(`🔌 Client ${clientId} disconnected. Total clients: ${this.clients.size}`);
    });

    // Handle WebSocket errors
    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      this.clients.delete(clientId);
    });
  }

  private async handleClientMessage(client: ConnectedClient, message: WebSocketMessage): Promise<void> {
    const { ws } = client;

    switch (message.type) {
      case 'message':
        await this.handleChatMessage(client, message);
        break;

      case 'typing':
        // Echo typing indicator to other clients in the same conversation
        if (message.conversationId) {
          this.broadcastToConversation(message.conversationId, {
            type: 'typing',
            data: { userId: client.id, isTyping: message.data }
          }, client.id);
        }
        break;

      default:
        this.sendMessage(ws, {
          type: 'error',
          data: { message: `Unknown message type: ${message.type}` }
        });
    }
  }

  private async handleChatMessage(client: ConnectedClient, message: WebSocketMessage): Promise<void> {
    const { ws } = client;
    
    try {
      const { content, conversationId, settings } = message.data as any;
      
      if (!content || typeof content !== 'string') {
        this.sendMessage(ws, {
          type: 'error',
          data: { message: 'Message content is required' }
        });
        return;
      }

      // Update client's conversation ID
      if (conversationId) {
        client.conversationId = conversationId;
      }

      // Send typing indicator
      this.sendMessage(ws, {
        type: 'typing',
        data: { isTyping: true, isBot: true }
      });

      // Process the message
      const result = await this.chatbotService.sendMessage(content, conversationId, settings);
      
      // Stop typing indicator
      this.sendMessage(ws, {
        type: 'typing',
        data: { isTyping: false, isBot: true }
      });

      // Update client's conversation ID if it's a new conversation
      client.conversationId = result.conversation.id;

      // Send the response
      this.sendMessage(ws, {
        type: 'message',
        data: {
          message: result.response,
          conversation: result.conversation
        },
        conversationId: result.conversation.id
      });

    } catch (error) {
      console.error('Error processing chat message:', error);
      
      // Stop typing indicator
      this.sendMessage(ws, {
        type: 'typing',
        data: { isTyping: false, isBot: true }
      });

      this.sendMessage(ws, {
        type: 'error',
        data: { 
          message: error instanceof Error ? error.message : 'An error occurred while processing your message'
        }
      });
    }
  }

  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToConversation(conversationId: string, message: WebSocketMessage, excludeClientId?: string): void {
    this.clients.forEach((client, clientId) => {
      if (client.conversationId === conversationId && clientId !== excludeClientId) {
        this.sendMessage(client.ws, message);
      }
    });
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external use
  public getConnectedClientsCount(): number {
    return this.clients.size;
  }

  public broadcastToAll(message: WebSocketMessage): void {
    this.clients.forEach((client) => {
      this.sendMessage(client.ws, message);
    });
  }
}