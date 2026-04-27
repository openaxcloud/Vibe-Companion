// @ts-nocheck
/**
 * PTY-based Terminal Service
 * Provides real interactive shell access using node-pty
 * 
 * SECURITY: In production, terminal sessions run inside isolated Docker containers
 * to prevent access to host filesystem and secrets.
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server, IncomingMessage } from 'http';
import { Socket } from 'net';
import type { Duplex } from 'stream';
import * as os from 'os';

import * as path from 'path';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import { createLogger } from '../utils/logger';
import { storage, sessionStore } from '../storage';
import { markSocketAsHandled } from '../websocket/upgrade-guard';
import { centralUpgradeDispatcher } from '../websocket/central-upgrade-dispatcher';
import { redisSessionManager } from './redis-session-manager';
import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';

// CRITICAL SECURITY: Terminal isolation configuration
// 
// REQUIRE_DOCKER_TERMINAL: When true, terminal sessions MUST run in Docker
// - Defaults to TRUE (secure by default)
// - Only set to 'false' explicitly in local development
// - Any production deployment should NEVER disable this
//
// This is FAIL-CLOSED: If Docker is unavailable and REQUIRE_DOCKER_TERMINAL is true,
// terminal connections are rejected entirely.

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Replit VM provides OS-level isolation (nsjail + gVisor) per container —
// Docker-in-Docker is blocked by design. On Replit we trust the platform
// isolation instead of requiring a nested Docker daemon.
const IS_REPLIT_VM = !!(process.env.REPL_ID || process.env.REPLIT_DEPLOYMENT);

// SECURE DEFAULT: Require Docker unless:
//   a) Explicitly opted-in AND running in development (original behaviour), OR
//   b) Running on Replit VM where platform isolation replaces Docker AND
//      ALLOW_INSECURE_LOCAL_PTY=true is set (opt-in still required).
// NOTE: Read dynamically to support env vars loaded after module load.
function getAllowInsecureLocalPty(): boolean {
  if (IS_REPLIT_VM) return true;
  const optedIn = process.env.ALLOW_INSECURE_LOCAL_PTY === 'true';
  if (!optedIn) return false;
  return !IS_PRODUCTION;
}

// Require Docker in all cases except when explicitly allowing insecure local PTY
function getRequireDockerTerminal(): boolean {
  return !getAllowInsecureLocalPty();
}

async function validateDockerAvailable(): Promise<boolean> {
  if (IS_REPLIT_VM) {
    // Docker-in-Docker is not available on Replit VM — platform handles isolation
    return false;
  }
  return new Promise((resolve) => {
    try {
      const docker = spawn('docker', ['info'], { stdio: 'pipe' });
      docker.on('close', (code: number) => resolve(code === 0));
      docker.on('error', () => resolve(false));
      setTimeout(() => {
        docker.kill();
        resolve(false);
      }, 3000);
    } catch (error) {
      resolve(false);
    }
  });
}

// Track Docker availability status
let dockerAvailable: boolean | null = null;

const logger = createLogger('pty-terminal');

// 8.4 FIX: Circular buffer for terminal output history
class CircularBuffer {
  private buffer: string[] = [];
  private maxSize: number;
  
  constructor(maxSize: number = 10000) {
    this.maxSize = maxSize;
  }
  
  push(data: string): void {
    this.buffer.push(data);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
  }
  
  getHistory(): string[] {
    return [...this.buffer];
  }
  
  getRecentHistory(lines: number = 100): string[] {
    return this.buffer.slice(-lines);
  }
  
  clear(): void {
    this.buffer = [];
  }
  
  get length(): number {
    return this.buffer.length;
  }
}

const PTY_MAX_RETRY = 3;
const PTY_CRASH_WINDOW_MS = 2000;

class ChildProcessPtyWrapper {
  private proc: ChildProcess | null = null;
  private _onDataCallbacks: Array<(data: string) => void> = [];
  private _onExitCallbacks: Array<(info: { exitCode: number; signal: number }) => void> = [];
  private _killed = false;
  private _stopped = false;
  private retryCount = 0;
  private spawnTime = 0;
  private shell: string;
  private args: string[];
  private spawnOpts: { cwd: string; env: Record<string, string>; cols: number; rows: number };
  pid?: number;

  constructor(shell: string, args: string[], options: { cwd: string; env: Record<string, string>; cols?: number; rows?: number }) {
    this.shell = shell;
    this.args = args;
    this.spawnOpts = {
      cwd: options.cwd,
      env: options.env,
      cols: options.cols || 80,
      rows: options.rows || 24,
    };
    this.spawnChild();
  }

  private spawnChild() {
    if (this._killed || this._stopped) return;
    this.spawnTime = Date.now();

    try {
      this.proc = spawn(this.shell, this.args, {
        cwd: this.spawnOpts.cwd,
        env: { ...this.spawnOpts.env, COLUMNS: String(this.spawnOpts.cols), LINES: String(this.spawnOpts.rows) },
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err: any) {
      logger.error(`[PTY] spawn failed: ${err.message}`);
      this._stopped = true;
      this._onExitCallbacks.forEach(cb => cb({ exitCode: 1, signal: 0 }));
      return;
    }

    this.pid = this.proc.pid;
    logger.info(`[PTY] bash spawned pid=${this.pid} retry=${this.retryCount}`);

    this.proc.stdout?.on('data', (data: Buffer) => {
      const str = data.toString();
      this._onDataCallbacks.forEach(cb => cb(str));
    });

    this.proc.stderr?.on('data', (data: Buffer) => {
      const str = data.toString();
      this._onDataCallbacks.forEach(cb => cb(str));
    });

    this.proc.on('exit', (code, signal) => {
      if (this._killed) {
        this._onExitCallbacks.forEach(cb => cb({ exitCode: code || 0, signal: signal ? 1 : 0 }));
        return;
      }

      const uptime = Date.now() - this.spawnTime;
      const isCrash = uptime < PTY_CRASH_WINDOW_MS;

      if (isCrash && this.retryCount < PTY_MAX_RETRY) {
        this.retryCount++;
        const delay = this.retryCount * 500;
        logger.info(`[PTY] bash crashed after ${uptime}ms, retry ${this.retryCount}/${PTY_MAX_RETRY} in ${delay}ms`);
        setTimeout(() => this.spawnChild(), delay);
      } else if (isCrash) {
        logger.error(`[PTY] bash crashed ${PTY_MAX_RETRY} times, stopped`);
        this._stopped = true;
        this._onExitCallbacks.forEach(cb => cb({ exitCode: code || 1, signal: 0 }));
      } else {
        this.retryCount = 0;
        this._onExitCallbacks.forEach(cb => cb({ exitCode: code || 0, signal: signal ? 1 : 0 }));
      }
    });

    this.proc.on('error', (err) => {
      logger.error('[PTY] Child process error:', err);
    });
  }

  write(data: string) {
    try {
      if (this.proc && !this._killed && !this._stopped && this.proc.stdin?.writable) {
        this.proc.stdin.write(data);
      }
    } catch {}
  }

  resize(_cols: number, _rows: number) {
    this.spawnOpts.cols = _cols;
    this.spawnOpts.rows = _rows;
  }

  onData(callback: (data: string) => void) {
    this._onDataCallbacks.push(callback);
  }

  onExit(callback: (info: { exitCode: number; signal: number }) => void) {
    this._onExitCallbacks.push(callback);
  }

  kill() {
    this._killed = true;
    this._stopped = true;
    try {
      this.proc?.kill('SIGTERM');
      setTimeout(() => {
        try { this.proc?.kill('SIGKILL'); } catch {}
      }, 3000);
    } catch {}
  }
}

interface PTYSession {
  ptyProcess: any;
  dockerProcess: ChildProcess | null;
  containerId: string | null;
  projectId: string;
  clients: Set<WebSocket>;
  commandHistory: string[];
  currentDirectory: string;
  cols: number;
  rows: number;
  createdAt: number;
  lastActivity: number;
  outputBuffer: CircularBuffer;
  isDocker: boolean;
}

export class PTYTerminalService {
  private wss: WebSocketServer | null = null;
  private sessions: Map<string, PTYSession> = new Map();
  private maxSessions: number = 100;

  constructor() {}

  async setup(server: Server): Promise<void> {
    // Always check Docker availability at startup
    dockerAvailable = await validateDockerAvailable();
    
    // Log security configuration (read dynamically)
    const allowInsecure = getAllowInsecureLocalPty();
    const requireDocker = getRequireDockerTerminal();
    
    logger.info(`Security configuration:`);
    logger.info(`  - IS_PRODUCTION: ${IS_PRODUCTION}`);
    logger.info(`  - REQUIRE_DOCKER_TERMINAL: ${requireDocker}`);
    logger.info(`  - ALLOW_INSECURE_LOCAL_PTY: ${allowInsecure}`);
    logger.info(`  - Docker available: ${dockerAvailable}`);
    
    // CRITICAL SECURITY: If Docker is required but unavailable, log fatal error
    if (requireDocker && !dockerAvailable) {
      logger.error('CRITICAL: Docker is REQUIRED but NOT available!');
      logger.error('All terminal connections will be REJECTED.');
      logger.error('To fix: Install Docker OR set ALLOW_INSECURE_LOCAL_PTY=true (dev only)');
      // Don't throw - let the service start but reject all connections
    } else if (dockerAvailable) {
      logger.info('Docker validated - terminal sessions will be isolated');
    } else if (allowInsecure) {
      logger.warn('DEV MODE: Local PTY allowed - this should NEVER happen in production');
    }

    this.wss = new WebSocketServer({
      noServer: true,
      // Disable perMessageDeflate - can cause issues with some proxies (e.g., Replit)
      perMessageDeflate: false
    });

    centralUpgradeDispatcher.register(
      '/api/terminal/ws',
      this.handleTerminalUpgrade.bind(this),
      { pathMatch: 'exact', priority: 30 }
    );

    logger.info('[PTY Terminal] Registered with central upgrade dispatcher at /api/terminal/ws (priority: 30)');

    this.wss.on('connection', this.handleConnection.bind(this));
  }

  private handleTerminalUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    // Note: Socket is already marked as handled by central dispatcher
    // Don't call markSocketAsHandled again to avoid conflicts
    
    logger.info('handleTerminalUpgrade called');
    logger.info('Socket state:', {
      readable: socket.readable,
      writable: socket.writable,
      destroyed: socket.destroyed,
    });
    
    try {
      this.wss!.handleUpgrade(request, socket as Socket, head, (ws) => {
        logger.info('WebSocket upgrade completed successfully');
        logger.info('ws.readyState:', ws.readyState);
        this.wss!.emit('connection', ws, request);
      });
    } catch (error) {
      logger.error('handleUpgrade error:', error);
    }
  }

  private async handleConnection(ws: WebSocket, request: any): Promise<void> {
    try {
      const url = new URL(request.url || '', `http://${request.headers.host}`);
      // Allow connections without projectId by using 'default' workspace
      const projectId = url.searchParams.get('projectId') || 'default';

      logger.info(`handleConnection called for project ${projectId}`);

      // Send immediate acknowledgment to keep connection alive
      // This is critical - delays can cause WebSocket to fail through proxies
      ws.send(JSON.stringify({
        type: 'connected',
        data: 'Connected to terminal'
      }));
      logger.info(`Sent immediate connected message to client`);

      const queryToken = url.searchParams.get('token');
      const authHeader = request.headers['authorization'];
      const headerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      const token = queryToken || headerToken;

      let authenticated = false;
      let authenticatedUserId: number | null = null;

      interface SessionData {
        passport?: { user?: number | string };
      }

      interface JwtPayload {
        userId?: number;
        id?: number;
        sub?: number;
      }

      if (request.headers.cookie) {
        const cookies = parseCookie(request.headers.cookie);
        const sidCookie = cookies['ecode.sid'] || cookies['connect.sid'];
        if (sidCookie) {
          const sid = sidCookie.startsWith('s:') ? sidCookie.slice(2).split('.')[0] : sidCookie;
          const sess = await new Promise<SessionData | null>((resolve) => {
            sessionStore.get(sid, (_err: Error | null, s: SessionData | undefined) => resolve(s || null));
          });
          if (sess?.passport?.user) {
            authenticated = true;
            authenticatedUserId = typeof sess.passport.user === 'number' ? sess.passport.user : parseInt(String(sess.passport.user), 10);
          }
        }
      }

      if (!authenticated && token) {
        try {
          const jwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
          if (jwtSecret) {
            const decoded = jwt.verify(token, jwtSecret) as JwtPayload;
            authenticated = true;
            authenticatedUserId = decoded.userId || decoded.id || decoded.sub || null;
          }
        } catch (err: any) { console.error("[catch]", err?.message || err);}
      }

      if (!authenticated && process.env.NODE_ENV === 'production') {
        logger.warn('Terminal connection rejected: no valid session or token');
        ws.close(1008, 'Authentication required');
        return;
      }

      const numericProjectId = parseInt(projectId, 10);
      if (!isNaN(numericProjectId) && authenticatedUserId) {
        try {
          const project = await storage.getProject(numericProjectId);
          if (project && project.ownerId !== authenticatedUserId) {
            const user = await storage.getUser(authenticatedUserId);
            if (!user || user.role !== 'admin') {
              logger.warn(`Terminal connection rejected: user ${authenticatedUserId} does not own project ${projectId}`);
              ws.close(1008, 'Access denied');
              return;
            }
          }
        } catch (err) {
          logger.error(`Error checking project ownership for terminal: ${err}`);
        }
      }

      logger.info(`Terminal connection for project ${projectId} (user=${authenticatedUserId})`);

      let session = this.sessions.get(projectId);

      if (!session) {
        if (this.sessions.size >= this.maxSessions) {
          ws.close(1008, 'Server at capacity');
          return;
        }

        const redisSession = await redisSessionManager.getSession(`terminal-${projectId}`);
        if (redisSession) {
          logger.info(`Found Redis checkpoint for project ${projectId} (ended=${redisSession.sessionEnded})`);
        }

        logger.info(`Creating new session for project ${projectId}`);
        const newSession = await this.createSession(projectId, redisSession || undefined);
        if (!newSession) {
          ws.send(JSON.stringify({
            type: 'error',
            data: 'Failed to create terminal session'
          }));
          ws.close(1011, 'Failed to create terminal session');
          return;
        }
        session = newSession;
        this.sessions.set(projectId, session);
        logger.info(`Session created successfully for project ${projectId}`);

        if (redisSession) {
          if (redisSession.sessionEnded) {
            ws.send(JSON.stringify({ type: 'output', data: '\r\n[New terminal session created from checkpoint (previous session ended)]\r\n' }));
          } else {
            ws.send(JSON.stringify({ type: 'output', data: '\r\n[New terminal session created from checkpoint (previous session was interrupted)]\r\n' }));
          }
          if (redisSession.outputSnapshot) {
            ws.send(JSON.stringify({ type: 'output', data: redisSession.outputSnapshot }));
          }
        }
      }

      session.clients.add(ws);
      session.lastActivity = Date.now();

      // Session is ready - notify client
      ws.send(JSON.stringify({
        type: 'ready',
        data: 'Terminal session ready'
      }));

      // 8.4 FIX: Send recent terminal history to new clients
      const recentHistory = session.outputBuffer.getRecentHistory(500);
      if (recentHistory.length > 0) {
        ws.send(JSON.stringify({
          type: 'history',
          data: recentHistory.join('')
        }));
      }

      // SECURITY: Message size limit to prevent memory exhaustion (1MB)
      const MAX_MESSAGE_SIZE = 1024 * 1024;
      
      ws.on('message', (data) => {
        // SECURITY: Reject oversized messages
        const messageSize = Buffer.isBuffer(data) ? data.length : data.toString().length;
        if (messageSize > MAX_MESSAGE_SIZE) {
          logger.warn(`PTY message too large (${messageSize} bytes) for project ${projectId}`);
          ws.send(JSON.stringify({ type: 'error', data: 'Message too large' }));
          return;
        }
        this.handleMessage(projectId, ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(projectId, ws);
      });

      ws.on('error', (error) => {
        logger.error(`WebSocket error for project ${projectId}:`, error);
        this.handleDisconnect(projectId, ws);
      });

    } catch (error) {
      logger.error('Terminal connection error:', error);
      ws.close(1011, 'Internal error');
    }
  }

  private async createSession(projectId: string, checkpoint?: import('./redis-session-manager').TerminalSession): Promise<PTYSession | null> {
    try {
      const requireDocker = getRequireDockerTerminal();
      const allowInsecure = getAllowInsecureLocalPty();
      
      logger.info(`Creating session for project ${projectId}`);
      logger.info(`requireDocker=${requireDocker}, allowInsecure=${allowInsecure}, dockerAvailable=${dockerAvailable}`);
      
      let session: PTYSession | null = null;
      
      if (requireDocker) {
        if (!dockerAvailable) {
          logger.error(`BLOCKED: Terminal session rejected - Docker required but unavailable`);
          logger.error(`Set ALLOW_INSECURE_LOCAL_PTY=true ONLY in development to allow local PTY`);
          return null;
        }
        session = await this.createDockerSession(projectId);
      } else if (dockerAvailable) {
        session = await this.createDockerSession(projectId);
      } else {
        if (IS_REPLIT_VM) {
          logger.info('REPLIT VM: Creating local PTY session (platform-isolated)');
        } else {
          logger.warn('DEV ONLY: Creating local PTY session - INSECURE MODE ACTIVE');
        }
        session = await this.createLocalSession(projectId);
      }

      if (session && checkpoint) {
        session.commandHistory = checkpoint.commandHistory || [];
        session.currentDirectory = checkpoint.currentDirectory || session.currentDirectory;
        if (checkpoint.columns) session.cols = checkpoint.columns;
        if (checkpoint.rows) session.rows = checkpoint.rows;
        logger.info(`Applied Redis checkpoint to PTY session for project ${projectId}`);
      }

      if (session) {
        const shellPid = session.ptyProcess?.pid || undefined;
        await redisSessionManager.saveSession({
          sessionId: `terminal-${projectId}`,
          projectId,
          commandHistory: session.commandHistory,
          currentDirectory: session.currentDirectory,
          columns: session.cols,
          rows: session.rows,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          containerId: session.containerId || undefined,
          shellPid,
          sessionEnded: false,
        }).catch(err => logger.error(`Failed to checkpoint new PTY session to Redis: ${err}`));
      }

      return session;

    } catch (error) {
      logger.error(`Failed to create session for project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Create a Docker-based terminal session (SECURE - Production)
   * Runs the shell inside an isolated container with no access to host
   */
  private async createDockerSession(projectId: string): Promise<PTYSession | null> {
    try {
      const workDir = await this.setupProjectDirectory(projectId);
      const containerName = `terminal-${projectId}-${Date.now()}`;
      
      logger.info(`[SECURE] Creating Docker terminal session for project ${projectId}`);

      // Start a container with project directory mounted as writable
      // This allows persistent file changes while maintaining container isolation
      // Use node:20-alpine as base image for a lightweight shell environment
      const dockerArgs = [
        'run',
        '-it',
        '--rm',
        '--name', containerName,
        // Security: Resource limits
        '--memory', '512m',
        '--cpus', '1.0',
        // Security: Read-only root filesystem except for mounted project
        '--read-only',
        '--tmpfs', '/tmp:rw,nosuid,size=128m',
        // Security: Drop all capabilities
        '--cap-drop', 'ALL',
        // Allow network for npm/git (bridge network for isolation from host)
        '--network', 'bridge',
        // Security: No privileged escalation
        '--security-opt', 'no-new-privileges:true',
        // Mount project directory as writable workspace
        // This allows npm install, git operations, and file edits to persist
        '-v', `${workDir}:/workspace`,
        // Environment
        '-e', 'TERM=xterm-256color',
        '-e', 'HOME=/workspace',
        '-e', 'PS1=user@e-code:\\w$ ',
        // Working directory is the project
        '-w', '/workspace',
        // Image
        'node:20-alpine',
        // Start an interactive shell directly in the workspace
        '/bin/sh'
      ];

      const dockerProcess = spawn('docker', dockerArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env }
      });

      const session: PTYSession = {
        ptyProcess: null,
        dockerProcess,
        containerId: containerName,
        projectId,
        clients: new Set(),
        commandHistory: [],
        currentDirectory: '/workspace',
        cols: 80,
        rows: 24,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        outputBuffer: new CircularBuffer(10000),
        isDocker: true
      };

      // Handle Docker output
      dockerProcess.stdout?.on('data', (data: Buffer) => {
        const output = data.toString();
        session.outputBuffer.push(output);
        this.broadcastToSession(session, {
          type: 'output',
          data: output
        });
      });

      dockerProcess.stderr?.on('data', (data: Buffer) => {
        const output = data.toString();
        session.outputBuffer.push(output);
        this.broadcastToSession(session, {
          type: 'output',
          data: output
        });
      });

      dockerProcess.on('close', (code) => {
        logger.info(`Docker terminal exited for project ${projectId}: code=${code}`);
        this.broadcastToSession(session, {
          type: 'exit',
          data: `Terminal session ended`
        });
        this.cleanupSession(projectId);
      });

      dockerProcess.on('error', async (error) => {
        logger.error(`Docker terminal error for project ${projectId}:`, error);
        
        // Clean up the failed Docker session
        this.sessions.delete(projectId);
        
        // CRITICAL SECURITY: If Docker is required, NEVER fallback to local PTY
        if (getRequireDockerTerminal()) {
          logger.error('[SECURITY] Docker failed - terminal unavailable (NO fallback allowed)');
          for (const client of session.clients) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({
                type: 'error',
                data: 'Terminal service unavailable. Docker is required.'
              }));
              client.close(1011, 'Docker unavailable');
            }
          }
          return;
        }
        
        // ALLOW_INSECURE_LOCAL_PTY=true and not production: Try local PTY fallback
        if (getAllowInsecureLocalPty()) {
          logger.warn('[DEV] Docker failed, attempting local PTY fallback (INSECURE MODE)');
          try {
            const fallbackSession = await this.createLocalSession(projectId);
            if (fallbackSession) {
              this.sessions.set(projectId, fallbackSession);
              this.broadcastToSession(fallbackSession, {
                type: 'output',
                data: '\r\n[DEV NOTICE] Docker unavailable, using local terminal (INSECURE).\r\n'
              });
            }
          } catch (fallbackError) {
            logger.error('Local PTY fallback also failed:', fallbackError);
          }
        }
      });

      return session;

    } catch (error) {
      logger.error(`Failed to create Docker session for project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Create a local PTY session (INSECURE - Development only)
   * CRITICAL: This method can ONLY be called when ALLOW_INSECURE_LOCAL_PTY=true
   */
  private async createLocalSession(projectId: string): Promise<PTYSession | null> {
    // CRITICAL SECURITY GUARD: Only allow if explicitly enabled AND not in production
    // Read dynamically to handle late environment variable loading
    const allowInsecure = getAllowInsecureLocalPty();
    if (!allowInsecure) {
      logger.error('[SECURITY] CRITICAL: Attempted to create local PTY without ALLOW_INSECURE_LOCAL_PTY - BLOCKED');
      logger.error('[SECURITY] This is a security violation - terminal access denied');
      throw new Error('Local PTY is forbidden - set ALLOW_INSECURE_LOCAL_PTY=true only in development');
    }
    
    // Double-check: Never allow in production regardless of flags
    if (IS_PRODUCTION) {
      logger.error('[SECURITY] CRITICAL: Attempted to create local PTY in production - BLOCKED');
      throw new Error('Local PTY is absolutely forbidden in production');
    }

    try {
      const workDir = await this.setupProjectDirectory(projectId);
      
      const shell = this.getShell();

      logger.info(`Creating local PTY session for project ${projectId} in ${workDir}`);
      logger.warn('[SECURITY] Local PTY is only for development. Use Docker in production.');

      const sandboxedEnv: Record<string, string> = {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        HOME: workDir,
        PWD: workDir,
        TMPDIR: '/tmp',
        SHELL: shell,
        USER: `user-${String(projectId).slice(0, 8)}`,
        LOGNAME: `user-${String(projectId).slice(0, 8)}`,
        PS1: 'user@e-code:\\w$ ',
        LANG: 'en_US.UTF-8',
        LC_ALL: 'en_US.UTF-8',
        PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      };

      const ptyProcess = new ChildProcessPtyWrapper(
        shell,
        this.getShellArgs(),
        { cwd: workDir, env: sandboxedEnv, cols: 80, rows: 24 }
      );
      const isNativePty = false;
      logger.info(`[PTY] Using child_process for project ${projectId}`);

      const session: PTYSession = {
        ptyProcess,
        dockerProcess: null,
        containerId: null,
        projectId,
        clients: new Set(),
        commandHistory: [],
        currentDirectory: workDir,
        cols: 80,
        rows: 24,
        createdAt: Date.now(),
        lastActivity: Date.now(),
        outputBuffer: new CircularBuffer(10000),
        isDocker: false
      };

      ptyProcess.onData((data: string) => {
        session.outputBuffer.push(data);
        this.broadcastToSession(session, {
          type: 'output',
          data
        });
      });

      ptyProcess.onExit(({ exitCode, signal }: { exitCode: number; signal: number }) => {
        logger.info(`PTY process exited for project ${projectId}: code=${exitCode}, signal=${signal}`);
        this.broadcastToSession(session, {
          type: 'exit',
          data: `Process exited with code ${exitCode}`
        });
        this.cleanupSession(projectId);
      });

      return session;

    } catch (error) {
      logger.error(`Failed to create local session for project ${projectId}:`, error);
      return null;
    }
  }

  private async setupProjectDirectory(projectId: string): Promise<string> {
    try {
      const { bulkSyncProjectFiles, getProjectWorkspacePath } = await import('../utils/project-fs-sync');
      const files = await storage.getFilesByProjectId(projectId);
      const projectDir = await bulkSyncProjectFiles(projectId, files as any);
      return projectDir;
    } catch (error) {
      logger.error(`Failed to setup project directory:`, error);
      const { getProjectWorkspacePath, ensureProjectDirectory } = await import('../utils/project-fs-sync');
      return ensureProjectDirectory(projectId);
    }
  }

  /**
   * Sync modified files from terminal workspace back to database
   * This ensures terminal changes (npm install, file edits) persist
   */
  private async syncFilesBack(projectId: string, workDir: string): Promise<void> {
    try {
      const existingFiles = await storage.getFilesByProjectId(projectId);
      const existingFileMap = new Map(existingFiles.map(f => [f.path || f.name, f]));
      
      // Walk the workspace directory and sync changes
      const walkDir = async (dir: string, basePath: string = ''): Promise<void> => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = basePath ? path.join(basePath, entry.name) : entry.name;
          
          // Skip node_modules and .git for performance (they can be regenerated)
          if (entry.name === 'node_modules' || entry.name === '.git') {
            continue;
          }
          
          if (entry.isDirectory()) {
            // Recursively walk subdirectories
            await walkDir(fullPath, relativePath);
          } else {
            // Read file content and update database
            try {
              const content = await fs.promises.readFile(fullPath, 'utf8');
              const existingFile = existingFileMap.get(relativePath);
              
              if (existingFile) {
                // Update existing file if content changed
                if (existingFile.content !== content) {
                  await storage.updateFile(existingFile.id, { content });
                  logger.debug(`Updated file: ${relativePath}`);
                }
              } else {
                // Create new file
                await storage.createFile({
                  projectId: parseInt(projectId, 10),
                  name: entry.name,
                  path: relativePath,
                  content,
                  isDirectory: false
                });
                logger.debug(`Created file: ${relativePath}`);
              }
            } catch (fileError) {
              logger.warn(`Could not sync file ${relativePath}: ${fileError}`);
            }
          }
        }
      };
      
      await walkDir(workDir);
      logger.info(`Synced terminal changes back to database for project ${projectId}`);
      
    } catch (error) {
      logger.error(`Failed to sync files back for project ${projectId}:`, error);
    }
  }

  private getShell(): string {
    if (process.platform === 'win32') {
      return 'powershell.exe';
    }
    
    const bashPath = '/nix/store/d6mad4dkf6akii90k26dinhrg8a3xia8-replit-runtime-path/bin/bash';
    if (fs.existsSync(bashPath)) {
      return bashPath;
    }
    
    if (fs.existsSync('/bin/bash')) {
      return '/bin/bash';
    }
    
    return '/bin/sh';
  }

  private getShellArgs(): string[] {
    if (process.platform === 'win32') {
      return [];
    }
    return ['--login'];
  }

  private handleMessage(projectId: string, ws: WebSocket, rawData: any): void {
    const session = this.sessions.get(projectId);
    if (!session) return;

    session.lastActivity = Date.now();

    try {
      const message = JSON.parse(rawData.toString());

      switch (message.type) {
        case 'input':
          if (message.data) {
            this.writeToSession(session, message.data);
          }
          break;

        case 'resize':
          if (message.cols && message.rows) {
            session.cols = message.cols;
            session.rows = message.rows;
            if (session.ptyProcess && typeof session.ptyProcess.resize === 'function') {
              try {
                session.ptyProcess.resize(message.cols, message.rows);
              } catch {}
            }
          }
          break;

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        default:
          logger.warn(`Unknown message type: ${message.type}`);
      }

    } catch (error) {
      if (typeof rawData === 'string' || Buffer.isBuffer(rawData)) {
        this.writeToSession(session, rawData.toString());
      }
    }
  }

  /**
   * Write data to the terminal session (Docker or PTY)
   */
  private writeToSession(session: PTYSession, data: string): void {
    if (session.isDocker && session.dockerProcess?.stdin) {
      session.dockerProcess.stdin.write(data);
    } else if (session.ptyProcess) {
      if (typeof session.ptyProcess.write === 'function') {
        session.ptyProcess.write(data);
      }
    }
  }

  private handleDisconnect(projectId: string, ws: WebSocket): void {
    const session = this.sessions.get(projectId);
    if (!session) return;

    session.clients.delete(ws);
    logger.info(`Client disconnected from project ${projectId}, remaining: ${session.clients.size}`);

    if (session.clients.size === 0) {
      setTimeout(() => {
        const currentSession = this.sessions.get(projectId);
        if (currentSession && currentSession.clients.size === 0) {
          this.cleanupSession(projectId);
        }
      }, 30000);
    }
  }

  private async cleanupSession(projectId: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) return;

    logger.info(`Cleaning up terminal session for project ${projectId}`);

    const outputSnapshot = session.outputBuffer.getHistory().join('').slice(-8192);
    const shellPid = session.ptyProcess?.pid || undefined;
    await redisSessionManager.saveSession({
      sessionId: `terminal-${projectId}`,
      projectId,
      commandHistory: session.commandHistory,
      currentDirectory: session.currentDirectory,
      columns: session.cols,
      rows: session.rows,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      containerId: session.containerId || undefined,
      shellPid,
      outputSnapshot,
      sessionEnded: true,
    }).catch(err => logger.error(`Failed to checkpoint PTY session to Redis: ${err}`));

    // Sync files back to database before cleanup (for persistent changes)
    try {
      const { getProjectWorkspacePath } = await import('../utils/project-fs-sync');
      const workDir = getProjectWorkspacePath(projectId);
      await this.syncFilesBack(projectId, workDir);
    } catch (syncError) {
      logger.error(`Error syncing files back for project ${projectId}:`, syncError);
    }

    try {
      if (session.isDocker) {
        // Kill Docker container
        if (session.dockerProcess) {
          session.dockerProcess.kill('SIGTERM');
        }
        // Also stop the container if it's still running
        if (session.containerId) {
          spawn('docker', ['stop', session.containerId], { stdio: 'ignore' });
        }
      } else if (session.ptyProcess) {
        if (typeof session.ptyProcess.kill === 'function') {
          session.ptyProcess.kill();
        }
      }
    } catch (error) {
      logger.error(`Error killing terminal process:`, error);
    }

    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.close(1000, 'Session ended');
      }
    }

    this.sessions.delete(projectId);
  }

  private broadcastToSession(session: PTYSession, message: any): void {
    const data = JSON.stringify(message);
    
    for (const client of session.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getSessionInfo(projectId: string): { connected: boolean; clientCount: number } | null {
    const session = this.sessions.get(projectId);
    if (!session) return null;

    return {
      connected: true,
      clientCount: session.clients.size
    };
  }

  async executeInSession(projectId: string, command: string): Promise<void> {
    const session = this.sessions.get(projectId);
    if (!session) {
      throw new Error('No active session for project');
    }

    this.writeToSession(session, command + '\r');
  }

  async drainAllSessions(): Promise<void> {
    const projectIds = Array.from(this.sessions.keys());
    logger.info(`[Drain] Checkpointing ${projectIds.length} active PTY sessions to Redis`);
    const promises = projectIds.map(async (projectId) => {
      const session = this.sessions.get(projectId);
      if (!session) return;
      const outputSnapshot = session.outputBuffer.getHistory().join('').slice(-8192);
      const shellPid = session.ptyProcess?.pid || undefined;
      await redisSessionManager.saveSession({
        sessionId: `terminal-${projectId}`,
        projectId,
        commandHistory: session.commandHistory,
        currentDirectory: session.currentDirectory,
        columns: session.cols,
        rows: session.rows,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        containerId: session.containerId || undefined,
        shellPid,
        outputSnapshot,
        sessionEnded: true,
      }).catch(err => logger.error(`[Drain] Failed to checkpoint session ${projectId}: ${err}`));
    });
    await Promise.allSettled(promises);
    logger.info(`[Drain] All PTY sessions checkpointed`);
  }
}

let ptyTerminalService: PTYTerminalService | null = null;

export function initPTYTerminalService(): PTYTerminalService {
  if (!ptyTerminalService) {
    ptyTerminalService = new PTYTerminalService();
  }
  return ptyTerminalService;
}

export function getPTYTerminalService(): PTYTerminalService | null {
  return ptyTerminalService;
}

export { ptyTerminalService };