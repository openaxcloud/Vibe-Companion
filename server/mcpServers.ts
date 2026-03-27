import { storage } from "./storage";
import type { McpServer, InsertMcpServer } from "@shared/schema";

export interface BuiltInServerDef {
  name: string;
  description: string;
  command: string;
  args: string[];
  tools: {
    name: string;
    description: string;
    inputSchema: Record<string, any>;
  }[];
}

export const BUILT_IN_SERVERS: BuiltInServerDef[] = [
  {
    name: "file-search",
    description: "Search and find content across project files",
    command: "node",
    args: ["-e", getFileSearchServerCode()],
    tools: [
      {
        name: "grep_files",
        description: "Search for a pattern across all project files. Returns matching lines with file names and line numbers.",
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "The search pattern (supports regex)" },
            filePattern: { type: "string", description: "Optional glob pattern to filter files (e.g. '*.ts')" },
          },
          required: ["pattern"],
        },
      },
      {
        name: "find_files",
        description: "Find files by name pattern in the project",
        inputSchema: {
          type: "object",
          properties: {
            pattern: { type: "string", description: "File name pattern to search for (supports glob)" },
          },
          required: ["pattern"],
        },
      },
    ],
  },
  {
    name: "web-fetch",
    description: "Fetch content from URLs on the web",
    command: "node",
    args: ["-e", getWebFetchServerCode()],
    tools: [
      {
        name: "fetch_url",
        description: "Fetch the content of a URL and return it as text",
        inputSchema: {
          type: "object",
          properties: {
            url: { type: "string", description: "The URL to fetch" },
            maxLength: { type: "number", description: "Maximum response length in characters (default 10000)" },
          },
          required: ["url"],
        },
      },
    ],
  },
  {
    name: "database-query",
    description: "Run read-only SQL queries against the project database",
    command: "node",
    args: ["-e", getDatabaseQueryServerCode()],
    tools: [
      {
        name: "query_database",
        description: "Execute a read-only SQL query against the PostgreSQL database. Only SELECT statements are allowed.",
        inputSchema: {
          type: "object",
          properties: {
            sql: { type: "string", description: "The SQL SELECT query to execute" },
          },
          required: ["sql"],
        },
      },
    ],
  },
];

function getMcpFramingCode(): string {
  return `
let _buf = Buffer.alloc(0);
const _SEP = Buffer.from('\\r\\n\\r\\n');
process.stdin.on('data', (chunk) => {
  _buf = Buffer.concat([_buf, chunk]);
  while (true) {
    const sepIdx = _buf.indexOf(_SEP);
    if (sepIdx === -1) break;
    const hdr = _buf.slice(0, sepIdx).toString('utf8');
    const m = hdr.match(/Content-Length:\\s*(\\d+)/i);
    if (!m) { _buf = _buf.slice(sepIdx + 4); continue; }
    const cl = parseInt(m[1], 10);
    const bodyStart = sepIdx + 4;
    if (_buf.length - bodyStart < cl) break;
    const body = _buf.slice(bodyStart, bodyStart + cl).toString('utf8');
    _buf = _buf.slice(bodyStart + cl);
    try { handleMsg(JSON.parse(body)); } catch(e) {}
  }
});

function send(obj) {
  const b = Buffer.from(JSON.stringify(obj), 'utf8');
  process.stdout.write('Content-Length: ' + b.length + '\\r\\n\\r\\n');
  process.stdout.write(b);
}
function respond(id, result) { send({ jsonrpc: "2.0", id, result }); }
function respondError(id, code, message) { send({ jsonrpc: "2.0", id, error: { code, message } }); }
`;
}

