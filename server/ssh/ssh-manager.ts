// @ts-nocheck
/**
 * SSH Manager Service
 * Implements SSH access and key management for E-Code projects
 * - SSH key generation and management
 * - Secure shell access to project environments
 * - Terminal session management
 * - Authentication and authorization
 */

import { spawn, exec, ChildProcess } from 'child_process';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

export interface SSHKey {
  id: string;
  name: string;
  publicKey: string;
  fingerprint: string;
  type: 'rsa' | 'ed25519' | 'ecdsa';
  created: Date;
  lastUsed?: Date;
  isActive: boolean;
}

export interface SSHSession {
  id: string;
  userId: number;
  projectId: string;
  keyId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  startedAt: Date;
  lastActivity: Date;
  clientInfo: {
    ip: string;
    userAgent?: string;
    terminal?: string;
  };
}

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  projectPath: string;
  allowedCommands?: string[];
  timeoutMinutes: number;
  environment: Record<string, string>;
}

export class SSHManager {
  private sessions: Map<string, SSHSession> = new Map();
  private userKeys: Map<number, SSHKey[]> = new Map();
  private sshKeysDir = './temp/ssh-keys';
  private sessionTimeout = 30 * 60 * 1000; // 30 minutes

  constructor() {
    this.ensureSSHKeysDir();
    this.startSessionCleanup();
  }

  private async ensureSSHKeysDir() {
    try {
      await fs.mkdir(this.sshKeysDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }
  }

  private startSessionCleanup() {
    // Clean up inactive sessions every 5 minutes
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);
  }

  private cleanupInactiveSessions() {
    const now = Date.now();
    
    const sessions = Array.from(this.sessions.entries());
    for (const [sessionId, session] of sessions) {
      const timeSinceActivity = now - session.lastActivity.getTime();
      
      if (timeSinceActivity > this.sessionTimeout) {
        this.terminateSession(sessionId);
      }
    }
  }

