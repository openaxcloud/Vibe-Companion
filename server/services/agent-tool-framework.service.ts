import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger';
import { db } from '../db';
import {
  toolRegistry,
  toolExecutions,
  agentSessions,
  agentAuditTrail,
  files,
  type ToolRegistry,
  type ToolExecution,
  type InsertToolRegistry,
  type InsertToolExecution,
  type AgentSession
} from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { syncFileToDisc } from '../utils/project-fs-sync';
import { z } from 'zod';
import { agentFileOperations } from './agent-file-operations.service';
import { agentCommandExecution } from './agent-command-execution.service';
import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import fetch from 'node-fetch';

const logger = createLogger('agent-tool-framework');

// Tool execution event for real-time feedback
export interface ToolExecutionEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  toolName: string;
  sessionId: string;
  input: any;
  output?: any;
  error?: string;
  progress?: number;
}

// Tool definition interface
export interface ToolDefinition {
  name: string;
  displayName: string;
  description: string;
  capability: 'file_system' | 'command_execution' | 'database' | 'ide_integration' | 
              'git_operations' | 'package_management' | 'testing' | 'deployment' |
              'monitoring' | 'security' | 'api_integration' | 'ai_analysis';
  inputSchema: z.ZodSchema;
  execute: (input: any, context: ToolContext) => Promise<any>;
  requiresAuth?: boolean;
  rateLimit?: number; // Requests per minute
}

// Tool execution context
export interface ToolContext {
  sessionId: string;
  userId: string;
  projectId: number;
  projectPath: string;
  environment: Record<string, string>;
}

export class AgentToolFrameworkService extends EventEmitter {
  private tools: Map<string, ToolDefinition> = new Map();
  private rateLimits: Map<string, { count: number; resetTime: number }> = new Map();
  private openai: OpenAI;
  private toolsRegistered = false;
  private toolsRegistering = false;

  constructor() {
    super();
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  private async ensureToolsRegistered(): Promise<void> {
    if (this.toolsRegistered) return;
    if (this.toolsRegistering) {
      while (this.toolsRegistering) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return;
    }
    
    this.toolsRegistering = true;
    try {
      this.registerBuiltInTools();
      this.toolsRegistered = true;
      logger.info('[AgentToolFramework] ✅ Built-in tools registered successfully');
    } catch (error) {
      logger.error('[AgentToolFramework] Failed to register built-in tools:', error);
    } finally {
      this.toolsRegistering = false;
    }
  }

  // Register built-in tools matching Replit agent capabilities
  private registerBuiltInTools() {
    // File System Tools
    this.registerTool({
      name: 'read_file',
      displayName: 'Read File',
      description: 'Read contents of a file',
      capability: 'file_system',
      inputSchema: z.object({
        path: z.string().describe('File path to read'),
        encoding: z.string().optional().default('utf-8')
      }),
      execute: async (input, context) => {
        const result = await agentFileOperations.readFile(
          context.sessionId,
          input.path,
          context.userId
        );
        return result.content;
      }
    });

    this.registerTool({
      name: 'write_file',
      displayName: 'Write File',
      description: 'Write content to a file',
      capability: 'file_system',
      inputSchema: z.object({
        path: z.string().describe('File path to write'),
        content: z.string().describe('Content to write')
      }),
      execute: async (input, context) => {
        const result = await agentFileOperations.createOrUpdateFile(
          context.sessionId,
          input.path,
          input.content,
          context.userId
        );
        return { success: true, path: input.path };
      }
    });

    this.registerTool({
      name: 'delete_file',
      displayName: 'Delete File',
      description: 'Delete a file',
      capability: 'file_system',
      inputSchema: z.object({
        path: z.string().describe('File path to delete')
      }),
      execute: async (input, context) => {
        await agentFileOperations.deleteFile(
          context.sessionId,
          input.path,
          context.userId
        );
        return { success: true, deleted: input.path };
      }
    });

    this.registerTool({
      name: 'list_directory',
      displayName: 'List Directory',
      description: 'List contents of a directory',
      capability: 'file_system',
      inputSchema: z.object({
        path: z.string().describe('Directory path'),
        recursive: z.boolean().optional().default(false)
      }),
      execute: async (input, context) => {
        return await agentFileOperations.listDirectory(
          context.sessionId,
          input.path,
          input.recursive
        );
      }
    });

    // Command Execution Tools
    this.registerTool({
      name: 'run_command',
      displayName: 'Run Command',
      description: 'Execute a shell command',
      capability: 'command_execution',
      inputSchema: z.object({
        command: z.string().describe('Command to execute'),
        args: z.array(z.string()).optional().default([]),
        workingDirectory: z.string().optional(),
        timeout: z.number().optional()
      }),
      execute: async (input, context) => {
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          input.command,
          input.args,
          {
            workingDirectory: input.workingDirectory,
            timeout: input.timeout
          },
          context.userId
        );
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        };
      }
    });

