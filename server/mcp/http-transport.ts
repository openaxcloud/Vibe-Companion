// @ts-nocheck
/**
 * HTTP Transport for MCP Server
 * Enables MCP server to work over HTTP instead of STDIO
 */

import { Express, Request, Response } from "express";
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { EventEmitter } from "events";
import * as crypto from "crypto";
import { Readable, Writable } from "stream";
import { validateAndSetSSEHeaders } from "../utils/sse-headers";

const uuidv4 = () => crypto.randomUUID();

interface Session {
  id: string;
  transport: HttpServerTransport;
  server: MCPServer;
  lastActivity: Date;
}

// Create a proper transport that implements the expected interface
class HttpServerTransport {
  public readable: Readable;
  public writable: Writable;
  private messageQueue: any[] = [];
  private responseCallbacks: Map<string, (response: any) => void> = new Map();
  
  constructor(public sessionId: string) {
    // Create readable stream for the MCP server to read from
    this.readable = new Readable({
      read() {}
    });
    
    // Create writable stream for the MCP server to write to
    this.writable = new Writable({
      write: (chunk, encoding, callback) => {
        try {
          const message = JSON.parse(chunk.toString());
          this.handleServerMessage(message);
        } catch (error) {
          console.error('[MCP] Failed to parse server message:', error);
        }
        callback();
      }
    });
  }
  
  // Required by MCP SDK - Start the transport
  async start() {
    // HTTP transport is ready immediately
    return Promise.resolve();
  }
  
  // Handle messages from the MCP server
  private handleServerMessage(message: any) {
    if (message.id && this.responseCallbacks.has(message.id)) {
      const callback = this.responseCallbacks.get(message.id)!;
      this.responseCallbacks.delete(message.id);
      callback(message);
    } else {
      this.messageQueue.push(message);
    }
  }
  
  // Send a message to the MCP server
  sendToServer(message: any): Promise<any> {
    return new Promise((resolve) => {
      const messageId = message.id || uuidv4();
      const messageWithId = { ...message, id: messageId };
      
      this.responseCallbacks.set(messageId, resolve);
      
      // Write message to the readable stream for the server to process
      this.readable.push(JSON.stringify(messageWithId) + '\n');
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.responseCallbacks.has(messageId)) {
          this.responseCallbacks.delete(messageId);
          resolve({ 
            jsonrpc: "2.0",
            id: messageId,
            error: { 
              code: -32000, 
              message: "Request timeout" 
            }
          });
        }
      }, 30000);
    });
  }
  
  getMessages(): any[] {
    const messages = [...this.messageQueue];
    this.messageQueue = [];
    return messages;
  }
  
  async close() {
    this.readable.destroy();
    this.writable.destroy();
    this.responseCallbacks.clear();
    this.messageQueue = [];
  }
}

export class MCPHttpServer {
  private sessions: Map<string, Session> = new Map();
  private mcpServerInstance: any = null;
  
  constructor(private app: Express) {
    this.setupRoutes();
    this.startCleanupInterval();
  }
  
  // Set the MCP server instance
  setMCPServer(server: any) {
    this.mcpServerInstance = server;
  }
  
