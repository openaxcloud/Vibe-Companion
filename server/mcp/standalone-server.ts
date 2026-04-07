/**
 * Standalone MCP Server that runs on port 3200
 * This provides the actual MCP functionality for AI operations
 */

import express from 'express';
import cors from 'cors';
import * as fs from 'fs/promises';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { db } from '../db';
import fetch from 'node-fetch';
import { validateAndSetSSEHeaders } from '../utils/sse-headers';

const execAsync = promisify(exec);
const app = express();
const PORT = Number(process.env.MCP_SERVER_PORT || 3200);

interface MCPSession {
  id: string;
  createdAt: Date;
  lastActivity: Date;
}

const sessions = new Map<string, MCPSession>();
const eventStreams = new Map<string, Set<{ res: any; heartbeat: NodeJS.Timeout }>>();

// Enable CORS for all origins
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Logging middleware
app.use((req, res, next) => {
  next();
});

const TOOL_DEFINITIONS: Record<string, {
  description: string;
  category: string;
  inputSchema: any;
  handler: (args: any) => Promise<any>;
}> = {
  fs_read: {
    description: 'Read file contents',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to read' },
        encoding: { type: 'string', enum: ['utf8', 'base64', 'hex'], default: 'utf8' }
      },
      required: ['path']
    },
    handler: async (args) => {
      const encoding = args.encoding || 'utf8';
      const content = await fs.readFile(args.path, encoding);
      return { content: [{ type: 'text', text: content }] };
    }
  },
  fs_write: {
    description: 'Write file contents',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path to write' },
        content: { type: 'string', description: 'Content to write' },
        encoding: { type: 'string', enum: ['utf8', 'base64', 'hex'], default: 'utf8' }
      },
      required: ['path', 'content']
    },
    handler: async (args) => {
      const encoding = args.encoding || 'utf8';
      await fs.writeFile(args.path, args.content ?? '', encoding);
      return { content: [{ type: 'text', text: `File written: ${args.path}` }] };
    }
  },
  fs_delete: {
    description: 'Delete file or directory',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
        recursive: { type: 'boolean', default: false }
      },
      required: ['path']
    },
    handler: async (args) => {
      await fs.rm(args.path, { recursive: !!args.recursive, force: true });
      return { content: [{ type: 'text', text: `Deleted: ${args.path}` }] };
    }
  },
  fs_list: {
    description: 'List directory contents',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path', default: '.' },
        pattern: { type: 'string', description: 'Glob pattern for filtering' },
        recursive: { type: 'boolean', default: false }
      }
    },
    handler: async (args) => {
      const targetPath = args.path || '.';
      const entries = await fs.readdir(targetPath);
      return { content: [{ type: 'text', text: JSON.stringify(entries) }] };
    }
  },
  fs_mkdir: {
    description: 'Create directory',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to create' },
        recursive: { type: 'boolean', default: true }
      },
      required: ['path']
    },
    handler: async (args) => {
      await fs.mkdir(args.path, { recursive: args.recursive !== false });
      return { content: [{ type: 'text', text: `Directory created: ${args.path}` }] };
    }
  },
  fs_move: {
    description: 'Move file or directory',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' }
      },
      required: ['source', 'destination']
    },
    handler: async (args) => {
      await fs.rename(args.source, args.destination);
      return { content: [{ type: 'text', text: `Moved ${args.source} to ${args.destination}` }] };
    }
  },
  fs_copy: {
    description: 'Copy file or directory',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' }
      },
      required: ['source', 'destination']
    },
    handler: async (args) => {
      const content = await fs.readFile(args.source);
      await fs.writeFile(args.destination, content);
      return { content: [{ type: 'text', text: `Copied ${args.source} to ${args.destination}` }] };
    }
  },
  fs_search: {
    description: 'Search for files',
    category: 'filesystem',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path', default: '.' },
        pattern: { type: 'string', description: 'Glob pattern', default: '*' }
      }
    },
    handler: async (args) => {
      const searchDir = args.path || '.';
      const searchPattern = args.pattern || '*';
      const { stdout } = await execAsync(`find ${searchDir} -name "${searchPattern}" -type f`);
      const foundFiles = stdout.split('\n').filter(Boolean);
      return { content: [{ type: 'text', text: JSON.stringify(foundFiles) }] };
    }
  },
  exec_command: {
    description: 'Execute shell command',
    category: 'execution',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        cwd: { type: 'string', description: 'Working directory' },
        timeout: { type: 'number', description: 'Timeout in ms', default: 30000 }
      },
      required: ['command']
    },
    handler: async (args) => {
      const { stdout: cmdOut, stderr: cmdErr } = await execAsync(args.command, {
        cwd: args.cwd || process.cwd(),
        timeout: args.timeout || 30000
      });
      return {
        content: [{
          type: 'text',
          text: cmdOut || cmdErr || 'Command executed successfully'
        }]
      };
    }
  },
  exec_spawn: {
    description: 'Spawn new process',
    category: 'execution',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to execute' },
        args: { type: 'array', items: { type: 'string' }, description: 'Arguments' },
        cwd: { type: 'string', description: 'Working directory' }
      },
      required: ['command']
    },
    handler: async (args) => {
      const child = spawn(args.command, args.args || [], {
        cwd: args.cwd || process.cwd(),
        detached: true
      });
      child.unref();
      return {
        content: [{
          type: 'text',
          text: `Process spawned with PID: ${child.pid}`,
          data: { pid: child.pid }
        }]
      };
    }
  },
  process_kill: {
    description: 'Kill process by PID',
    category: 'execution',
    inputSchema: {
      type: 'object',
      properties: {
        pid: { type: 'number', description: 'Process ID to terminate' }
      },
      required: ['pid']
    },
    handler: async (args) => {
      process.kill(args.pid);
      return { content: [{ type: 'text', text: `Process ${args.pid} killed` }] };
    }
  },
  db_query: {
    description: 'Execute database query',
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'SQL query to execute' },
        params: { type: 'array', items: { type: 'any' }, description: 'Query parameters' }
      },
      required: ['query']
    },
    handler: async (args) => {
      try {
        const dbResult = await db.execute(args.query);
        return { content: [{ type: 'text', text: JSON.stringify(dbResult) }] };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Database error: ${error.message}` }],
          isError: true
        };
      }
    }
  },
  db_schema: {
    description: 'Get database schema',
    category: 'database',
    inputSchema: {
      type: 'object',
      properties: {}
    },
    handler: async () => {
      const schema = await db.execute(`
        SELECT table_name, column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        ORDER BY table_name, ordinal_position
      `);
      return { content: [{ type: 'text', text: JSON.stringify(schema) }] };
    }
  },
  npm_install: {
    description: 'Install npm package',
    category: 'package',
    inputSchema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Package name to install' },
        cwd: { type: 'string', description: 'Working directory' }
      },
      required: ['package']
    },
    handler: async (args) => {
      const { stdout: npmOut } = await execAsync(`npm install ${args.package}`, {
        cwd: args.cwd || process.cwd()
      });
      return { content: [{ type: 'text', text: npmOut }] };
    }
  },
  npm_uninstall: {
    description: 'Uninstall npm package',
    category: 'package',
    inputSchema: {
      type: 'object',
      properties: {
        package: { type: 'string', description: 'Package name to remove' },
        cwd: { type: 'string', description: 'Working directory' }
      },
      required: ['package']
    },
    handler: async (args) => {
      const { stdout: npmUnOut } = await execAsync(`npm uninstall ${args.package}`, {
        cwd: args.cwd || process.cwd()
      });
      return { content: [{ type: 'text', text: npmUnOut }] };
    }
  },
  npm_list: {
    description: 'List installed packages',
    category: 'package',
    inputSchema: {
      type: 'object',
      properties: {
        cwd: { type: 'string', description: 'Working directory' }
      }
    },
    handler: async (args) => {
      const { stdout: npmListOut } = await execAsync('npm list --depth=0', {
        cwd: args.cwd || process.cwd()
      });
      return { content: [{ type: 'text', text: npmListOut }] };
    }
  },
  ai_complete: {
    description: 'Get AI completion',
    category: 'ai',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Prompt for the model' },
        messages: { type: 'array', description: 'Chat messages' },
        model: { type: 'string', description: 'Model to use', default: 'gpt-4.1' },
        temperature: { type: 'number', description: 'Sampling temperature', default: 0.7 }
      }
    },
    handler: async (args) => {
      if (!process.env.OPENAI_API_KEY) {
        return {
          content: [{ type: 'text', text: 'AI service not configured' }],
          isError: true
        };
      }

      const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: args.model || 'gpt-4.1',
          messages: args.messages || [{ role: 'user', content: args.prompt }],
          temperature: args.temperature ?? 0.7,
        }),
      });
      const aiData: any = await aiResponse.json();
      return {
        content: [{
          type: 'text',
          text: aiData.choices?.[0]?.message?.content || 'No response'
        }]
      };
    }
  },
  api_request: {
    description: 'Make HTTP request',
    category: 'network',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to request' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], default: 'GET' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'any', description: 'Request body' }
      },
      required: ['url']
    },
    handler: async (args) => {
      const response = await fetch(args.url, {
        method: args.method || 'GET',
        headers: args.headers || {},
        body: args.body ? JSON.stringify(args.body) : undefined,
      });
      const text = await response.text();
      return { content: [{ type: 'text', text }] };
    }
  }
};

function listToolsMetadata() {
  return Object.entries(TOOL_DEFINITIONS).map(([name, def]) => ({
    name,
    description: def.description,
    category: def.category,
    inputSchema: def.inputSchema,
  }));
}

async function executeTool(toolName: string, args: any) {
  const tool = TOOL_DEFINITIONS[toolName];
  if (!tool) {
    throw new Error(`Tool not found: ${toolName}`);
  }

  return tool.handler(args || {});
}

function createSession(requestedId?: string) {
  const sessionId = requestedId || crypto.randomUUID();
  const session: MCPSession = {
    id: sessionId,
    createdAt: new Date(),
    lastActivity: new Date(),
  };
  sessions.set(sessionId, session);
  return session;
}

function removeSession(sessionId: string) {
  sessions.delete(sessionId);

  const clients = eventStreams.get(sessionId);
  if (clients) {
    for (const client of clients) {
      clearInterval(client.heartbeat);
      try {
        client.res.end();
      } catch (error) {
        console.error('[MCP-3200] Failed to close SSE client:', error);
      }
    }
    eventStreams.delete(sessionId);
  }
}

function getSessionIdFromQuery(query: any): string | undefined {
  if (!query) return undefined;

  const raw = query.sessionId ?? query.session_id;
  if (Array.isArray(raw)) {
    return raw[0];
  }

  if (raw === undefined || raw === null) {
    return undefined;
  }

  return String(raw);
}

function getSessionFromRequest(req: any) {
  const headerSessionId = req.headers['x-session-id'];
  const sessionId =
    (Array.isArray(headerSessionId) ? headerSessionId[0] : (headerSessionId as string)) ||
    req.body?.sessionId ||
    getSessionIdFromQuery(req.query);
  if (!sessionId || !sessions.has(sessionId)) {
    return null;
  }
  const session = sessions.get(sessionId)!;
  session.lastActivity = new Date();
  return session;
}

function sendEvent(sessionId: string, data: any) {
  const clients = eventStreams.get(sessionId);
  if (!clients) return;

  for (const client of clients) {
    try {
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch (error) {
      clearInterval(client.heartbeat);
      clients.delete(client);
      try {
        client.res.end();
      } catch (err) {
        console.error('[MCP-3200] Failed to close SSE stream:', err);
      }
    }
  }

  if (clients.size === 0) {
    eventStreams.delete(sessionId);
  }
}

setInterval(() => {
  const cutoff = Date.now() - 1000 * 60 * 30; // 30 minutes
  for (const [sessionId, session] of sessions) {
    if (session.lastActivity.getTime() < cutoff) {
      removeSession(sessionId);
    }
  }
}, 60_000);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'MCP Server', port: PORT });
});

// List available tools
app.get('/tools', (req, res) => {
  res.json(listToolsMetadata());
});

// Execute tool
app.post('/tools/:toolName', async (req, res) => {
  const { toolName } = req.params;
  const args = req.body;

  try {
    const result = await executeTool(toolName, args);
    res.json(result);
  } catch (error: any) {
    console.error(`[MCP-3200] Error executing tool ${toolName}:`, error);
    res.status(error.message?.includes('not found') ? 404 : 500).json({
      error: error.message,
      content: [{ type: 'text', text: error.message }],
      isError: true
    });
  }
});

// MCP JSON-RPC endpoints
app.post('/connect', (req, res) => {
  const requestedId = req.body?.sessionId as string | undefined;
  const session = createSession(requestedId);

  res.json({
    sessionId: session.id,
    status: 'connected',
    capabilities: {
      tools: true,
      resources: true,
      prompts: true,
    }
  });
});

app.post('/message', async (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({
      error: 'Invalid session',
      jsonrpc: '2.0'
    });
  }

  const message = req.body || {};
  const id = message.id ?? null;

  try {
    if (message.method === 'tools/list' || message.method === 'list_tools') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: {
          tools: listToolsMetadata().map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        }
      });
    }

    if (message.method === 'resources/list' || message.method === 'list_resources') {
      return res.json({
        jsonrpc: '2.0',
        id,
        result: { resources: [] }
      });
    }

    if (message.method === 'tools/call' || message.method === 'call_tool') {
      const params = message.params || {};
      const toolName = params.name || params.toolName || params.tool?.name;
      const toolArgs = params.arguments || params.args || {};

      if (!toolName) {
        return res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32602,
            message: 'Tool name is required'
          }
        });
      }

      try {
        const result = await executeTool(toolName, toolArgs);
        sendEvent(session.id, {
          type: 'tool_result',
          tool: toolName,
          timestamp: new Date().toISOString()
        });
        return res.json({ jsonrpc: '2.0', id, result });
      } catch (error: any) {
        sendEvent(session.id, {
          type: 'tool_error',
          tool: toolName,
          error: error.message || 'Tool execution failed',
          timestamp: new Date().toISOString()
        });
        return res.json({
          jsonrpc: '2.0',
          id,
          error: {
            code: -32000,
            message: error.message || 'Tool execution failed'
          }
        });
      }
    }

    return res.json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32601,
        message: `Unsupported method: ${message.method}`
      }
    });
  } catch (error: any) {
    console.error('[MCP-3200] Error processing MCP message:', error);
    return res.status(500).json({
      jsonrpc: '2.0',
      id,
      error: {
        code: -32000,
        message: error.message || 'Request failed'
      }
    });
  }
});

app.get('/events', (req, res) => {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Invalid session' });
  }

  // Set SSE headers with CORS security - reject invalid origins with 403
  if (!validateAndSetSSEHeaders(res, req)) {
    return;
  }

  const heartbeat = setInterval(() => {
    try {
      res.write('data: {"type":"heartbeat"}\n\n');
    } catch (error) {
      clearInterval(heartbeat);
    }
  }, 15000);

  const client = { res, heartbeat };

  if (!eventStreams.has(session.id)) {
    eventStreams.set(session.id, new Set());
  }
  eventStreams.get(session.id)!.add(client);

  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId: session.id })}\n\n`);

  req.on('close', () => {
    clearInterval(client.heartbeat);
    const clients = eventStreams.get(session.id);
    if (clients) {
      clients.delete(client);
      if (clients.size === 0) {
        eventStreams.delete(session.id);
      }
    }
  });
});

app.post('/disconnect', (req, res) => {
  const session = getSessionFromRequest(req);
  if (session) {
    removeSession(session.id);
  }
  res.json({ status: 'disconnected' });
});

// Start server
export function startMCPStandaloneServer() {
  app.listen(PORT, '0.0.0.0', () => {
    // MCP Server started
  });
}