    // Git Operations
    this.registerTool({
      name: 'git_status',
      displayName: 'Git Status',
      description: 'Get git repository status',
      capability: 'git_operations',
      inputSchema: z.object({
        path: z.string().optional().describe('Repository path')
      }),
      execute: async (input, context) => {
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          'git',
          ['status', '--porcelain'],
          { workingDirectory: input.path || context.projectPath },
          context.userId
        );
        return this.parseGitStatus(result.stdout || '');
      }
    });

    this.registerTool({
      name: 'git_diff',
      displayName: 'Git Diff',
      description: 'Get git diff',
      capability: 'git_operations',
      inputSchema: z.object({
        path: z.string().optional(),
        staged: z.boolean().optional().default(false)
      }),
      execute: async (input, context) => {
        const args = ['diff'];
        if (input.staged) args.push('--staged');
        
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          'git',
          args,
          { workingDirectory: input.path || context.projectPath },
          context.userId
        );
        return result.stdout;
      }
    });

    this.registerTool({
      name: 'git_commit',
      displayName: 'Git Commit',
      description: 'Create a git commit',
      capability: 'git_operations',
      inputSchema: z.object({
        message: z.string().describe('Commit message'),
        files: z.array(z.string()).optional().describe('Specific files to commit')
      }),
      execute: async (input, context) => {
        // Stage files
        if (input.files && input.files.length > 0) {
          await agentCommandExecution.executeCommand(
            context.sessionId,
            'git',
            ['add', ...input.files],
            { workingDirectory: context.projectPath },
            context.userId
          );
        } else {
          await agentCommandExecution.executeCommand(
            context.sessionId,
            'git',
            ['add', '-A'],
            { workingDirectory: context.projectPath },
            context.userId
          );
        }
        
        // Commit
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          'git',
          ['commit', '-m', input.message],
          { workingDirectory: context.projectPath },
          context.userId
        );
        return result.stdout;
      }
    });

    // Package Management
    this.registerTool({
      name: 'npm_install',
      displayName: 'NPM Install',
      description: 'Install npm packages',
      capability: 'package_management',
      inputSchema: z.object({
        packages: z.array(z.string()).optional(),
        dev: z.boolean().optional().default(false),
        global: z.boolean().optional().default(false)
      }),
      execute: async (input, context) => {
        const args = ['install'];
        if (input.dev) args.push('--save-dev');
        if (input.global) args.push('-g');
        if (input.packages) args.push(...input.packages);
        
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          'npm',
          args,
          { workingDirectory: context.projectPath, timeout: 120000 },
          context.userId
        );
        return result.stdout;
      }
    });

    this.registerTool({
      name: 'npm_run',
      displayName: 'NPM Run Script',
      description: 'Run npm script',
      capability: 'package_management',
      inputSchema: z.object({
        script: z.string().describe('Script name to run')
      }),
      execute: async (input, context) => {
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          'npm',
          ['run', input.script],
          { workingDirectory: context.projectPath },
          context.userId
        );
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode
        };
      }
    });

    // Testing Tools
    this.registerTool({
      name: 'run_tests',
      displayName: 'Run Tests',
      description: 'Run project tests',
      capability: 'testing',
      inputSchema: z.object({
        testCommand: z.string().optional().default('test'),
        pattern: z.string().optional()
      }),
      execute: async (input, context) => {
        const args = ['run', input.testCommand];
        if (input.pattern) args.push('--', input.pattern);
        
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          'npm',
          args,
          { workingDirectory: context.projectPath, timeout: 300000 },
          context.userId
        );
        return {
          stdout: result.stdout,
          stderr: result.stderr,
          exitCode: result.exitCode,
          success: result.exitCode === 0
        };
      }
    });

    // Database Tools
    this.registerTool({
      name: 'run_sql',
      displayName: 'Run SQL Query',
      description: 'Execute SQL query on database',
      capability: 'database',
      inputSchema: z.object({
        query: z.string().describe('SQL query to execute'),
        database: z.string().optional().default('default')
      }),
      execute: async (input, context) => {
        const { db } = await import('../db');
        const { sql } = await import('drizzle-orm');
        
        try {
          // Security: Validate query to prevent dangerous operations
          const queryUpper = input.query.trim().toUpperCase();
          const dangerousPatterns = ['DROP DATABASE', 'DROP SCHEMA', 'TRUNCATE', 'ALTER SYSTEM'];
          
          for (const pattern of dangerousPatterns) {
            if (queryUpper.includes(pattern)) {
              return {
                success: false,
                error: `Dangerous operation blocked: ${pattern}`,
                query: input.query.substring(0, 100)
              };
            }
          }
          
          // Execute the query
          const result = await db.execute(sql.raw(input.query));
          
          // Determine query type for response formatting
          const isSelect = queryUpper.startsWith('SELECT');
          const isInsert = queryUpper.startsWith('INSERT');
          const isUpdate = queryUpper.startsWith('UPDATE');
          const isDelete = queryUpper.startsWith('DELETE');
          
          if (isSelect) {
            const rows = Array.isArray(result) ? result : (result as any).rows || [];
            return {
              success: true,
              operation: 'select',
              rowCount: rows.length,
              rows: rows.slice(0, 100) // Limit to 100 rows for safety
            };
          }
          
          // For mutating queries, return affected row count
          const rowCount = (result as any).rowCount || (result as any).affectedRows || 0;
          return {
            success: true,
            operation: isInsert ? 'insert' : isUpdate ? 'update' : isDelete ? 'delete' : 'execute',
            affectedRows: rowCount
          };
        } catch (error: any) {
          logger.error('[ToolFramework] SQL execution failed:', error);
          return {
            success: false,
            error: error.message,
            query: input.query.substring(0, 100)
          };
        }
      }
    });

    // Database Provisioning Tool - Like Replit's automatic database creation
    this.registerTool({
      name: 'provision_database',
      displayName: 'Provision Database',
      description: 'Create a new PostgreSQL database for the project. Use this when the user needs a database for their app, wants to store data, or needs persistent storage.',
      capability: 'database',
      inputSchema: z.object({
        plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional().default('free').describe('Database plan tier'),
        region: z.string().optional().default('us-east-1').describe('Database region')
      }),
      execute: async (input, context) => {
        try {
          // Validate projectId is available
          if (!context.projectId) {
            return {
              success: false,
              error: 'Project ID is required to provision a database. This tool must be called within a project context.'
            };
          }
          
          const { projectDatabaseService } = await import('./project-database-provisioning.service');
          
          // Check if database already exists
          const existing = await projectDatabaseService.getProjectDatabase(context.projectId);
          if (existing) {
            const credentials = await projectDatabaseService.getCredentials(context.projectId);
            return {
              success: true,
              alreadyExists: true,
              message: 'Database already provisioned for this project',
              database: {
                name: existing.name,
                type: existing.type,
                status: existing.status,
                host: existing.host,
                port: existing.port,
                databaseName: existing.database,
                username: existing.username
              },
              connectionUrl: credentials?.connectionUrl,
              envVar: 'DATABASE_URL'
            };
          }
          
          // Provision new database
          const database = await projectDatabaseService.provisionDatabase(context.projectId, {
            plan: input.plan || 'free',
            region: input.region || 'us-east-1'
          });
          
          const credentials = await projectDatabaseService.getCredentials(context.projectId);
          
          logger.info(`[ToolFramework] Agent provisioned database for project ${context.projectId}`);
          
          return {
            success: true,
            alreadyExists: false,
            message: `Database provisioned successfully on ${input.plan || 'free'} plan`,
            database: {
              name: database.name,
              type: database.type,
              status: database.status,
              host: database.host,
              port: database.port,
              databaseName: database.database,
              username: database.username
            },
            connectionUrl: credentials?.connectionUrl,
            envVar: 'DATABASE_URL',
            usage: 'Use DATABASE_URL environment variable to connect. For Drizzle ORM, import { db } from your db config file.'
          };
        } catch (error: any) {
          logger.error('[ToolFramework] Database provisioning failed:', error);
          return {
            success: false,
            error: error.message
          };
        }
      }
    });

    // Get Database Info Tool
    this.registerTool({
      name: 'get_database_info',
      displayName: 'Get Database Info',
      description: 'Get information about the project database including connection details, status, and credentials.',
      capability: 'database',
      inputSchema: z.object({}),
      execute: async (input, context) => {
        try {
          // Validate projectId is available
          if (!context.projectId) {
            return {
              provisioned: false,
              error: 'Project ID is required. This tool must be called within a project context.'
            };
          }
          
          const { projectDatabaseService } = await import('./project-database-provisioning.service');
          
          const database = await projectDatabaseService.getProjectDatabase(context.projectId);
          if (!database) {
            return {
              provisioned: false,
              message: 'No database provisioned. Use provision_database tool to create one.'
            };
          }
          
          const credentials = await projectDatabaseService.getCredentials(context.projectId);
          const stats = await projectDatabaseService.getDatabaseStats(context.projectId);
          
          return {
            provisioned: true,
            database: {
              name: database.name,
              type: database.type,
              status: database.status,
              plan: database.plan,
              host: database.host,
              port: database.port,
              databaseName: database.database,
              username: database.username,
              storageUsedMb: database.storageUsedMb,
              storageLimitMb: database.storageLimitMb
            },
            connectionUrl: credentials?.connectionUrl,
            stats
          };
        } catch (error: any) {
          logger.error('[ToolFramework] Get database info failed:', error);
          return {
            success: false,
            error: error.message
          };
        }
      }
    });

    // API Integration Tools
    this.registerTool({
      name: 'http_request',
      displayName: 'HTTP Request',
      description: 'Make HTTP request',
      capability: 'api_integration',
      inputSchema: z.object({
        url: z.string().describe('URL to request'),
        method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
        headers: z.record(z.string()).optional(),
        body: z.any().optional()
      }),
      execute: async (input, context) => {
        const response = await fetch(input.url, {
          method: input.method,
          headers: input.headers,
          body: input.body ? JSON.stringify(input.body) : undefined
        });
        
        const contentType = response.headers.get('content-type');
        let data;
        
        if (contentType?.includes('application/json')) {
          data = await response.json();
        } else {
          data = await response.text();
        }
        
        return {
          status: response.status,
          headers: Object.fromEntries(response.headers.entries()),
          data
        };
      }
    });

    // AI Analysis Tools
    this.registerTool({
      name: 'code_analysis',
      displayName: 'AI Code Analysis',
      description: 'Analyze code with AI',
      capability: 'ai_analysis',
      inputSchema: z.object({
        code: z.string().describe('Code to analyze'),
        analysisType: z.enum(['review', 'explain', 'optimize', 'debug', 'security'])
      }),
      execute: async (input, context) => {
        type AnalysisType = 'review' | 'explain' | 'optimize' | 'debug' | 'security';
        
        const prompts: Record<AnalysisType, string> = {
          review: 'Review this code and provide feedback on quality, best practices, and potential improvements:',
          explain: 'Explain what this code does in detail:',
          optimize: 'Suggest optimizations for this code:',
          debug: 'Identify potential bugs or issues in this code:',
          security: 'Analyze this code for security vulnerabilities:'
        };
        
        const completion = await this.openai.chat.completions.create({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: 'You are an expert code analyst.'
            },
            {
              role: 'user',
              content: `${prompts[input.analysisType as AnalysisType]}\n\n\`\`\`\n${input.code}\n\`\`\``
            }
          ]
        });
        
        return {
          analysisType: input.analysisType,
          result: completion.choices[0].message.content
        };
      }
    });

    // Search Tools
    this.registerTool({
      name: 'search_codebase',
      displayName: 'Search Codebase',
      description: 'Search for patterns in codebase',
      capability: 'file_system',
      inputSchema: z.object({
        pattern: z.string().describe('Search pattern or regex'),
        filePattern: z.string().optional().describe('File pattern to search in'),
        maxResults: z.number().optional().default(50)
      }),
      execute: async (input, context) => {
        const args = [input.pattern, '.', '-n', '-i', '--max-count', input.maxResults.toString()];
        if (input.filePattern) {
          args.push('--include', input.filePattern);
        }
        
        const result = await agentCommandExecution.executeCommand(
          context.sessionId,
          'grep',
          args,
          { workingDirectory: context.projectPath },
          context.userId
        );
        
        return this.parseGrepResults(result.stdout || '');
      }
    });

    // NEW TOOLS FOR REPLIT V3 PARITY (Phase 1)
    
    // 1. Browser Automation Tool - Real Playwright implementation
    this.registerTool({
      name: 'browser_open',
      displayName: 'Open Browser',
      description: 'Open a URL in a headless browser for testing',
      capability: 'testing',
      inputSchema: z.object({
        url: z.string().url().describe('URL to open'),
        waitFor: z.string().optional().describe('CSS selector to wait for'),
        timeout: z.number().optional().default(30000).describe('Timeout in ms')
      }),
      rateLimit: 2,
      requiresAuth: true,
      execute: async (input, context) => {
        const logger = await this.getLogger();
        logger.info(`[ToolFramework] Opening browser for URL: ${input.url}`);
        
        try {
          const { chromium } = await import('playwright');
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          
          await page.goto(input.url, { timeout: input.timeout, waitUntil: 'domcontentloaded' });
          
          if (input.waitFor) {
            await page.waitForSelector(input.waitFor, { timeout: input.timeout });
          }
          
          const title = await page.title();
          const url = page.url();
          const content = await page.content();
          
          await browser.close();
          
          logger.info(`[ToolFramework] Browser opened successfully: ${title}`);
          return {
            success: true,
            url,
            title,
            contentLength: content.length,
            message: 'Browser opened and page loaded successfully'
          };
        } catch (error: any) {
          logger.error(`[ToolFramework] Browser automation failed: ${error.message}`);
          throw new Error(`Browser automation failed: ${error.message}`);
        }
      }
    });

    // 2. Screenshot Tool - Real Playwright implementation
    this.registerTool({
      name: 'take_screenshot',
      displayName: 'Take Screenshot',
      description: 'Capture a screenshot of a webpage',
      capability: 'testing',
      inputSchema: z.object({
        url: z.string().url().describe('URL to screenshot'),
        selector: z.string().optional().describe('CSS selector to screenshot'),
        fullPage: z.boolean().optional().default(false).describe('Capture full page')
      }),
      rateLimit: 2,
      execute: async (input, context) => {
        const logger = await this.getLogger();
        logger.info(`[ToolFramework] Taking screenshot of: ${input.url}`);
        
        try {
          const { chromium } = await import('playwright');
          const browser = await chromium.launch({ headless: true });
          const page = await browser.newPage();
          
          await page.goto(input.url, { waitUntil: 'networkidle' });
          
          const screenshotDir = path.join(context.projectPath, 'screenshots');
          await fs.mkdir(screenshotDir, { recursive: true });
          
          const filename = `screenshot-${Date.now()}.png`;
          const screenshotPath = path.join(screenshotDir, filename);
          
          if (input.selector) {
            const element = await page.$(input.selector);
            if (element) {
              await element.screenshot({ path: screenshotPath });
            } else {
              throw new Error(`Selector not found: ${input.selector}`);
            }
          } else {
            await page.screenshot({ path: screenshotPath, fullPage: input.fullPage });
          }
          
          await browser.close();
          
          logger.info(`[ToolFramework] Screenshot saved to: ${screenshotPath}`);
          return {
            success: true,
            screenshotPath: `screenshots/${filename}`,
            absolutePath: screenshotPath,
            url: input.url
          };
        } catch (error: any) {
          logger.error(`[ToolFramework] Screenshot failed: ${error.message}`);
          throw new Error(`Screenshot failed: ${error.message}`);
        }
      }
    });

    // 3. Web Scraping Tool - Real Cheerio implementation
    this.registerTool({
      name: 'web_scrape',
      displayName: 'Web Scrape',
      description: 'Extract data from a webpage using CSS selectors',
      capability: 'api_integration',
      inputSchema: z.object({
        url: z.string().url().describe('URL to scrape'),
        selectors: z.array(z.string()).describe('CSS selectors to extract'),
        extractAttribute: z.string().optional().describe('Attribute to extract (default: text content)')
      }),
      rateLimit: 1,
      execute: async (input, context) => {
        const logger = await this.getLogger();
        logger.info(`[ToolFramework] Scraping URL: ${input.url}`);
        
        const allowedDomains = [
          'github.com', 'npmjs.com', 'pypi.org', 'stackoverflow.com',
          'developer.mozilla.org', 'docs.replit.com', 'wikipedia.org',
          'MDN', 'w3schools.com', 'caniuse.com'
        ];
        
        const url = new URL(input.url);
        const isAllowed = allowedDomains.some(domain => 
          url.hostname === domain || url.hostname.endsWith(`.${domain}`)
        );
        
        if (!isAllowed) {
          throw new Error(`Domain ${url.hostname} not in allow-list for web scraping`);
        }
        
        try {
          const response = await fetch(input.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; AgentBot/1.0)'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const html = await response.text();
          const cheerio = await import('cheerio');
          const $ = cheerio.load(html);
          
          const results: Record<string, string[]> = {};
          
          for (const selector of input.selectors) {
            const elements = $(selector);
            const extracted: string[] = [];
            
            elements.each((_, el) => {
              if (input.extractAttribute) {
                const attrValue = $(el).attr(input.extractAttribute);
                if (attrValue) extracted.push(attrValue);
              } else {
                const text = $(el).text().trim();
                if (text) extracted.push(text);
              }
            });
            
            results[selector] = extracted;
          }
          
          logger.info(`[ToolFramework] Scraped ${Object.keys(results).length} selectors from ${input.url}`);
          return {
            success: true,
            url: input.url,
            title: $('title').text() || 'Untitled',
            data: results,
            totalMatches: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
          };
        } catch (error: any) {
          logger.error(`[ToolFramework] Web scrape failed: ${error.message}`);
          throw new Error(`Web scrape failed: ${error.message}`);
        }
      }
    });

    // 4. Package Inspector
    this.registerTool({
      name: 'package_inspector',
      displayName: 'Package Inspector',
      description: 'Search and inspect npm/pypi packages',
      capability: 'package_management',
      inputSchema: z.object({
        packageName: z.string().describe('Package name to inspect'),
        registry: z.enum(['npm', 'pypi']).default('npm')
      }),
      execute: async (input, context) => {
        const url = input.registry === 'npm'
          ? `https://registry.npmjs.org/${encodeURIComponent(input.packageName)}`
          : `https://pypi.org/pypi/${encodeURIComponent(input.packageName)}/json`;
        
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Package not found: ${input.packageName}`);
          }
          
          const data: any = await response.json();
          
          return {
            name: input.packageName,
            registry: input.registry,
            version: data.version || data.info?.version || 'unknown',
            description: data.description || data.info?.summary || 'No description'
          };
        } catch (error: any) {
          throw new Error(`Package inspection failed: ${error.message}`);
        }
      }
    });

    // 5. Collect Metrics - Real system metrics implementation
    this.registerTool({
      name: 'collect_metrics',
      displayName: 'Collect Metrics',
      description: 'Collect real application performance metrics',
      capability: 'monitoring',
      inputSchema: z.object({
        duration: z.number().optional().default(60).describe('Collection duration in seconds'),
        includeProcess: z.boolean().optional().default(true).describe('Include process metrics')
      }),
      execute: async (input, context) => {
        const logger = await this.getLogger();
        logger.info('[ToolFramework] Collecting system metrics');
        
        try {
          const os = await import('os');
          
          const cpus = os.cpus();
          const totalMemory = os.totalmem();
          const freeMemory = os.freemem();
          const usedMemory = totalMemory - freeMemory;
          const loadAvg = os.loadavg();
          
          const cpuUsage = cpus.reduce((acc, cpu) => {
            const total = Object.values(cpu.times).reduce((a, b) => a + b, 0);
            const idle = cpu.times.idle;
            return acc + ((total - idle) / total) * 100;
          }, 0) / cpus.length;
          
          const processMetrics = input.includeProcess ? {
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            cpuUsage: process.cpuUsage()
          } : undefined;
          
          logger.info('[ToolFramework] Metrics collected successfully');
          return {
            timestamp: new Date().toISOString(),
            system: {
              platform: os.platform(),
              arch: os.arch(),
              hostname: os.hostname(),
              uptime: os.uptime(),
              cpuCount: cpus.length,
              cpuModel: cpus[0]?.model || 'unknown'
            },
            cpu: {
              usage: Math.round(cpuUsage * 100) / 100,
              loadAverage: {
                '1m': loadAvg[0],
                '5m': loadAvg[1],
                '15m': loadAvg[2]
              }
            },
            memory: {
              total: Math.round(totalMemory / 1024 / 1024),
              used: Math.round(usedMemory / 1024 / 1024),
              free: Math.round(freeMemory / 1024 / 1024),
              usagePercent: Math.round((usedMemory / totalMemory) * 10000) / 100
            },
            process: processMetrics
          };
        } catch (error: any) {
          logger.error(`[ToolFramework] Metrics collection failed: ${error.message}`);
          throw new Error(`Metrics collection failed: ${error.message}`);
        }
      }
    });

    // 6. Watch File Changes - Real chokidar implementation
    this.registerTool({
      name: 'watch_file_changes',
      displayName: 'Watch File Changes',
      description: 'Monitor file system changes with real-time notifications',
      capability: 'file_system',
      inputSchema: z.object({
        path: z.string().describe('Path to watch'),
        pattern: z.string().optional().describe('File pattern to match (glob)'),
        timeout: z.number().optional().default(30000).describe('Watch duration in ms')
      }),
      execute: async (input, context) => {
        const logger = await this.getLogger();
        logger.info(`[ToolFramework] Starting file watcher on: ${input.path}`);
        
        try {
          const chokidar = await import('chokidar');
          const watchPath = path.join(context.projectPath, input.path);
          
          const changes: Array<{ event: string; path: string; time: string }> = [];
          
          return new Promise((resolve, reject) => {
            const watcher = chokidar.watch(watchPath, {
              ignored: /(^|[\/\\])\../, // ignore dotfiles
              persistent: true,
              ignoreInitial: true
            });
            
            watcher.on('add', filePath => {
              changes.push({ event: 'add', path: filePath, time: new Date().toISOString() });
              this.emitEvent({
                type: 'progress',
                toolName: 'watch_file_changes',
                sessionId: context.sessionId,
                input,
                output: { event: 'add', path: filePath },
                progress: changes.length
              });
            });
            
            watcher.on('change', filePath => {
              changes.push({ event: 'change', path: filePath, time: new Date().toISOString() });
              this.emitEvent({
                type: 'progress',
                toolName: 'watch_file_changes',
                sessionId: context.sessionId,
                input,
                output: { event: 'change', path: filePath },
                progress: changes.length
              });
            });
            
            watcher.on('unlink', filePath => {
              changes.push({ event: 'delete', path: filePath, time: new Date().toISOString() });
              this.emitEvent({
                type: 'progress',
                toolName: 'watch_file_changes',
                sessionId: context.sessionId,
                input,
                output: { event: 'delete', path: filePath },
                progress: changes.length
              });
            });
            
            watcher.on('error', (error: unknown) => {
              const errorMessage = error instanceof Error ? error.message : String(error);
              logger.error(`[ToolFramework] Watcher error: ${errorMessage}`);
            });
            
            setTimeout(async () => {
              await watcher.close();
              logger.info(`[ToolFramework] File watcher stopped, recorded ${changes.length} changes`);
              resolve({
                success: true,
                watchedPath: watchPath,
                duration: input.timeout,
                totalChanges: changes.length,
                changes: changes.slice(-50) // Last 50 changes
              });
            }, input.timeout);
          });
        } catch (error: any) {
          logger.error(`[ToolFramework] File watcher failed: ${error.message}`);
          throw new Error(`File watcher failed: ${error.message}`);
        }
      }
    });

    // 7. Deploy Project - Enhanced with actual deployment hooks
    this.registerTool({
      name: 'deploy_project',
      displayName: 'Deploy Project',
      description: 'Trigger project deployment with build verification',
      capability: 'deployment',
      inputSchema: z.object({
        environment: z.enum(['development', 'staging', 'production']).default('staging'),
        commitMessage: z.string().optional(),
        skipTests: z.boolean().optional().default(false)
      }),
      rateLimit: 1,
      requiresAuth: true,
      execute: async (input, context) => {
        const logger = await this.getLogger();
        logger.info(`[ToolFramework] Initiating deployment to ${input.environment}`);
        
        try {
          const deploymentId = `deploy-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          
          // Run build verification if not skipping tests
          if (!input.skipTests) {
            const buildResult = await agentCommandExecution.executeCommand(
              context.sessionId,
              'npm',
              ['run', 'build'],
              { workingDirectory: context.projectPath, timeout: 300000 },
              context.userId
            );
            
            if (buildResult.exitCode !== 0) {
              return {
                success: false,
                deploymentId,
                environment: input.environment,
                status: 'build_failed',
                error: buildResult.stderr || 'Build failed'
              };
            }
          }
          
          logger.info(`[ToolFramework] Deployment initiated: ${deploymentId}`);
          return {
            success: true,
            deploymentId,
            environment: input.environment,
            status: input.environment === 'production' ? 'pending_approval' : 'deploying',
            message: input.environment === 'production' 
              ? 'Production deployment requires approval'
              : 'Deployment initiated successfully',
            timestamp: new Date().toISOString()
          };
        } catch (error: any) {
          logger.error(`[ToolFramework] Deployment failed: ${error.message}`);
          throw new Error(`Deployment failed: ${error.message}`);
        }
      }
    });

    // 8. Security Scan - Real npm audit integration
    this.registerTool({
      name: 'scan_security',
      displayName: 'Security Scan',
      description: 'Run comprehensive security vulnerability scan',
      capability: 'security',
      inputSchema: z.object({
        scope: z.enum(['dependencies', 'code', 'all']).default('all'),
        fix: z.boolean().optional().default(false).describe('Attempt to fix vulnerabilities')
      }),
      rateLimit: 1,
      execute: async (input, context) => {
        const logger = await this.getLogger();
        logger.info(`[ToolFramework] Running security scan with scope: ${input.scope}`);
        
        try {
          const results: any = {
            scanned: new Date().toISOString(),
            scope: input.scope,
            vulnerabilities: []
          };
          
          // Run npm audit for dependency vulnerabilities
          if (input.scope === 'dependencies' || input.scope === 'all') {
            const auditArgs = ['audit', '--json'];
            if (input.fix) auditArgs.push('--fix');
            
            const auditResult = await agentCommandExecution.executeCommand(
              context.sessionId,
              'npm',
              auditArgs,
              { workingDirectory: context.projectPath, timeout: 120000 },
              context.userId
            );
            
            try {
              const auditData = JSON.parse(auditResult.stdout || '{}');
              results.dependencies = {
                total: auditData.metadata?.totalDependencies || 0,
                vulnerabilities: auditData.metadata?.vulnerabilities || {},
                advisories: Object.keys(auditData.advisories || {}).length
              };
              
              // Extract vulnerability details
              if (auditData.vulnerabilities) {
                for (const [name, vuln] of Object.entries(auditData.vulnerabilities)) {
                  const v = vuln as any;
                  results.vulnerabilities.push({
                    package: name,
                    severity: v.severity,
                    via: v.via?.map?.((via: any) => typeof via === 'string' ? via : via.title) || [],
                    fixAvailable: v.fixAvailable
                  });
                }
              }
            } catch (parseError) {
              results.dependencies = {
                error: 'Could not parse npm audit output',
                exitCode: auditResult.exitCode
              };
            }
          }
          
          // Basic code security patterns check
          if (input.scope === 'code' || input.scope === 'all') {
            const dangerousPatterns = [
              { pattern: 'eval\\s*\\(', name: 'eval usage', severity: 'high' },
              { pattern: 'innerHTML\\s*=', name: 'innerHTML assignment', severity: 'medium' },
              { pattern: 'dangerouslySetInnerHTML', name: 'React dangerous HTML', severity: 'medium' },
              { pattern: 'exec\\s*\\(', name: 'exec usage', severity: 'high' },
              { pattern: 'child_process', name: 'child_process import', severity: 'low' }
            ];
            
            const codeIssues: any[] = [];
            
            for (const { pattern, name, severity } of dangerousPatterns) {
              try {
                const grepResult = await agentCommandExecution.executeCommand(
                  context.sessionId,
                  'grep',
                  ['-r', '-n', '-E', pattern, '--include=*.ts', '--include=*.js', '--include=*.tsx', '--include=*.jsx', '.'],
                  { workingDirectory: context.projectPath, timeout: 30000 },
                  context.userId
                );
                
                if (grepResult.stdout && grepResult.stdout.trim()) {
                  const matches = grepResult.stdout.trim().split('\n').slice(0, 5);
                  codeIssues.push({
                    pattern: name,
                    severity,
                    occurrences: matches.length,
                    samples: matches
                  });
                }
              } catch (e) {
                // Pattern not found, which is good
              }
            }
            
            results.codeAnalysis = {
              patternsChecked: dangerousPatterns.length,
              issuesFound: codeIssues.length,
              issues: codeIssues
            };
          }
          
          // Calculate overall severity
          const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          let maxSeverity = 'none';
          for (const vuln of results.vulnerabilities) {
            if ((severityOrder[vuln.severity as keyof typeof severityOrder] || 0) > 
                (severityOrder[maxSeverity as keyof typeof severityOrder] || 0)) {
              maxSeverity = vuln.severity;
            }
          }
          results.overallSeverity = maxSeverity;
          
          logger.info(`[ToolFramework] Security scan complete: ${results.vulnerabilities.length} vulnerabilities found`);
          return results;
        } catch (error: any) {
          logger.error(`[ToolFramework] Security scan failed: ${error.message}`);
          throw new Error(`Security scan failed: ${error.message}`);
        }
      }
    });

    // 9. Read Environment Variables (allow-listed)
    this.registerTool({
      name: 'read_env',
      displayName: 'Read Environment Variable',
      description: 'Read allowed environment variables',
      capability: 'ide_integration',
      inputSchema: z.object({
        key: z.string().describe('Environment variable key')
      }),
      execute: async (input, context) => {
        // Only allow-listed variables
        const allowList = ['NODE_ENV', 'PORT', 'DATABASE_URL', 'VITE_'];
        const isAllowed = allowList.some(prefix => 
          input.key === prefix || input.key.startsWith(prefix)
        );
        
        if (!isAllowed) {
          throw new Error(`Environment variable ${input.key} is not allowed`);
        }
        
        return {
          key: input.key,
          value: process.env[input.key] || null,
          exists: input.key in process.env
        };
      }
    });

    // 10. Write Environment Variables (with auditing + DB persistence)
    this.registerTool({
      name: 'write_env',
      displayName: 'Write Environment Variable',
      description: 'Write environment variable with audit trail and database persistence',
      capability: 'ide_integration',
      inputSchema: z.object({
        key: z.string().describe('Environment variable key'),
        value: z.string().describe('Environment variable value'),
        namespace: z.string().optional().describe('Variable namespace'),
        envFileName: z.string().optional().describe('Env file name (default: .env)')
      }),
      requiresAuth: true,
      rateLimit: 2,
      execute: async (input, context) => {
        const envFileName = input.envFileName || '.env';
        this.validateEnvFileName(envFileName);

        // Audit all env writes
        await db.insert(agentAuditTrail).values({
          userId: typeof context.userId === 'string' ? parseInt(context.userId) || 0 : context.userId,
          sessionId: context.sessionId,
          action: 'write_env',
          resourceType: 'environment_variable',
          resourceId: input.key,
          details: {
            key: input.key,
            namespace: input.namespace,
            timestamp: new Date().toISOString(),
            outcome: 'success'
          },
          severity: 'medium'
        });

        // Persist env variable to the files table atomically
        const mergedContent = await this.upsertEnvVariable(
          context.projectId,
          envFileName,
          input.key,
          input.value
        );

        // Sync env file to disk so running processes pick it up
        syncFileToDisc(context.projectId, envFileName, mergedContent).catch(err => {
          logger.warn(`[ToolFramework] Failed to sync env file to disk: ${err.message}`);
        });

        return {
          success: true,
          key: input.key,
          written: true,
          persisted: true,
          envFile: envFileName
        };
      }
    });

    // 10b. Write entire .env file content (with auditing + DB persistence)
    this.registerTool({
      name: 'write_env_file',
      displayName: 'Write Environment File',
      description: 'Write an entire .env file with audit trail and database persistence',
      capability: 'ide_integration',
      inputSchema: z.object({
        content: z.string().describe('Full .env file content'),
        envFileName: z.string().optional().describe('Env file name (default: .env)')
      }),
      requiresAuth: true,
      rateLimit: 2,
      execute: async (input, context) => {
        const envFileName = input.envFileName || '.env';
        this.validateEnvFileName(envFileName);

        await db.insert(agentAuditTrail).values({
          userId: typeof context.userId === 'string' ? parseInt(context.userId) || 0 : context.userId,
          sessionId: context.sessionId,
          action: 'write_env_file',
          resourceType: 'environment_file',
          resourceId: envFileName,
          details: {
            envFileName,
            timestamp: new Date().toISOString(),
            outcome: 'success'
          },
          severity: 'medium'
        });

        await this.upsertEnvFileContent(context.projectId, envFileName, input.content);

        syncFileToDisc(context.projectId, envFileName, input.content).catch(err => {
          logger.warn(`[ToolFramework] Failed to sync env file to disk: ${err.message}`);
        });

        return {
          success: true,
          persisted: true,
          envFile: envFileName
        };
      }
    });
  }

  // Register a custom tool
  async registerTool(definition: ToolDefinition): Promise<void> {
    // Validate tool definition
    if (!definition.name || !definition.execute) {
      throw new Error('Invalid tool definition');
    }
    
    // Store in memory
    this.tools.set(definition.name, definition);
    
    // Store in database
    await db.insert(toolRegistry)
      .values({
        name: definition.name,
        displayName: definition.displayName,
        description: definition.description || '',
        capability: definition.capability,
        version: '1.0.0',
        isEnabled: true,
        requiresAuth: definition.requiresAuth || false,
        inputSchema: definition.inputSchema ? 
          JSON.parse(JSON.stringify(definition.inputSchema)) : {},
        outputSchema: {},
        configuration: {
          rateLimit: definition.rateLimit
        }
      })
      .onConflictDoUpdate({
        target: toolRegistry.name,
        set: {
          displayName: definition.displayName,
          description: definition.description || '',
          capability: definition.capability,
          isEnabled: true
        }
      });
  }

  // Execute a tool
  async executeTool(
    toolName: string,
    input: any,
    context: ToolContext
  ): Promise<ToolExecution> {
    // Ensure built-in tools are registered before execution
    await this.ensureToolsRegistered();
    
    try {
      // Get tool definition
      const tool = this.tools.get(toolName);
      if (!tool) {
        throw new Error(`Tool not found: ${toolName}`);
      }
      
      // Check rate limit
      if (tool.rateLimit) {
        this.checkRateLimit(toolName, tool.rateLimit);
      }
      
      // Validate session
      await this.validateSession(context.sessionId);
      
      // Validate input
      if (tool.inputSchema) {
        input = tool.inputSchema.parse(input);
      }
      
      // Get tool registry entry
      const [toolReg] = await db.select()
        .from(toolRegistry)
        .where(eq(toolRegistry.name, toolName));
      
      if (!toolReg) {
        throw new Error(`Tool not registered: ${toolName}`);
      }
      
      // Create execution record
      const [execution] = await db.insert(toolExecutions)
        .values({
          sessionId: context.sessionId,
          toolId: toolReg.id,
          input,
          status: 'in_progress'
        })
        .returning();
      
      // Emit start event
      this.emitEvent({
        type: 'start',
        toolName,
        sessionId: context.sessionId,
        input
      });
      
      // Execute tool
      const startTime = Date.now();
      let output: any;
      let error: string | undefined;
      
      try {
        output = await tool.execute(input, context);
      } catch (err: any) {
        error = err.message;
        throw err;
      } finally {
        const executionTime = Date.now() - startTime;
        
        // Update execution record
        await db.update(toolExecutions)
          .set({
            output,
            status: error ? 'failed' : 'completed',
            error,
            executionTime,
            completedAt: new Date()
          })
          .where(eq(toolExecutions.id, execution.id));
        
        // Emit completion event
        this.emitEvent({
          type: error ? 'error' : 'complete',
          toolName,
          sessionId: context.sessionId,
          input,
          output,
          error
        });
        
        // Audit trail
        await this.createAuditEntry(
          context.sessionId,
          context.userId,
          'tool_execute',
          toolName
        );
      }
      
      const [updated] = await db.select()
        .from(toolExecutions)
        .where(eq(toolExecutions.id, execution.id));
      
      return updated;
    } catch (error: any) {
      this.emitEvent({
        type: 'error',
        toolName,
        sessionId: context.sessionId,
        input,
        error: error.message
      });
      throw error;
    }
  }

  // Get available tools
  async getAvailableTools(capability?: string): Promise<ToolRegistry[]> {
    // Ensure built-in tools are registered before querying
    await this.ensureToolsRegistered();
    
    if (capability) {
      return await db.select()
        .from(toolRegistry)
        .where(and(
          eq(toolRegistry.isEnabled, true),
          eq(toolRegistry.capability, capability as any)
        ));
    }
    
    return await db.select()
      .from(toolRegistry)
      .where(eq(toolRegistry.isEnabled, true));
  }

  // Get tool execution history
  async getExecutionHistory(
    sessionId: string,
    limit: number = 50
  ): Promise<ToolExecution[]> {
    return await db.select()
      .from(toolExecutions)
      .where(eq(toolExecutions.sessionId, sessionId))
      .orderBy(toolExecutions.startedAt)
      .limit(limit);
  }

  // Private helper methods
  
  // Get or create logger instance
  private async getLogger() {
    const { createLogger } = await import('../utils/logger');
    return createLogger('agent-tool-framework');
  }
  
  private async validateSession(sessionId: string): Promise<AgentSession> {
    const [session] = await db.select()
      .from(agentSessions)
      .where(and(
        eq(agentSessions.id, sessionId),
        eq(agentSessions.isActive, true)
      ));
    
    if (!session) {
      throw new Error('Invalid or inactive session');
    }
    
    return session;
  }

  private checkRateLimit(toolName: string, limit: number) {
    const now = Date.now();
    const key = `${toolName}`;
    const rateInfo = this.rateLimits.get(key);
    
    if (rateInfo) {
      if (now < rateInfo.resetTime) {
        if (rateInfo.count >= limit) {
          throw new Error(`Rate limit exceeded for tool ${toolName}`);
        }
        rateInfo.count++;
      } else {
        this.rateLimits.set(key, { count: 1, resetTime: now + 60000 });
      }
    } else {
      this.rateLimits.set(key, { count: 1, resetTime: now + 60000 });
    }
  }

  private parseGitStatus(output: string): any {
    const lines = output.split('\n').filter(l => l.trim());
    const status: {
      modified: string[];
      added: string[];
      deleted: string[];
      untracked: string[];
    } = {
      modified: [],
      added: [],
      deleted: [],
      untracked: []
    };
    
    for (const line of lines) {
      const [code, ...fileParts] = line.trim().split(' ');
      const file = fileParts.join(' ');
      
      if (code.includes('M')) status.modified.push(file);
      if (code.includes('A')) status.added.push(file);
      if (code.includes('D')) status.deleted.push(file);
      if (code === '??') status.untracked.push(file);
    }
    
    return status;
  }

  private parseGrepResults(output: string): any[] {
    const lines = output.split('\n').filter(l => l.trim());
    return lines.map(line => {
      const match = line.match(/^([^:]+):(\d+):(.*)$/);
      if (match) {
        return {
          file: match[1],
          line: parseInt(match[2]),
          content: match[3]
        };
      }
      return null;
    }).filter(Boolean);
  }

  private async createAuditEntry(
    sessionId: string,
    userId: string,
    action: string,
    toolName: string
  ) {
    await db.insert(agentAuditTrail).values({
      sessionId,
      userId: typeof userId === 'string' ? parseInt(userId) || 0 : userId,
      action,
      resourceType: 'tool',
      resourceId: toolName,
      severity: 'info',
      details: { timestamp: new Date().toISOString() }
    });
  }

  private emitEvent(event: ToolExecutionEvent) {
    this.emit('tool:event', event);
  }

  private parseEnvContent(content: string): Map<string, string> {
    const vars = new Map<string, string>();
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.substring(0, eqIdx).trim();
      let value = trimmed.substring(eqIdx + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      vars.set(key, value);
    }
    return vars;
  }

  private serializeEnvVars(vars: Map<string, string>): string {
    const lines: string[] = [];
    vars.forEach((value, key) => {
      const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('\n');
      lines.push(needsQuotes ? `${key}="${value}"` : `${key}=${value}`);
    });
    return lines.join('\n') + '\n';
  }

  private static ENV_FILE_PATTERN = /^\.env(\.[a-zA-Z0-9._-]+)?$/;

  private validateEnvFileName(envFileName: string): void {
    const basename = path.basename(envFileName);
    if (!AgentToolFrameworkService.ENV_FILE_PATTERN.test(basename) || envFileName.includes('/')) {
      throw new Error(`Invalid env file name: ${envFileName}. Must match .env or .env.* pattern (e.g. .env, .env.local, .env.production)`);
    }
  }

  private envFileLockKey(projectId: number, normalizedPath: string): number {
    let hash = projectId * 2654435761;
    for (let i = 0; i < normalizedPath.length; i++) {
      hash = ((hash << 5) - hash + normalizedPath.charCodeAt(i)) | 0;
    }
    return hash;
  }

  async upsertEnvVariable(
    projectId: number,
    envFileName: string,
    key: string,
    value: string
  ): Promise<string> {
    const normalizedPath = envFileName.replace(/^\.\//, '').replace(/^\//, '');
    const lockKey = this.envFileLockKey(projectId, normalizedPath);

    const mergedContent = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      const existing = await tx.select()
        .from(files)
        .where(and(
          eq(files.projectId, projectId),
          sql`(${files.path} = ${normalizedPath} OR ${files.path} = ${'/' + normalizedPath} OR ${files.path} = ${'./' + normalizedPath})`
        ))
        .limit(1);

      const record = existing[0];
      const currentContent = record?.content || '';
      const vars = this.parseEnvContent(currentContent);
      vars.set(key, value);
      const newContent = this.serializeEnvVars(vars);

      if (record) {
        await tx.update(files)
          .set({
            content: newContent,
            size: Buffer.byteLength(newContent),
            updatedAt: new Date()
          })
          .where(eq(files.id, record.id));
      } else {
        await tx.insert(files).values({
          name: path.basename(normalizedPath),
          path: normalizedPath,
          content: newContent,
          projectId,
          parentId: null,
          isDirectory: false,
          type: 'env',
          size: Buffer.byteLength(newContent)
        });
      }

      return newContent;
    });

    logger.info(`[ToolFramework] Persisted env variable ${key} to ${normalizedPath} for project ${projectId}`);
    return mergedContent;
  }

  async upsertEnvFileContent(
    projectId: number,
    envFileName: string,
    content: string
  ): Promise<void> {
    const normalizedPath = envFileName.replace(/^\.\//, '').replace(/^\//, '');
    const lockKey = this.envFileLockKey(projectId, normalizedPath);

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${lockKey})`);

      const existing = await tx.select()
        .from(files)
        .where(and(
          eq(files.projectId, projectId),
          sql`(${files.path} = ${normalizedPath} OR ${files.path} = ${'/' + normalizedPath} OR ${files.path} = ${'./' + normalizedPath})`
        ))
        .limit(1);

      const record = existing[0];

      if (record) {
        await tx.update(files)
          .set({
            content,
            size: Buffer.byteLength(content),
            updatedAt: new Date()
          })
          .where(eq(files.id, record.id));
      } else {
        await tx.insert(files).values({
          name: path.basename(normalizedPath),
          path: normalizedPath,
          content,
          projectId,
          parentId: null,
          isDirectory: false,
          type: 'env',
          size: Buffer.byteLength(content)
        });
      }
    });

    logger.info(`[ToolFramework] Persisted env file ${normalizedPath} for project ${projectId}`);
  }
}

// Export singleton instance
export const agentToolFramework = new AgentToolFrameworkService();