  private setupRoutes() {
    // Connect endpoint - establishes a new session
    this.app.post("/mcp/connect", async (req: Request, res: Response) => {
      const sessionId = req.body.sessionId || uuidv4();
      
      if (!this.sessions.has(sessionId)) {
        const transport = new HttpServerTransport(sessionId);
        
        // Create a new MCP server instance for this session
        let server: any = null;
        if (this.mcpServerInstance) {
          server = this.mcpServerInstance;
          
          try {
            // Connect the server to the transport using stdio transport
            await server.connect(transport);
          } catch (error) {
            console.error('[MCP] Failed to connect server to transport:', error);
          }
        }
        
        const session: Session = {
          id: sessionId,
          transport,
          server,
          lastActivity: new Date(),
        };
        
        this.sessions.set(sessionId, session);
      }
      
      res.json({ 
        sessionId, 
        status: "connected",
        capabilities: {
          tools: true,
          resources: true,
          prompts: true,
        }
      });
    });
    
    // Message endpoint - send messages to MCP server
    this.app.post("/mcp/message", async (req: Request, res: Response) => {
      const sessionId = req.headers["x-session-id"] as string;
      
      if (!sessionId || !this.sessions.has(sessionId)) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
      
      try {
        // Send the message to the MCP server through the transport
        const response = await session.transport.sendToServer(req.body);
        res.json(response);
      } catch (error: any) {
        res.status(500).json({ 
          error: "Failed to process message",
          details: error.message 
        });
      }
    });
    
    // Events endpoint - Server-Sent Events for notifications
    this.app.get("/mcp/events", (req: Request, res: Response) => {
      const sessionId = req.headers["x-session-id"] as string;
      
      if (!sessionId || !this.sessions.has(sessionId)) {
        return res.status(401).json({ error: "Invalid session" });
      }
      
      const session = this.sessions.get(sessionId)!;
      session.lastActivity = new Date();
      
      // Set up SSE with CORS security - reject invalid origins with 403
      if (!validateAndSetSSEHeaders(res, req)) {
        return;
      }
      
      // Send initial ping
      res.write("data: {\"type\":\"ping\"}\n\n");
      
      // Set up message listener
      const messageHandler = (message: any) => {
        res.write(`data: ${JSON.stringify(message)}\n\n`);
      };
      
      session.transport.on("message", messageHandler);
      
      // Clean up on disconnect
      req.on("close", () => {
        session.transport.off("message", messageHandler);
      });
      
      // Keep connection alive
      const pingInterval = setInterval(() => {
        res.write("data: {\"type\":\"ping\"}\n\n");
      }, 30000);
      
      req.on("close", () => {
        clearInterval(pingInterval);
      });
    });
    
    // Disconnect endpoint
    this.app.post("/mcp/disconnect", (req: Request, res: Response) => {
      const sessionId = req.headers["x-session-id"] as string;
      
      if (sessionId && this.sessions.has(sessionId)) {
        const session = this.sessions.get(sessionId)!;
        session.transport.close();
        this.sessions.delete(sessionId);
      }
      
      res.json({ status: "disconnected" });
    });
    
    // List available tools
    this.app.get("/mcp/tools", async (req: Request, res: Response) => {
      const sessionId = req.headers["x-session-id"] as string;
      
      if (!sessionId || !this.sessions.has(sessionId)) {
        // Return public tool list without session
        return res.json({
          tools: [
            "fs_read", "fs_write", "fs_delete", "fs_list",
            "exec_command", "exec_spawn",
            "db_query", "db_migrate",
            "api_request", "api_graphql",
            "system_info", "git_status",
            "ai_complete"
          ]
        });
      }
      
      const session = this.sessions.get(sessionId)!;
      const response = await session.transport.receive({
        jsonrpc: "2.0",
        method: "tools/list",
        params: {},
      });
      
      res.json(response.result);
    });
    
    // List available resources
    this.app.get("/mcp/resources", async (req: Request, res: Response) => {
      const sessionId = req.headers["x-session-id"] as string;
      
      if (!sessionId || !this.sessions.has(sessionId)) {
        return res.status(401).json({ error: "Session required" });
      }
      
      const session = this.sessions.get(sessionId)!;
      const response = await session.transport.receive({
        jsonrpc: "2.0",
        method: "resources/list",
        params: {},
      });
      
      res.json(response.result);
    });
  }
  
  setMCPServer(server: MCPServer) {
    this.mcpServer = server;
  }
  
  private startCleanupInterval() {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      const now = new Date();
      const timeout = 30 * 60 * 1000; // 30 minutes
      
      const sessionsToDelete: string[] = [];
      this.sessions.forEach((session, sessionId) => {
        if (now.getTime() - session.lastActivity.getTime() > timeout) {
          session.transport.close();
          sessionsToDelete.push(sessionId);
        }
      });
      
      sessionsToDelete.forEach(id => this.sessions.delete(id));
    }, 5 * 60 * 1000);
  }
  
  async shutdown() {
    this.sessions.forEach(session => {
      session.transport.close();
    });
    this.sessions.clear();
    
    if (this.mcpServer) {
      await this.mcpServer.close();
    }
  }
}

export default MCPHttpServer;