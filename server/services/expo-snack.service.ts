// @ts-nocheck
import { Snack, SnackFiles, SnackState } from 'snack-sdk';
import { createLogger } from '../utils/logger';

const logger = createLogger('expo-snack');

export interface SnackSession {
  id: string;
  url: string;
  webPreviewUrl: string;
  qrCodeUrl: string;
  expoUrl: string;
  connectedClients: number;
  state: 'online' | 'offline' | 'error';
}

export interface CreateSnackOptions {
  name?: string;
  description?: string;
  files: Record<string, string>;
  dependencies?: Record<string, string>;
  sdkVersion?: string;
}

const activeSessions = new Map<string, Snack>();

export class ExpoSnackService {
  private defaultSdkVersion = '51.0.0';

  isConfigured(): boolean {
    return true;
  }

  async createSession(projectId: string, options: CreateSnackOptions): Promise<SnackSession> {
    try {
      const existingSnack = activeSessions.get(projectId);
      if (existingSnack) {
        await this.closeSession(projectId);
      }

      const snackFiles: SnackFiles = {};
      for (const [path, contents] of Object.entries(options.files)) {
        snackFiles[path] = {
          type: 'CODE',
          contents,
        };
      }

      if (options.dependencies) {
        snackFiles['package.json'] = {
          type: 'CODE',
          contents: JSON.stringify({
            dependencies: options.dependencies,
          }, null, 2),
        };
      }

      const snack = new Snack({
        name: options.name || `E-Code Project ${projectId}`,
        description: options.description || 'Live preview from E-Code IDE',
        files: snackFiles,
        sdkVersion: options.sdkVersion || this.defaultSdkVersion,
      });

      snack.setOnline(true);

      const state = await snack.getStateAsync();
      
      activeSessions.set(projectId, snack);

      const sessionId = `snack-${projectId}-${Date.now()}`;
      const snackUrl = state.url || `https://snack.expo.dev/@snack/${sessionId}`;

      logger.info(`Created Expo Snack session for project ${projectId}`, { url: snackUrl });

      return {
        id: sessionId,
        url: snackUrl,
        webPreviewUrl: `${snackUrl}?platform=web&preview=true`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(snackUrl)}`,
        expoUrl: `exp://exp.host/@snack/${sessionId}`,
        connectedClients: state.connectedClients?.length || 0,
        state: 'online',
      };
    } catch (error) {
      logger.error(`Failed to create Expo Snack session for project ${projectId}:`, error);
      throw error;
    }
  }

  async updateFiles(projectId: string, files: Record<string, string>): Promise<void> {
    const snack = activeSessions.get(projectId);
    if (!snack) {
      throw new Error(`No active Snack session for project ${projectId}`);
    }

    const snackFiles: SnackFiles = {};
    for (const [path, contents] of Object.entries(files)) {
      snackFiles[path] = {
        type: 'CODE',
        contents,
      };
    }

    snack.updateFiles(snackFiles);
    logger.info(`Updated files in Snack session for project ${projectId}`, { fileCount: Object.keys(files).length });
  }

  async getSessionState(projectId: string): Promise<SnackSession | null> {
    const snack = activeSessions.get(projectId);
    if (!snack) {
      return null;
    }

    try {
      const state = await snack.getStateAsync();
      const sessionId = `snack-${projectId}`;
      const snackUrl = state.url || `https://snack.expo.dev/@snack/${sessionId}`;

      return {
        id: sessionId,
        url: snackUrl,
        webPreviewUrl: `${snackUrl}?platform=web&preview=true`,
        qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(snackUrl)}`,
        expoUrl: `exp://exp.host/@snack/${sessionId}`,
        connectedClients: state.connectedClients?.length || 0,
        state: state.online ? 'online' : 'offline',
      };
    } catch (error) {
      logger.error(`Failed to get Snack session state for project ${projectId}:`, error);
      return null;
    }
  }

  async closeSession(projectId: string): Promise<void> {
    const snack = activeSessions.get(projectId);
    if (snack) {
      snack.setOnline(false);
      activeSessions.delete(projectId);
      logger.info(`Closed Expo Snack session for project ${projectId}`);
    }
  }

  async closeAllSessions(): Promise<void> {
    for (const [projectId, snack] of activeSessions.entries()) {
      snack.setOnline(false);
      logger.info(`Closed Expo Snack session for project ${projectId}`);
    }
    activeSessions.clear();
  }

  getActiveSessions(): string[] {
    return Array.from(activeSessions.keys());
  }

  subscribeToStateChanges(projectId: string, callback: (state: SnackState) => void): () => void {
    const snack = activeSessions.get(projectId);
    if (!snack) {
      throw new Error(`No active Snack session for project ${projectId}`);
    }

    const unsubscribe = snack.addStateListener((state, prevState) => {
      callback(state);
    });

    return unsubscribe;
  }

  generateEmbedHtml(options: {
    snackId?: string;
    code?: string;
    dependencies?: string;
    name?: string;
    platform?: 'web' | 'ios' | 'android';
    preview?: boolean;
    theme?: 'light' | 'dark';
    height?: number;
  }): string {
    const {
      snackId,
      code,
      dependencies,
      name = 'E-Code Preview',
      platform = 'web',
      preview = true,
      theme = 'dark',
      height = 600,
    } = options;

    const dataAttributes: string[] = [];
    
    if (snackId) {
      dataAttributes.push(`data-snack-id="${snackId}"`);
    } else if (code) {
      dataAttributes.push(`data-snack-code="${this.escapeHtml(code)}"`);
    }

    if (dependencies) {
      dataAttributes.push(`data-snack-dependencies="${dependencies}"`);
    }

    dataAttributes.push(`data-snack-name="${name}"`);
    dataAttributes.push(`data-snack-platform="${platform}"`);
    dataAttributes.push(`data-snack-preview="${preview}"`);
    dataAttributes.push(`data-snack-theme="${theme}"`);
    dataAttributes.push(`data-snack-loading="lazy"`);

    return `
<div 
  ${dataAttributes.join('\n  ')}
  style="overflow:hidden;background:#1a1a2e;border:1px solid rgba(255,255,255,0.1);border-radius:8px;height:${height}px;width:100%">
</div>
<script async src="https://snack.expo.dev/embed.js"></script>
    `.trim();
  }

  generateIframeUrl(options: {
    snackId?: string;
    code?: string;
    name?: string;
    platform?: 'web' | 'ios' | 'android';
    preview?: boolean;
    theme?: 'light' | 'dark';
  }): string {
    const params = new URLSearchParams();
    
    if (options.platform) params.set('platform', options.platform);
    if (options.name) params.set('name', options.name);
    if (options.preview !== undefined) params.set('preview', String(options.preview));
    if (options.theme) params.set('theme', options.theme);

    if (options.snackId) {
      return `https://snack.expo.dev/embedded/${options.snackId}?${params.toString()}`;
    }

    if (options.code) {
      const base64Code = Buffer.from(options.code).toString('base64');
      params.set('code', base64Code);
    }

    return `https://snack.expo.dev/embedded?${params.toString()}`;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

export const expoSnackService = new ExpoSnackService();
