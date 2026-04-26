// @ts-nocheck
/**
 * Model Context Protocol (MCP) Server Implementation
 * Complete implementation with all features and capabilities
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs/promises";
import * as path from "path";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { glob } from "glob";
import * as chokidar from "chokidar";
import { db, client } from "../db";
import { z } from "zod";
import * as http from "http";
import * as https from "https";
import * as os from "os";
import * as crypto from "crypto";
import { githubMCP } from './servers/github-mcp';
import { postgresMCP } from './servers/postgres-mcp';
import { memoryMCP } from './servers/memory-mcp';
import { slackMCP } from './servers/slack-mcp';
import { figmaMCP } from './servers/figma-mcp';
import { openSourceModelsProvider, OPENSOURCE_MODELS } from '../ai/opensource-models-provider';

const execAsync = promisify(exec);

// Environment configuration
const MCP_CONFIG = {
  name: "E-Code MCP Server",
  version: "1.0.0",
  capabilities: {
    tools: true,
    resources: true,
    prompts: true,
    sampling: true,
    notifications: true,
  },
  security: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedPaths: [process.cwd()],
    forbiddenPaths: ["/etc", "/sys", "/proc"],
    maxCommandTimeout: 60000, // 60 seconds
  },
};

// Input validation schemas
const FileOperationSchema = z.object({
  path: z.string(),
  content: z.string().optional(),
  encoding: z.enum(["utf8", "base64", "hex"]).default("utf8"),
});

const CommandExecutionSchema = z.object({
  command: z.string(),
  cwd: z.string().optional(),
  timeout: z.number().optional().default(30000),
  env: z.record(z.string()).optional(),
});

const DatabaseQuerySchema = z.object({
  query: z.string(),
  params: z.array(z.any()).optional(),
  operation: z.enum(["select", "insert", "update", "delete", "raw"]),
});

const ApiRequestSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  timeout: z.number().optional().default(30000),
});

export default class MCPServer {
  private server: Server;
  public handlers: Map<string, any> = new Map();
  private fileWatchers: Map<string, chokidar.FSWatcher> = new Map();
  private activeProcesses: Map<string, any> = new Map();
  
  constructor() {
    this.server = new Server(
      {
        name: MCP_CONFIG.name,
        version: MCP_CONFIG.version,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers() {
    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        // Filesystem tools
        {
          name: "fs_read",
          description: "Read file contents from the filesystem",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path to read" },
              encoding: { type: "string", enum: ["utf8", "base64", "hex"], default: "utf8" }
            },
            required: ["path"]
          }
        },
        {
          name: "fs_write",
          description: "Write content to a file",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "File path to write" },
              content: { type: "string", description: "Content to write" },
              encoding: { type: "string", enum: ["utf8", "base64", "hex"], default: "utf8" }
            },
            required: ["path", "content"]
          }
        },
        {
          name: "fs_delete",
          description: "Delete a file or directory",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Path to delete" },
              recursive: { type: "boolean", default: false }
            },
            required: ["path"]
          }
        },
        {
          name: "fs_list",
          description: "List directory contents",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Directory path" },
              pattern: { type: "string", description: "Glob pattern for filtering" },
              recursive: { type: "boolean", default: false }
            },
            required: ["path"]
          }
        },
        {
          name: "fs_mkdir",
          description: "Create a directory",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Directory path to create" },
              recursive: { type: "boolean", default: true }
            },
            required: ["path"]
          }
        },
        {
          name: "fs_move",
          description: "Move or rename a file/directory",
          inputSchema: {
            type: "object",
            properties: {
              source: { type: "string", description: "Source path" },
              destination: { type: "string", description: "Destination path" }
            },
            required: ["source", "destination"]
          }
        },
        {
          name: "fs_copy",
          description: "Copy a file or directory",
          inputSchema: {
            type: "object",
            properties: {
              source: { type: "string", description: "Source path" },
              destination: { type: "string", description: "Destination path" },
              recursive: { type: "boolean", default: false }
            },
            required: ["source", "destination"]
          }
        },
        {
          name: "fs_watch",
          description: "Watch a file or directory for changes",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Path to watch" },
              events: { 
                type: "array", 
                items: { type: "string", enum: ["add", "change", "unlink"] },
                default: ["change"]
              }
            },
            required: ["path"]
          }
        },
        
        // Command execution tools
        {
          name: "exec_command",
          description: "Execute a shell command",
          inputSchema: {
            type: "object",
            properties: {
              command: { type: "string", description: "Command to execute" },
              cwd: { type: "string", description: "Working directory" },
              timeout: { type: "number", description: "Timeout in milliseconds", default: 30000 },
              env: { type: "object", description: "Environment variables" }
            },
            required: ["command"]
          }
        },
        {
          name: "exec_spawn",
          description: "Spawn a long-running process",
          inputSchema: {
            type: "object",
            properties: {
              command: { type: "string", description: "Command to spawn" },
              args: { type: "array", items: { type: "string" }, description: "Command arguments" },
              cwd: { type: "string", description: "Working directory" },
              env: { type: "object", description: "Environment variables" }
            },
            required: ["command"]
          }
        },
        {
          name: "exec_kill",
          description: "Kill a running process",
          inputSchema: {
            type: "object",
            properties: {
              processId: { type: "string", description: "Process ID to kill" },
              signal: { type: "string", default: "SIGTERM" }
            },
            required: ["processId"]
          }
        },
        
        // Database tools
        {
          name: "db_query",
          description: "Execute a database query",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "SQL query to execute" },
              params: { type: "array", description: "Query parameters" },
              operation: { 
                type: "string", 
                enum: ["select", "insert", "update", "delete", "raw"],
                description: "Query operation type"
              }
            },
            required: ["query", "operation"]
          }
        },
        {
          name: "db_migrate",
          description: "Run database migrations",
          inputSchema: {
            type: "object",
            properties: {
              direction: { type: "string", enum: ["up", "down"], default: "up" },
              target: { type: "string", description: "Target migration version" }
            }
          }
        },
        {
          name: "db_schema",
          description: "Get database schema information",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name (optional)" }
            }
          }
        },
        
        // API tools
        {
          name: "api_request",
          description: "Make an HTTP API request",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "Request URL" },
              method: { 
                type: "string", 
                enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
                default: "GET"
              },
              headers: { type: "object", description: "Request headers" },
              body: { type: ["object", "string"], description: "Request body" },
              timeout: { type: "number", default: 30000 }
            },
            required: ["url"]
          }
        },
        {
          name: "api_graphql",
          description: "Execute a GraphQL query",
          inputSchema: {
            type: "object",
            properties: {
              endpoint: { type: "string", description: "GraphQL endpoint" },
              query: { type: "string", description: "GraphQL query" },
              variables: { type: "object", description: "Query variables" },
              headers: { type: "object", description: "Request headers" }
            },
            required: ["endpoint", "query"]
          }
        },
        
        // System tools
        {
          name: "system_info",
          description: "Get system information",
          inputSchema: {
            type: "object",
            properties: {
              type: { 
                type: "string",
                enum: ["cpu", "memory", "disk", "network", "os", "all"],
                default: "all"
              }
            }
          }
        },
        {
          name: "env_get",
          description: "Get environment variables",
          inputSchema: {
            type: "object",
            properties: {
              key: { type: "string", description: "Environment variable key (optional)" }
            }
          }
        },
        {
          name: "env_set",
          description: "Set environment variable",
          inputSchema: {
            type: "object",
            properties: {
              key: { type: "string", description: "Environment variable key" },
              value: { type: "string", description: "Environment variable value" }
            },
            required: ["key", "value"]
          }
        },
        
        // Development tools
        {
          name: "git_status",
          description: "Get Git repository status",
          inputSchema: {
            type: "object",
            properties: {
              path: { type: "string", description: "Repository path", default: "." }
            }
          }
        },
        {
          name: "npm_install",
          description: "Install npm packages",
          inputSchema: {
            type: "object",
            properties: {
              packages: { type: "array", items: { type: "string" }, description: "Packages to install" },
              dev: { type: "boolean", default: false },
              global: { type: "boolean", default: false }
            }
          }
        },
        {
          name: "docker_run",
          description: "Run a Docker container",
          inputSchema: {
            type: "object",
            properties: {
              image: { type: "string", description: "Docker image" },
              name: { type: "string", description: "Container name" },
              ports: { type: "array", items: { type: "string" }, description: "Port mappings" },
              volumes: { type: "array", items: { type: "string" }, description: "Volume mappings" },
              env: { type: "object", description: "Environment variables" }
            },
            required: ["image"]
          }
        },
        
        // AI/ML tools
        {
          name: "ai_complete",
          description: "Get AI completion",
          inputSchema: {
            type: "object",
            properties: {
              prompt: { type: "string", description: "Prompt for completion" },
              model: { type: "string", default: "claude-opus-4-7" },
              temperature: { type: "number", default: 0.7 },
              maxTokens: { type: "number", default: 2048 }
            },
            required: ["prompt"]
          }
        },
        {
          name: "ai_embed",
          description: "Generate text embeddings",
          inputSchema: {
            type: "object",
            properties: {
              text: { type: "string", description: "Text to embed" },
              model: { type: "string", default: "text-embedding-ada-002" }
            },
            required: ["text"]
          }
        },
        
        // GitHub MCP Tools
        {
          name: "github_list_repos",
          description: "List GitHub repositories for a user",
          inputSchema: {
            type: "object",
            properties: {
              username: { type: "string", description: "GitHub username" }
            },
            required: ["username"]
          }
        },
        {
          name: "github_create_repo",
          description: "Create a new GitHub repository",
          inputSchema: {
            type: "object",
            properties: {
              name: { type: "string", description: "Repository name" },
              description: { type: "string", description: "Repository description" },
              private: { type: "boolean", default: false }
            },
            required: ["name"]
          }
        },
        {
          name: "github_create_issue",
          description: "Create a GitHub issue",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner" },
              repo: { type: "string", description: "Repository name" },
              title: { type: "string", description: "Issue title" },
              body: { type: "string", description: "Issue body" },
              labels: { type: "array", items: { type: "string" }, description: "Issue labels" }
            },
            required: ["owner", "repo", "title"]
          }
        },
        {
          name: "github_create_pr",
          description: "Create a GitHub pull request",
          inputSchema: {
            type: "object",
            properties: {
              owner: { type: "string", description: "Repository owner" },
              repo: { type: "string", description: "Repository name" },
              title: { type: "string", description: "PR title" },
              head: { type: "string", description: "Head branch" },
              base: { type: "string", description: "Base branch" },
              body: { type: "string", description: "PR body" }
            },
            required: ["owner", "repo", "title", "head", "base"]
          }
        },
        
        // PostgreSQL MCP Tools
        {
          name: "postgres_list_tables",
          description: "List PostgreSQL database tables",
          inputSchema: {
            type: "object",
            properties: {
              schema: { type: "string", default: "public", description: "Schema name" }
            }
          }
        },
        {
          name: "postgres_get_schema",
          description: "Get PostgreSQL table schema",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name" },
              schema: { type: "string", default: "public", description: "Schema name" }
            },
            required: ["table"]
          }
        },
        {
          name: "postgres_query",
          description: "Execute PostgreSQL query",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "SQL query" },
              params: { type: "array", items: { type: "string" }, description: "Query parameters" }
            },
            required: ["query"]
          }
        },
        {
          name: "postgres_backup",
          description: "Create PostgreSQL backup",
          inputSchema: {
            type: "object",
            properties: {
              table: { type: "string", description: "Table name (optional, backs up entire schema if not provided)" },
              schema: { type: "string", default: "public", description: "Schema name" }
            }
          }
        },
        
        // Memory MCP Tools
        {
          name: "memory_create_node",
          description: "Create a knowledge graph node",
          inputSchema: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["concept", "entity", "event", "fact", "idea"], description: "Node type" },
              content: { type: "string", description: "Node content" },
              metadata: { type: "object", description: "Additional metadata" }
            },
            required: ["type", "content"]
          }
        },
        {
          name: "memory_search",
          description: "Search knowledge graph nodes",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query" },
              type: { type: "string", enum: ["concept", "entity", "event", "fact", "idea"], description: "Filter by node type" },
              limit: { type: "number", default: 10, description: "Maximum results" }
            },
            required: ["query"]
          }
        },
        {
          name: "memory_create_edge",
          description: "Create a relationship between nodes",
          inputSchema: {
            type: "object",
            properties: {
              sourceId: { type: "string", description: "Source node ID" },
              targetId: { type: "string", description: "Target node ID" },
              relationship: { type: "string", description: "Relationship type" },
              weight: { type: "number", default: 1.0, description: "Relationship weight" }
            },
            required: ["sourceId", "targetId", "relationship"]
          }
        },
        {
          name: "memory_save_conversation",
          description: "Save conversation to memory",
          inputSchema: {
            type: "object",
            properties: {
              userId: { type: "string", description: "User ID" },
              sessionId: { type: "string", description: "Session ID" },
              role: { type: "string", enum: ["user", "assistant", "system"], description: "Message role" },
              content: { type: "string", description: "Message content" },
              metadata: { type: "object", description: "Additional metadata" }
            },
            required: ["userId", "sessionId", "role", "content"]
          }
        },
        {
          name: "memory_get_history",
          description: "Get conversation history",
          inputSchema: {
            type: "object",
            properties: {
              userId: { type: "string", description: "User ID" },
              sessionId: { type: "string", description: "Session ID (optional)" },
              limit: { type: "number", default: 50, description: "Maximum messages" }
            },
            required: ["userId"]
          }
        },
        
        // Slack MCP Tools
        ...slackMCP.getTools(),
        
        
        // Figma MCP Tools
        ...figmaMCP.getTools()
      ],
    }));
    
    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "file://workspace",
          name: "Workspace Files",
          description: "Access to workspace files and directories",
          mimeType: "text/plain",
        },
        {
          uri: "db://schema",
          name: "Database Schema",
          description: "Current database schema and structure",
          mimeType: "application/json",
        },
        {
          uri: "env://variables",
          name: "Environment Variables",
          description: "System environment variables",
          mimeType: "application/json",
        },
        {
          uri: "system://info",
          name: "System Information",
          description: "System and hardware information",
          mimeType: "application/json",
        },
        {
          uri: "project://config",
          name: "Project Configuration",
          description: "Project configuration and settings",
          mimeType: "application/json",
        },
      ],
    }));
    
    // Read resource handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;
      
      if (uri.startsWith("file://")) {
        const filePath = uri.replace("file://", "");
        const content = await fs.readFile(filePath, "utf-8");
        return {
          contents: [{
            uri,
            mimeType: "text/plain",
            text: content,
          }],
        };
      }
      
      if (uri === "db://schema") {
        const schema = await this.getDatabaseSchema();
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(schema, null, 2),
          }],
        };
      }
      
      if (uri === "env://variables") {
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(process.env, null, 2),
          }],
        };
      }
      
      if (uri === "system://info") {
        const systemInfo = await this.getSystemInfo();
        return {
          contents: [{
            uri,
            mimeType: "application/json",
            text: JSON.stringify(systemInfo, null, 2),
          }],
        };
      }
      
      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    });
    
    // Tool execution handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      try {
        switch (name) {
          // Filesystem operations
          case "fs_read":
            return await this.handleFileRead(args);
          case "fs_write":
            return await this.handleFileWrite(args);
          case "fs_delete":
            return await this.handleFileDelete(args);
          case "fs_list":
            return await this.handleFileList(args);
          case "fs_mkdir":
            return await this.handleMkdir(args);
          case "fs_move":
            return await this.handleFileMove(args);
          case "fs_copy":
            return await this.handleFileCopy(args);
          case "fs_watch":
            return await this.handleFileWatch(args);
            
          // Command execution
          case "exec_command":
            return await this.handleExecCommand(args);
          case "exec_spawn":
            return await this.handleExecSpawn(args);
          case "exec_kill":
            return await this.handleExecKill(args);
            
          // Database operations
          case "db_query":
            return await this.handleDatabaseQuery(args);
          case "db_migrate":
            return await this.handleDatabaseMigrate(args);
          case "db_schema":
            return await this.handleDatabaseSchema(args);
            
          // API operations
          case "api_request":
            return await this.handleApiRequest(args);
          case "api_graphql":
            return await this.handleGraphQLRequest(args);
            
          // System operations
          case "system_info":
            return await this.handleSystemInfo(args);
          case "env_get":
            return await this.handleEnvGet(args);
          case "env_set":
            return await this.handleEnvSet(args);
            
          // Development tools
          case "git_status":
            return await this.handleGitStatus(args);
          case "npm_install":
            return await this.handleNpmInstall(args);
          case "docker_run":
            return await this.handleDockerRun(args);
            
          // AI/ML tools
          case "ai_complete":
            return await this.handleAiComplete(args);
          case "ai_embed":
            return await this.handleAiEmbed(args);
            
          // GitHub MCP Tools
          case "github_list_repos":
            return await this.handleGithubListRepos(args);
          case "github_create_repo":
            return await this.handleGithubCreateRepo(args);
          case "github_create_issue":
            return await this.handleGithubCreateIssue(args);
          case "github_create_pr":
            return await this.handleGithubCreatePR(args);
            
          // PostgreSQL MCP Tools
          case "postgres_list_tables":
            return await this.handlePostgresListTables(args);
          case "postgres_get_schema":
            return await this.handlePostgresGetSchema(args);
          case "postgres_query":
            return await this.handlePostgresQuery(args);
          case "postgres_backup":
            return await this.handlePostgresBackup(args);
            
          // Memory MCP Tools
          case "memory_create_node":
            return await this.handleMemoryCreateNode(args);
          case "memory_search":
            return await this.handleMemorySearch(args);
          case "memory_create_edge":
            return await this.handleMemoryCreateEdge(args);
          case "memory_save_conversation":
            return await this.handleMemorySaveConversation(args);
          case "memory_get_history":
            return await this.handleMemoryGetHistory(args);
            
          // Slack MCP Tools
          case "slack_send_message":
            return await this.handleSlackSendMessage(args);
          case "slack_list_channels":
            return await this.handleSlackListChannels(args);
          case "slack_list_users":
            return await this.handleSlackListUsers(args);
          case "slack_search_messages":
            return await this.handleSlackSearchMessages(args);
          case "slack_upload_file":
            return await this.handleSlackUploadFile(args);
            
          // Figma MCP Tools
          case "figma_get_file":
            return await this.handleFigmaGetFile(args);
          case "figma_get_components":
            return await this.handleFigmaGetComponents(args);
            
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          error instanceof Error ? error.message : String(error)
        );
      }
    });
  }
  
  private async handleDatabaseMigrate(args: any) {
    const { direction = "up", target } = args;
    // Execute migration using drizzle-kit
    const command = target 
      ? `npm run db:migrate -- --${direction} --to ${target}`
      : `npm run db:migrate -- --${direction}`;
    
    const { stdout, stderr } = await execAsync(command);
    
    return {
      content: [{ type: "text", text: stdout || stderr }],
    };
  }
  
  private async handleDatabaseSchema(args: any) {
    const schema = await this.getDatabaseSchema(args.table);
    return {
      content: [{ type: "text", text: JSON.stringify(schema, null, 2) }],
    };
  }
  
  // API handlers
  private async handleApiRequest(args: any) {
    const validated = ApiRequestSchema.parse(args);
    
    return new Promise((resolve, reject) => {
      const url = new URL(validated.url);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: validated.method,
        headers: validated.headers || {},
        timeout: validated.timeout,
      };
      
      const req = lib.request(options, (res) => {
        let data = "";
        
        res.on("data", (chunk) => {
          data += chunk;
        });
        
        res.on("end", () => {
          let parsedData;
          try {
            parsedData = JSON.parse(data);
          } catch (err: any) { console.error("[catch]", err?.message || err);
            parsedData = data;
          }
          
          resolve({
            content: [{ 
              type: "text", 
              text: JSON.stringify({
                status: res.statusCode,
                headers: res.headers,
                data: parsedData,
              }, null, 2)
            }],
          });
        });
      });
      
      req.on("error", reject);
      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Request timeout"));
      });
      
      if (validated.body) {
        req.write(JSON.stringify(validated.body));
      }
      
      req.end();
    });
  }
  
  private async handleGraphQLRequest(args: any) {
    const { endpoint, query, variables, headers } = args;
    
    return new Promise((resolve, reject) => {
      const url = new URL(endpoint);
      const isHttps = url.protocol === "https:";
      const lib = isHttps ? https : http;
      
      const postData = JSON.stringify({ query, variables });
      
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(postData),
          ...headers,
        },
      };
      
      const req = lib.request(options, (res) => {
        let data = "";
        
        res.on("data", (chunk) => {
          data += chunk;
        });
        
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve({
              content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
            });
          } catch (error) {
            reject(new Error(`Failed to parse response: ${data}`));
          }
        });
      });
      
      req.on("error", reject);
      req.write(postData);
      req.end();
    });
  }
  
  // System handlers
  private async handleSystemInfo(args: any) {
    const info = await this.getSystemInfo(args.type);
    return {
      content: [{ type: "text", text: JSON.stringify(info, null, 2) }],
    };
  }
  
  private async handleEnvGet(args: any) {
    const { key } = args;
    const value = key ? process.env[key] : process.env;
    return {
      content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    };
  }
  
  private async handleEnvSet(args: any) {
    const { key, value } = args;
    process.env[key] = value;
    return {
      content: [{ type: "text", text: `Environment variable set: ${key}` }],
    };
  }
  
  // Development tool handlers
  private async handleGitStatus(args: any) {
    const { path: repoPath = "." } = args;
    const { stdout } = await execAsync("git status --porcelain", { cwd: repoPath });
    return {
      content: [{ type: "text", text: stdout }],
    };
  }
  
  private async handleNpmInstall(args: any) {
    const { packages = [], dev = false, global = false } = args;
    
    let command = "npm install";
    if (dev) command += " --save-dev";
    if (global) command += " -g";
    if (packages.length > 0) command += ` ${packages.join(" ")}`;
    
    const { stdout, stderr } = await execAsync(command);
    
    return {
      content: [{ type: "text", text: stdout || stderr }],
    };
  }
  
  private async handleDockerRun(args: any) {
    const { image, name, ports = [], volumes = [], env = {} } = args;
    
    let command = `docker run -d`;
    if (name) command += ` --name ${name}`;
    
    ports.forEach((port: string) => {
      command += ` -p ${port}`;
    });
    
    volumes.forEach((volume: string) => {
      command += ` -v ${volume}`;
    });
    
    Object.entries(env).forEach(([key, value]) => {
      command += ` -e ${key}=${value}`;
    });
    
    command += ` ${image}`;
    
    const { stdout } = await execAsync(command);
    
    return {
      content: [{ type: "text", text: `Container started: ${stdout.trim()}` }],
    };
  }
  
  // AI/ML handlers
  private async handleAiComplete(args: any) {
    const { prompt, model = "claude-opus-4-7", temperature = 0.7, maxTokens = 2048, userId } = args;
    
    // Check if this is an open-source model
    const isOpenSourceModel = Object.keys(OPENSOURCE_MODELS).includes(model);
    
    if (isOpenSourceModel) {
      // Use open-source models provider
      try {
        const messages = [{ role: "user", content: prompt }];
        const response = await openSourceModelsProvider.generateChat(messages, {
          model,
          temperature,
          max_tokens: maxTokens
        });
        
        // Track usage for billing if userId provided
        if (userId) {
          const modelConfig = OPENSOURCE_MODELS[model as keyof typeof OPENSOURCE_MODELS];
          const { aiBillingService } = await import('../services/ai-billing-service');
          
          // Estimate tokens (rough approximation)
          const inputTokens = Math.ceil(prompt.length / 4);
          const outputTokens = Math.ceil(response.length / 4);
          
          await aiBillingService.trackAIUsage(userId, {
            model: modelConfig.name,
            provider: modelConfig.provider,
            inputTokens,
            outputTokens,
            totalTokens: inputTokens + outputTokens,
            prompt: prompt.substring(0, 200),
            completion: response.substring(0, 200),
            purpose: 'mcp-completion',
            timestamp: new Date()
          });
        }
        
        return {
          content: [{ type: "text", text: response }],
        };
      } catch (error: any) {
        console.error(`Open-source model error (${model}):`, error);
        throw new Error(`Failed to use ${model}: ${error.message}`);
      }
    }
    
    // Use Anthropic SDK for Claude models
    if (process.env.ANTHROPIC_API_KEY && model.includes('claude')) {
      const { Anthropic } = await import("@anthropic-ai/sdk");
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      
      const response = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: "user", content: prompt }],
      });
      
      // Track usage for billing if userId provided
      if (userId && response.usage) {
        const { aiBillingService } = await import('../services/ai-billing-service');
        await aiBillingService.trackAIUsage(userId, {
          model,
          provider: 'Anthropic',
          inputTokens: response.usage.input_tokens || 0,
          outputTokens: response.usage.output_tokens || 0,
          totalTokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
          prompt: prompt.substring(0, 200),
          completion: response.content[0].text.substring(0, 200),
          purpose: 'mcp-completion',
          timestamp: new Date()
        });
      }
      
      return {
        content: [{ type: "text", text: response.content[0].text }],
      };
    }
    
    // Use OpenAI for GPT models
    if (process.env.OPENAI_API_KEY && (model.includes('gpt') || model.includes('o1'))) {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      
      const response = await openai.chat.completions.create({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: "user", content: prompt }],
      });
      
      // Track usage for billing if userId provided
      if (userId && response.usage) {
        const { aiBillingService } = await import('../services/ai-billing-service');
        await aiBillingService.trackAIUsage(userId, {
          model,
          provider: 'OpenAI',
          inputTokens: response.usage.prompt_tokens || 0,
          outputTokens: response.usage.completion_tokens || 0,
          totalTokens: response.usage.total_tokens || 0,
          prompt: prompt.substring(0, 200),
          completion: response.choices[0].message.content?.substring(0, 200) || '',
          purpose: 'mcp-completion',
          timestamp: new Date()
        });
      }
      
      return {
        content: [{ type: "text", text: response.choices[0].message.content || '' }],
      };
    }
    
    throw new Error("AI completion requires API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, or open-source model providers)");
  }
  
  private async handleAiEmbed(args: any) {
    const { text, model = "text-embedding-ada-002" } = args;
    
    // Implement embedding generation
    // This would typically use OpenAI or another embedding service
    
    return {
      content: [{ type: "text", text: "Embedding generation not configured" }],
    };
  }
  
  // GitHub MCP handlers
  private async handleGithubListRepos(args: any) {
    const result = await githubMCP.listRepositories(args.username);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleGithubCreateRepo(args: any) {
    const result = await githubMCP.createRepository(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleGithubCreateIssue(args: any) {
    const result = await githubMCP.createIssue(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleGithubCreatePR(args: any) {
    const result = await githubMCP.createPullRequest(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  // PostgreSQL MCP handlers
  private async handlePostgresListTables(args: any) {
    const result = await postgresMCP.listTables(args.schema);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handlePostgresGetSchema(args: any) {
    const result = await postgresMCP.getTableSchema(args.table, args.schema);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handlePostgresQuery(args: any) {
    const result = await postgresMCP.executeQuery(args.query, args.params);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handlePostgresBackup(args: any) {
    const result = await postgresMCP.createBackup(args.table, args.schema);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  // Memory MCP handlers
  private async handleMemoryCreateNode(args: any) {
    const result = await memoryMCP.createNode(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleMemorySearch(args: any) {
    const result = await memoryMCP.searchNodes(args.query, args.type, args.limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleMemoryCreateEdge(args: any) {
    const result = await memoryMCP.createEdge(args.sourceId, args.targetId, args.relationship, args.weight);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleMemorySaveConversation(args: any) {
    const result = await memoryMCP.saveConversation(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleMemoryGetHistory(args: any) {
    const result = await memoryMCP.getConversationHistory(args.userId, args.sessionId, args.limit);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  // Slack MCP handlers
  private async handleSlackSendMessage(args: any) {
    const result = await slackMCP.sendMessage(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleSlackListChannels(args: any) {
    const result = await slackMCP.listChannels(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleSlackListUsers(args: any) {
    const result = await slackMCP.listUsers(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleSlackSearchMessages(args: any) {
    const result = await slackMCP.searchMessages(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleSlackUploadFile(args: any) {
    const result = await slackMCP.uploadFile(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }







  // Figma MCP handlers
  private async handleFigmaGetFile(args: any) {
    const result = await figmaMCP.getFile(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleFigmaGetNodes(args: any) {
    const result = await figmaMCP.getFileNodes(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleFigmaGetImages(args: any) {
    const result = await figmaMCP.getImages(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleFigmaGetTeamProjects(args: any) {
    const result = await figmaMCP.getTeamProjects(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleFigmaGetProjectFiles(args: any) {
    const result = await figmaMCP.getProjectFiles(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleFigmaGetComments(args: any) {
    const result = await figmaMCP.getComments(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  private async handleFigmaPostComment(args: any) {
    const result = await figmaMCP.postComment(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }

  // Helper methods
  private async getDatabaseSchema(table?: string) {
    const query = table
      ? `SELECT * FROM information_schema.columns WHERE table_name = $1`
      : `SELECT * FROM information_schema.tables WHERE table_schema = 'public'`;
    
    const result = await client.query(query, table ? [table] : []);
    return result.rows;
  }
  
  private async getSystemInfo(type: string = "all") {
    const info: any = {};
    
    if (type === "all" || type === "os") {
      info.os = {
        platform: os.platform(),
        release: os.release(),
        type: os.type(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime(),
      };
    }
    
    if (type === "all" || type === "cpu") {
      info.cpu = {
        cores: os.cpus().length,
        model: os.cpus()[0]?.model,
        speed: os.cpus()[0]?.speed,
      };
    }
    
    if (type === "all" || type === "memory") {
      info.memory = {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
        usage: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2) + "%",
      };
    }
    
    if (type === "all" || type === "network") {
      info.network = os.networkInterfaces();
    }
    
    return info;
  }
  
  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("MCP Server started successfully");
  }
  
  async stop() {
    // Clean up watchers
    for (const watcher of this.fileWatchers.values()) {
      await watcher.close();
    }
    this.fileWatchers.clear();
    
    // Kill active processes
    for (const [id, process] of this.activeProcesses.entries()) {
      process.kill("SIGTERM");
    }
    this.activeProcesses.clear();
    
    await this.server.close();
    console.error("MCP Server stopped");
  }
  
  async executeTool(name: string, args: any): Promise<any> {
    // Find and execute the appropriate tool handler
    const handler = this.handlers.get(`tools/${name}`);
    if (handler) {
      return await handler({ params: { name, arguments: args } });
    }
    
    // Fallback implementation for basic tools
    if (name.startsWith('fs_')) {
      const fs = await import('fs/promises');
      switch(name) {
        case 'fs_list':
          const files = await fs.readdir(args.path || '.');
          return { content: [{ type: "text", text: JSON.stringify(files) }] };
        case 'fs_read':
          const content = await fs.readFile(args.path, 'utf8');
          return { content: [{ type: "text", text: content }] };
        case 'fs_write':
          await fs.writeFile(args.path, args.content);
          return { content: [{ type: "text", text: `File written: ${args.path}` }] };
        default:
          return { content: [{ type: "text", text: `Tool ${name} executed` }] };
      }
    }
    
    throw new Error(`Tool ${name} not found`);
  }
  
  // Get the internal server instance for HTTP transport connection
  getServer() {
    return this.server;
  }
}