  // Generate SSH key pair
  async generateSSHKey(userId: number, name: string, type: 'rsa' | 'ed25519' | 'ecdsa' = 'ed25519'): Promise<SSHKey> {
    const keyId = `key_${userId}_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 6)}`;
    const keyPath = path.join(this.sshKeysDir, keyId);
    
    try {
      // Generate key pair based on type
      let keyGenCommand: string[];
      
      switch (type) {
        case 'ed25519':
          keyGenCommand = [
            'ssh-keygen',
            '-t', 'ed25519',
            '-f', keyPath,
            '-N', '', // No passphrase
            '-C', `e-code-${userId}-${name}`
          ];
          break;
        case 'rsa':
          keyGenCommand = [
            'ssh-keygen',
            '-t', 'rsa',
            '-b', '4096',
            '-f', keyPath,
            '-N', '',
            '-C', `e-code-${userId}-${name}`
          ];
          break;
        case 'ecdsa':
          keyGenCommand = [
            'ssh-keygen',
            '-t', 'ecdsa',
            '-b', '521',
            '-f', keyPath,
            '-N', '',
            '-C', `e-code-${userId}-${name}`
          ];
          break;
      }

      // Execute key generation
      await this.executeCommand(keyGenCommand[0], keyGenCommand.slice(1));
      
      // Read public key
      const publicKey = await fs.readFile(`${keyPath}.pub`, 'utf8');
      
      // Generate fingerprint
      const fingerprint = await this.generateFingerprint(`${keyPath}.pub`);
      
      const sshKey: SSHKey = {
        id: keyId,
        name,
        publicKey: publicKey.trim(),
        fingerprint,
        type,
        created: new Date(),
        isActive: true
      };

      // Store key for user
      const userKeys = this.userKeys.get(userId) || [];
      userKeys.push(sshKey);
      this.userKeys.set(userId, userKeys);

      return sshKey;

    } catch (error) {
      throw new Error(`Failed to generate SSH key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(stderr || `Command failed with code ${code}`));
        }
      });

      process.on('error', reject);
    });
  }

  private async generateFingerprint(publicKeyPath: string): Promise<string> {
    try {
      const result = await this.executeCommand('ssh-keygen', ['-lf', publicKeyPath]);
      const match = result.match(/^(\d+)\s+([a-f0-9:]+)/);
      return match ? match[2] : 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  // Get user's SSH keys
  getUserSSHKeys(userId: number): SSHKey[] {
    return this.userKeys.get(userId) || [];
  }

  // Delete SSH key
  async deleteSSHKey(userId: number, keyId: string): Promise<boolean> {
    const userKeys = this.userKeys.get(userId) || [];
    const keyIndex = userKeys.findIndex(key => key.id === keyId);
    
    if (keyIndex === -1) return false;

    try {
      // Remove key files
      const keyPath = path.join(this.sshKeysDir, keyId);
      await fs.unlink(keyPath).catch((err) => {
        console.warn('[SSH] Failed to delete private key:', keyPath, err?.message);
      });
      await fs.unlink(`${keyPath}.pub`).catch((err) => {
        console.warn('[SSH] Failed to delete public key:', `${keyPath}.pub`, err?.message);
      });

      // Remove from memory
      userKeys.splice(keyIndex, 1);
      this.userKeys.set(userId, userKeys);

      return true;
    } catch (error) {
      return false;
    }
  }

  // Create SSH session
  async createSSHSession(
    userId: number, 
    projectId: string, 
    keyId: string, 
    clientInfo: SSHSession['clientInfo']
  ): Promise<string> {
    const userKeys = this.userKeys.get(userId) || [];
    const sshKey = userKeys.find(key => key.id === keyId && key.isActive);
    
    if (!sshKey) {
      throw new Error('SSH key not found or not active');
    }

    const sessionId = `session_${userId}_${projectId}_${Date.now()}`;
    
    const session: SSHSession = {
      id: sessionId,
      userId,
      projectId,
      keyId,
      status: 'connecting',
      startedAt: new Date(),
      lastActivity: new Date(),
      clientInfo
    };

    this.sessions.set(sessionId, session);

    // Update key last used
    sshKey.lastUsed = new Date();

    try {
      // Initialize SSH connection (simulated)
      await this.initializeSSHConnection(session);
      session.status = 'connected';
      
    } catch (error) {
      session.status = 'error';
      throw error;
    }

    return sessionId;
  }

  private async initializeSSHConnection(session: SSHSession): Promise<void> {
    // Set up SSH connection for the project environment
    const projectPath = `/projects/${session.projectId}`;
    const sshConfig = this.getSSHConfig(session.projectId);
    
    try {
      const fs = require('fs').promises;
      
      // Create project directory if it doesn't exist
      await fs.mkdir(projectPath, { recursive: true });
      
      // Create a container environment for the SSH session
      const containerName = `ssh-${session.projectId}-${Date.now()}`;
      
      // Initialize container with project environment
      const containerProcess = spawn('node', [
        '-e',
        `
        const net = require('net');
        const { exec } = require('child_process');
        
        // Create a TCP server for the SSH session
        const server = net.createServer((socket) => {
          // Handle SSH protocol
          socket.on('data', (data) => {
            // Parse SSH commands and execute in project environment
            const command = data.toString().trim();
            exec(command, { cwd: '${projectPath}' }, (error, stdout, stderr) => {
              if (error) {
                socket.write('Error: ' + error.message + '\\n');
              } else {
                socket.write(stdout || stderr);
              }
            });
          });
        });
        
        server.listen(0, () => {
          console.log('SSH_PORT:' + server.address().port);
        });
        `
      ]);
      
      // Store container process reference
      (session as any).containerProcess = containerProcess;
      (session as any).containerName = containerName;
      
      // Wait for container to be ready
      await new Promise((resolve, reject) => {
        let sshPort: number;
        
        containerProcess.stdout.on('data', (data: Buffer) => {
          const output = data.toString();
          const portMatch = output.match(/SSH_PORT:(\d+)/);
          if (portMatch) {
            sshPort = parseInt(portMatch[1]);
            (session as any).sshPort = sshPort;
            resolve(sshPort);
          }
        });
        
        containerProcess.stderr.on('data', (data: Buffer) => {
          logger.error('Container error:', data.toString());
        });
        
        containerProcess.on('error', reject);
        
        // Timeout after 10 seconds
        setTimeout(() => reject(new Error('Container initialization timeout')), 10000);
      });
      
      // Set up environment variables for the session
      process.env.E_CODE_PROJECT_ID = session.projectId;
      process.env.HOME = projectPath;
      
      // Mark session as ready
      session.status = 'connected';
      logger.info(`SSH session initialized for project ${session.projectId} on port ${(session as any).sshPort}`);
      
    } catch (error) {
      logger.error('Failed to initialize SSH connection:', error);
      throw error;
    }
  }

  // Get SSH session
  getSSHSession(sessionId: string): SSHSession | null {
    return this.sessions.get(sessionId) || null;
  }

  // Update session activity
  updateSessionActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.lastActivity = new Date();
    this.sessions.set(sessionId, session);
    return true;
  }

  // Terminate SSH session
  async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    try {
      // Clean up SSH connection resources
      const extendedSession = session as any;
      
      // Terminate container process if exists
      if (extendedSession.containerProcess) {
        extendedSession.containerProcess.kill('SIGTERM');
        
        // Force kill after 5 seconds if still running
        setTimeout(() => {
          if (extendedSession.containerProcess && !extendedSession.containerProcess.killed) {
            extendedSession.containerProcess.kill('SIGKILL');
          }
        }, 5000);
      }
      
      session.status = 'disconnected';
      this.sessions.delete(sessionId);
      return true;
    } catch (error) {
      logger.error('Error terminating SSH session:', error);
      return false;
    }
  }

  // Get user's active sessions
  getUserSessions(userId: number): SSHSession[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId);
  }

  // Get SSH configuration for project
  getSSHConfig(projectId: string): SSHConfig {
    return {
      host: 'ssh.e-code.ai',
      port: 22,
      username: `project-${projectId}`,
      projectPath: `/projects/${projectId}`,
      timeoutMinutes: 30,
      environment: {
        'HOME': `/projects/${projectId}`,
        'PATH': '/usr/local/bin:/usr/bin:/bin',
        'TERM': 'xterm-256color',
        'E_CODE_PROJECT_ID': projectId
      }
    };
  }

  // Generate SSH connection command
  generateSSHCommand(projectId: string, keyId: string): string {
    const config = this.getSSHConfig(projectId);
    const keyPath = path.join(this.sshKeysDir, keyId);
    
    return `ssh -i ${keyPath} -p ${config.port} ${config.username}@${config.host}`;
  }

  // Get SSH connection instructions
  getSSHInstructions(projectId: string, keyId: string): {
    command: string;
    steps: string[];
    troubleshooting: string[];
  } {
    const command = this.generateSSHCommand(projectId, keyId);
    
    return {
      command,
      steps: [
        'Make sure your SSH key is properly configured',
        'Copy the SSH command below',
        'Open your terminal',
        'Paste and run the command',
        'You should now be connected to your project environment'
      ],
      troubleshooting: [
        'Ensure your SSH key is active and not expired',
        'Check that you have network connectivity',
        'Verify the project is running and accessible',
        'Make sure port 22 is not blocked by your firewall',
        'Try regenerating your SSH key if connection fails'
      ]
    };
  }

  // Execute command in SSH session
  async executeSSHCommand(sessionId: string, command: string): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected') {
      throw new Error('SSH session not found or not connected');
    }

    // Update activity
    this.updateSessionActivity(sessionId);

    // Execute command in project environment
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const projectPath = `/projects/${session.projectId}`;
    const env = {
      ...process.env,
      ...this.getSSHConfig(session.projectId).environment
    };

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: projectPath,
        env,
        timeout: 30000, // 30 second timeout
        maxBuffer: 1024 * 1024 // 1MB buffer
      });

      return {
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0
      };
    } catch (error: any) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
        exitCode: error.code || 1
      };
    }
  }

  // Get SSH statistics
  getSSHStats(): {
    totalKeys: number;
    activeSessions: number;
    totalSessions: number;
    uniqueUsers: number;
  } {
    const totalKeys = Array.from(this.userKeys.values())
      .reduce((sum, keys) => sum + keys.length, 0);
    
    const activeSessions = Array.from(this.sessions.values())
      .filter(s => s.status === 'connected').length;
    
    const uniqueUsers = new Set(
      Array.from(this.sessions.values()).map(s => s.userId)
    ).size;

    return {
      totalKeys,
      activeSessions,
      totalSessions: this.sessions.size,
      uniqueUsers
    };
  }

  // Enable/disable SSH key
  async toggleSSHKey(userId: number, keyId: string, isActive: boolean): Promise<boolean> {
    const userKeys = this.userKeys.get(userId) || [];
    const key = userKeys.find(k => k.id === keyId);
    
    if (!key) return false;

    key.isActive = isActive;
    this.userKeys.set(userId, userKeys);
    
    // If disabling, terminate any active sessions using this key
    if (!isActive) {
      const sessionsToTerminate = Array.from(this.sessions.values())
        .filter(s => s.userId === userId && s.keyId === keyId);
      
      for (const session of sessionsToTerminate) {
        await this.terminateSession(session.id);
      }
    }

    return true;
  }
}

export const sshManager = new SSHManager();