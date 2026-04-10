// @ts-nocheck
import { createLogger } from '../utils/logger';

const logger = createLogger('expo-snack');

export interface SnackSession {
  id: string;
  url: string;
  webPreviewUrl: string;
  state: any;
  files: Record<string, any>;
}

class ExpoSnackService {
  private sessions = new Map<string, SnackSession>();

  async createSession(opts: { name?: string; description?: string; files?: Record<string, any>; dependencies?: Record<string, string> }): Promise<SnackSession> {
    const id = `snack-${Date.now()}`;
    const session: SnackSession = {
      id,
      url: `https://snack.expo.dev/${id}`,
      webPreviewUrl: `https://snack.expo.dev/embedded/${id}`,
      state: { name: opts.name || 'Untitled', description: opts.description || '' },
      files: opts.files || {},
    };
    this.sessions.set(id, session);
    return session;
  }

  async getSession(id: string): Promise<SnackSession | undefined> {
    return this.sessions.get(id);
  }

  async updateFiles(id: string, files: Record<string, any>): Promise<SnackSession | undefined> {
    const session = this.sessions.get(id);
    if (session) {
      session.files = { ...session.files, ...files };
    }
    return session;
  }

  async deleteSession(id: string): Promise<boolean> {
    return this.sessions.delete(id);
  }

  async listSessions(): Promise<SnackSession[]> {
    return Array.from(this.sessions.values());
  }
}

export const expoSnackService = new ExpoSnackService();