function getFileSearchServerCode(): string {
  return getMcpFramingCode() + `
function handleMsg(msg) {
    if (msg.method === 'initialize') {
      respond(msg.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "file-search", version: "1.0.0" } });
    } else if (msg.method === 'notifications/initialized') {
      // no response needed
    } else if (msg.method === 'tools/list') {
      respond(msg.id, { tools: [
        { name: "grep_files", description: "Search for a pattern across project files", inputSchema: { type: "object", properties: { pattern: { type: "string" }, filePattern: { type: "string" } }, required: ["pattern"] } },
        { name: "find_files", description: "Find files by name pattern", inputSchema: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] } },
      ]});
    } else if (msg.method === 'tools/call') {
      const { name, arguments: args } = msg.params;
      if (name === 'grep_files') {
        const { spawnSync } = require('child_process');
        try {
          const grepArgs = ['-rn', '--color=never'];
          if (args.filePattern) grepArgs.push('--include=' + args.filePattern);
          grepArgs.push(args.pattern, '.');
          const proc = spawnSync('grep', grepArgs, { encoding: 'utf8', timeout: 10000, cwd: process.cwd(), maxBuffer: 1024 * 64 });
          const output = (proc.stdout || '').split('\\n').slice(0, 50).join('\\n');
          respond(msg.id, { content: [{ type: "text", text: output || "No matches found" }] });
        } catch(e) { respond(msg.id, { content: [{ type: "text", text: "No matches found" }] }); }
      } else if (name === 'find_files') {
        const { spawnSync } = require('child_process');
        try {
          const proc = spawnSync('find', ['.', '-name', args.pattern, '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*'], { encoding: 'utf8', timeout: 10000, maxBuffer: 1024 * 64 });
          const output = (proc.stdout || '').split('\\n').slice(0, 50).join('\\n');
          respond(msg.id, { content: [{ type: "text", text: output || "No files found" }] });
        } catch(e) { respond(msg.id, { content: [{ type: "text", text: "No files found" }] }); }
      } else {
        respondError(msg.id, -32601, "Unknown tool: " + name);
      }
    } else if (msg.id !== undefined) {
      respondError(msg.id, -32601, "Method not found");
    }
}
`;
}

function getWebFetchServerCode(): string {
  return getMcpFramingCode() + `
async function handleMsg(msg) {
    if (msg.method === 'initialize') {
      respond(msg.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "web-fetch", version: "1.0.0" } });
    } else if (msg.method === 'notifications/initialized') {
      // no response needed
    } else if (msg.method === 'tools/list') {
      respond(msg.id, { tools: [
        { name: "fetch_url", description: "Fetch content from a URL", inputSchema: { type: "object", properties: { url: { type: "string" }, maxLength: { type: "number" } }, required: ["url"] } },
      ]});
    } else if (msg.method === 'tools/call') {
      const { name, arguments: args } = msg.params;
      if (name === 'fetch_url') {
        try {
          const parsedUrl = new URL(args.url);
          if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            respond(msg.id, { content: [{ type: "text", text: "Only http and https URLs are allowed" }], isError: true });
            return;
          }
          const host = parsedUrl.hostname.toLowerCase();
          const blocked = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]', 'metadata.google.internal', '169.254.169.254'];
          if (blocked.includes(host) || host.endsWith('.local') || host.startsWith('10.') || host.startsWith('192.168.') || /^172\\.(1[6-9]|2[0-9]|3[01])\\./.test(host)) {
            respond(msg.id, { content: [{ type: "text", text: "Cannot fetch internal/private URLs" }], isError: true });
            return;
          }
          const maxLen = args.maxLength || 10000;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const res = await fetch(args.url, { signal: controller.signal, headers: { 'User-Agent': 'E-Code-MCP/1.0' }, redirect: 'manual' });
          clearTimeout(timeout);
          let text = await res.text();
          if (text.length > maxLen) text = text.slice(0, maxLen) + "\\n... [truncated]";
          respond(msg.id, { content: [{ type: "text", text: text }] });
        } catch(e) { respond(msg.id, { content: [{ type: "text", text: "Error fetching URL: " + e.message }], isError: true }); }
      } else {
        respondError(msg.id, -32601, "Unknown tool: " + name);
      }
    } else if (msg.id !== undefined) {
      respondError(msg.id, -32601, "Method not found");
    }
}
`;
}

