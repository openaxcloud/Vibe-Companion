/**
 * MCP Client for integrating with the MCP Server
 * Provides HTTP-based transport for web environments
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { 
  CallToolResult,
  ListResourcesResult,
  ListToolsResult,
  ReadResourceResult,
} from "@modelcontextprotocol/sdk/types.js";
import { EventEmitter } from "events";
import * as crypto from "crypto";

// MCP Server URL configuration with production validation
const DEFAULT_MCP_SERVER_URL = "http://localhost:3200/mcp";

// ✅ B-C3 FIX: Require MCP_SERVER_URL in production
if (process.env.NODE_ENV === 'production' && !process.env.MCP_SERVER_URL) {
  throw new Error('[MCP] CRITICAL: MCP_SERVER_URL environment variable is required in production');
}

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || DEFAULT_MCP_SERVER_URL;

// Custom HTTP transport for MCP
class HttpClientTransport extends EventEmitter {
  private baseUrl: string;
  private sessionId: string;
  private abortController: AbortController;

  constructor(baseUrl: string) {
    super();
    this.baseUrl = baseUrl;
    this.sessionId = crypto.randomUUID();
    this.abortController = new AbortController();
  }

  async start() {
    // Initialize connection
    const response = await fetch(`${this.baseUrl}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: this.sessionId }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to connect to MCP server: ${response.statusText}`);
    }
    
    // Start listening for server events
    this.startEventStream();
  }

  async send(message: any) {
    const response = await fetch(`${this.baseUrl}/message`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Session-Id": this.sessionId,
      },
      body: JSON.stringify(message),
      signal: this.abortController.signal,
    });
    
    if (!response.ok) {
      throw new Error(`Request failed: ${response.statusText}`);
    }
    
    return response.json();
  }

  private async startEventStream() {
    const response = await fetch(`${this.baseUrl}/events`, {
      headers: { "X-Session-Id": this.sessionId },
      signal: this.abortController.signal,
    });
    
    if (!response.body) {
      throw new Error("No response body for event stream");
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));
            this.emit("message", data);
          }
        }
      }
    } catch (error) {
      if (!this.abortController.signal.aborted) {
        console.error("Event stream error:", error);
        this.emit("error", error);
      }
    }
  }

  async close() {
    this.abortController.abort();
    await fetch(`${this.baseUrl}/disconnect`, {
      method: "POST",
      headers: { "X-Session-Id": this.sessionId },
    });
  }
}

export class MCPClient {
  private client: Client;
  private transport: HttpClientTransport;
  private isConnected: boolean = false;
  
  constructor(serverUrl: string = MCP_SERVER_URL) {
    this.transport = new HttpClientTransport(serverUrl);
    this.client = new Client(
      { name: "E-Code Platform", version: "1.0.0" },
      { capabilities: {} }
    );
  }
  
  async connect() {
    if (this.isConnected) return;
    
    try {
      await this.transport.start();
      await this.client.connect(this.transport as any);
      this.isConnected = true;
    } catch (error) {
      console.error("Failed to connect to MCP server:", error);
      throw error;
    }
  }
  
  async disconnect() {
    if (!this.isConnected) return;
    
    await this.client.close();
    await this.transport.close();
    this.isConnected = false;
  }
  
  // Tool operations
  async listTools(): Promise<ListToolsResult> {
    this.ensureConnected();
    return this.client.listTools();
  }
  
  async callTool(name: string, args: any): Promise<any> {
    this.ensureConnected();
    const result = await this.client.callTool({ name, arguments: args });
    return result as any;
  }
  
  // Resource operations
  async listResources(): Promise<ListResourcesResult> {
    this.ensureConnected();
    return this.client.listResources();
  }
  
  async readResource(uri: string): Promise<ReadResourceResult> {
    this.ensureConnected();
    return this.client.readResource({ uri });
  }
  
  // High-level operations
  async executeCommand(command: string, options?: any): Promise<any> {
    return this.callTool("exec_command", { command, ...options });
  }
  
  async readFile(path: string): Promise<string> {
    const result = await this.callTool("fs_read", { path });
    return result?.content?.[0]?.text || "";
  }
  
  async writeFile(path: string, content: string): Promise<void> {
    await this.callTool("fs_write", { path, content });
  }
  
  async listFiles(path: string, pattern?: string): Promise<any[]> {
    const result = await this.callTool("fs_list", { path, pattern });
    const text = result?.content?.[0]?.text;
    return text ? JSON.parse(text) : [];
  }
  
  async queryDatabase(query: string, params?: any[]): Promise<any[]> {
    const result = await this.callTool("db_query", { 
      query, 
      params, 
      operation: "select" 
    });
    const text = result?.content?.[0]?.text;
    return text ? JSON.parse(text) : [];
  }
  
  async makeApiRequest(url: string, options?: any): Promise<any> {
    const result = await this.callTool("api_request", { url, ...options });
    const text = result?.content?.[0]?.text;
    return text ? JSON.parse(text) : null;
  }
  
  async getSystemInfo(): Promise<any> {
    const result = await this.callTool("system_info", { type: "all" });
    const text = result?.content?.[0]?.text;
    return text ? JSON.parse(text) : {};
  }
  
  async generateAICompletion(prompt: string, options?: any): Promise<string> {
    const result = await this.callTool("ai_complete", { prompt, ...options });
    return result?.content?.[0]?.text || "";
  }
  
  private ensureConnected() {
    if (!this.isConnected) {
      throw new Error("MCP client is not connected. Call connect() first.");
    }
  }
}

// Singleton instance
let mcpClient: MCPClient | null = null;

export function getMCPClient(): MCPClient {
  if (!mcpClient) {
    mcpClient = new MCPClient();
  }
  return mcpClient;
}

export default MCPClient;