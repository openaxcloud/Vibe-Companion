// @ts-nocheck
/**
 * SSH Manager Service — LEGACY (in-memory key/session APIs only)
 *
 * This class is retained for compatibility with callers that have not yet
 * migrated to the canonical service (`server/ssh/ssh-key-service.ts`).
 * All new code should import from `ssh-key-service` instead.
 *
 * The real SSH daemon (`server/sshServer.ts`) starts unconditionally on
 * port 2222 and authenticates via fingerprints stored in the database.
 * Use GET /api/ssh-keys/connection-info for the authoritative availability
 * state (host/port/user).
 *
 * REMOVED: `initializeSSHConnection` TCP-exec bridge — it ran raw shell
 * commands on every byte received from an unauthenticated socket
 * (remote-code-execution hazard). No code path now spawns an unauthenticated
 * exec server.
 */

import { spawn, ChildProcess } from 'child_process';
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
  private sessionTimeout = 30 * 60 * 1000;

  constructor() {
    this.ensureSSHKeysDir();
    this.startSessionCleanup();
  }

  private async ensureSSHKeysDir() {
    try {
      await fs.mkdir(this.sshKeysDir, { recursive: true });
    } catch {
      // Directory might already exist
    }
  }

  private startSessionCleanup() {
    setInterval(() => {
      this.cleanupInactiveSessions();
    }, 5 * 60 * 1000);
  }

  private cleanupInactiveSessions() {
    const now = Date.now();
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      if (now - session.lastActivity.getTime() > this.sessionTimeout) {
        this.terminateSession(sessionId);
      }
    }
  }

  async generateSSHKey(userId: number, name: string, type: 'rsa' | 'ed25519' | 'ecdsa' = 'ed25519'): Promise<SSHKey> {
    const keyId = `key_${userId}_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 6)}`;
    const keyPath = path.join(this.sshKeysDir, keyId);

    let keyGenCommand: string[];
    switch (type) {
      case 'ed25519':
        keyGenCommand = ['ssh-keygen', '-t', 'ed25519', '-f', keyPath, '-N', '', '-C', `e-code-${userId}-${name}`];
        break;
      case 'rsa':
        keyGenCommand = ['ssh-keygen', '-t', 'rsa', '-b', '4096', '-f', keyPath, '-N', '', '-C', `e-code-${userId}-${name}`];
        break;
      case 'ecdsa':
        keyGenCommand = ['ssh-keygen', '-t', 'ecdsa', '-b', '521', '-f', keyPath, '-N', '', '-C', `e-code-${userId}-${name}`];
        break;
    }

    await this.executeCommand(keyGenCommand[0], keyGenCommand.slice(1));
    const publicKey = await fs.readFile(`${keyPath}.pub`, 'utf8');
    const fingerprint = await this.generateFingerprint(`${keyPath}.pub`);

    const sshKey: SSHKey = {
      id: keyId,
      name,
      publicKey: publicKey.trim(),
      fingerprint,
      type,
      created: new Date(),
      isActive: true,
    };

    const userKeys = this.userKeys.get(userId) || [];
    userKeys.push(sshKey);
    this.userKeys.set(userId, userKeys);
    return sshKey;
  }

  private executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let stdout = '';
      let stderr = '';
      proc.stdout?.on('data', (d) => { stdout += d.toString(); });
      proc.stderr?.on('data', (d) => { stderr += d.toString(); });
      proc.on('close', (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(stderr || `Command failed with code ${code}`));
      });
      proc.on('error', reject);
    });
  }

  private async generateFingerprint(publicKeyPath: string): Promise<string> {
    try {
      const result = await this.executeCommand('ssh-keygen', ['-lf', publicKeyPath]);
      const match = result.match(/^(\d+)\s+([a-f0-9:]+)/);
      return match ? match[2] : 'unknown';
    } catch {
      return 'unknown';
    }
  }

  getUserSSHKeys(userId: number): SSHKey[] {
    return this.userKeys.get(userId) || [];
  }

  async deleteSSHKey(userId: number, keyId: string): Promise<boolean> {
    const userKeys = this.userKeys.get(userId) || [];
    const keyIndex = userKeys.findIndex((key) => key.id === keyId);
    if (keyIndex === -1) return false;

    const keyPath = path.join(this.sshKeysDir, keyId);
    await fs.unlink(keyPath).catch(() => {});
    await fs.unlink(`${keyPath}.pub`).catch(() => {});

    userKeys.splice(keyIndex, 1);
    this.userKeys.set(userId, userKeys);
    return true;
  }

  getSSHSession(sessionId: string): SSHSession | null {
    return this.sessions.get(sessionId) || null;
  }

  updateSessionActivity(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.lastActivity = new Date();
    this.sessions.set(sessionId, session);
    return true;
  }

  async terminateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    session.status = 'disconnected';
    this.sessions.delete(sessionId);
    return true;
  }

  getUserSessions(userId: number): SSHSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.userId === userId);
  }

  getSSHConfig(projectId: string): SSHConfig {
    return {
      host: 'ssh.e-code.ai',
      port: 22,
      username: `project-${projectId}`,
      projectPath: `/projects/${projectId}`,
      timeoutMinutes: 30,
      environment: {
        HOME: `/projects/${projectId}`,
        PATH: '/usr/local/bin:/usr/bin:/bin',
        TERM: 'xterm-256color',
        E_CODE_PROJECT_ID: projectId,
      },
    };
  }

  getSSHStats(): { totalKeys: number; activeSessions: number; totalSessions: number; uniqueUsers: number } {
    const totalKeys = Array.from(this.userKeys.values()).reduce((sum, keys) => sum + keys.length, 0);
    const activeSessions = Array.from(this.sessions.values()).filter((s) => s.status === 'connected').length;
    const uniqueUsers = new Set(Array.from(this.sessions.values()).map((s) => s.userId)).size;
    return { totalKeys, activeSessions, totalSessions: this.sessions.size, uniqueUsers };
  }

  async toggleSSHKey(userId: number, keyId: string, isActive: boolean): Promise<boolean> {
    const userKeys = this.userKeys.get(userId) || [];
    const key = userKeys.find((k) => k.id === keyId);
    if (!key) return false;
    key.isActive = isActive;
    this.userKeys.set(userId, userKeys);
    if (!isActive) {
      const sessionsToTerminate = Array.from(this.sessions.values()).filter((s) => s.userId === userId && s.keyId === keyId);
      for (const session of sessionsToTerminate) {
        await this.terminateSession(session.id);
      }
    }
    return true;
  }
}