function getDatabaseQueryServerCode(): string {
  return getMcpFramingCode() + `
let pool = null;
try {
  const pg = require('pg');
  const dbUrl = process.env.MCP_DATABASE_URL || process.env.PROJECT_DATABASE_URL;
  if (dbUrl) {
    pool = new pg.Pool({ connectionString: dbUrl, max: 2 });
  }
} catch(e) { /* pg not available */ }

async function handleMsg(msg) {
    if (msg.method === 'initialize') {
      respond(msg.id, { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: "database-query", version: "1.0.0" } });
    } else if (msg.method === 'notifications/initialized') {
      // no response needed
    } else if (msg.method === 'tools/list') {
      respond(msg.id, { tools: [
        { name: "query_database", description: "Execute a read-only SQL query", inputSchema: { type: "object", properties: { sql: { type: "string" } }, required: ["sql"] } },
      ]});
    } else if (msg.method === 'tools/call') {
      const { name, arguments: args } = msg.params;
      if (name === 'query_database') {
        if (!pool) {
          respond(msg.id, { content: [{ type: "text", text: "Database not available (no DATABASE_URL configured)" }], isError: true });
          return;
        }
        const sql = (args.sql || '').trim();
        if (!sql.toLowerCase().startsWith('select') && !sql.toLowerCase().startsWith('with') && !sql.toLowerCase().startsWith('explain')) {
          respond(msg.id, { content: [{ type: "text", text: "Only SELECT, WITH, and EXPLAIN queries are allowed" }], isError: true });
          return;
        }
        const semicolonCount = (sql.match(/;/g) || []).length;
        if (semicolonCount > 1 || (semicolonCount === 1 && !sql.trimEnd().endsWith(';'))) {
          respond(msg.id, { content: [{ type: "text", text: "Multiple SQL statements are not allowed" }], isError: true });
          return;
        }
        const lower = sql.toLowerCase();
        const forbidden = ['insert ', 'update ', 'delete ', 'drop ', 'alter ', 'create ', 'truncate ', 'grant ', 'revoke ', 'exec ', 'execute ', 'call ', 'set ', 'copy ', 'pg_', 'lo_'];
        if (forbidden.some(kw => lower.includes(kw))) {
          respond(msg.id, { content: [{ type: "text", text: "Query contains forbidden keywords. Only pure read queries are allowed." }], isError: true });
          return;
        }
        try {
          const client = await pool.connect();
          try {
            await client.query('BEGIN TRANSACTION READ ONLY');
            const result = await client.query(sql);
            await client.query('ROLLBACK');
            const rows = result.rows.slice(0, 100);
            respond(msg.id, { content: [{ type: "text", text: JSON.stringify(rows, null, 2) }] });
          } finally { 
            try { await client.query('ROLLBACK'); } catch(e2) {}
            client.release(); 
          }
        } catch(e) { respond(msg.id, { content: [{ type: "text", text: "Query error: " + e.message }], isError: true }); }
      } else {
        respondError(msg.id, -32601, "Unknown tool: " + name);
      }
    } else if (msg.id !== undefined) {
      respondError(msg.id, -32601, "Method not found");
    }
}
`;
}

export async function ensureBuiltInServers(projectId: string): Promise<McpServer[]> {
  const existing = await storage.getMcpServers(projectId);
  const existingNames = new Set(existing.map(s => s.name));
  const created: McpServer[] = [];

  for (const def of BUILT_IN_SERVERS) {
    if (!existingNames.has(def.name)) {
      const server = await storage.createMcpServer({
        projectId,
        name: def.name,
        command: def.command,
        args: def.args,
        env: {},
        isBuiltIn: true,
      });

      for (const tool of def.tools) {
        await storage.createMcpTool({
          serverId: server.id,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        });
      }
      created.push(server);
    }
  }

  return created;
}

export function getBuiltInServerDef(name: string): BuiltInServerDef | undefined {
  return BUILT_IN_SERVERS.find(s => s.name === name);
}
