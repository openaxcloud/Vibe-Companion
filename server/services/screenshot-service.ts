// @ts-nocheck
import { createLogger } from '../utils/logger';
import { checkpointService } from './checkpoint-service';
import { storageService, type StorageObject } from './storage.service';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

type Browser = any;
type Page = any;

const logger = createLogger('ScreenshotService');

export interface ScreenshotStorageOptions {
  storeInObjectStorage?: boolean;
  storeAsBase64?: boolean;
  projectId?: number;
  userId?: number;
  checkpointId?: number;
  metadata?: Record<string, string>;
}

export interface StoredScreenshot {
  screenshotPath: string;
  objectStorageKey?: string;
  base64Data?: string;
  thumbnail: string;
  thumbnailBase64?: string;
  storageObject?: StorageObject;
  metadata: {
    width: number;
    height: number;
    timestamp: Date;
    projectId: number;
    checkpointId?: number;
    storageType: 'local' | 'object_storage' | 'base64';
  };
}

export class ScreenshotService {
  private browser: Browser | null = null;
  private objectStorageEnabled: boolean = false;

  async initialize() {
    try {
      const playwright = await import('playwright').catch(() => null);
      
      if (playwright) {
        this.browser = await playwright.chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        logger.info('Screenshot service initialized with Playwright');
      } else {
        logger.info('Playwright not available, running in basic mode without browser automation');
      }

      this.objectStorageEnabled = storageService.activeBackend !== 'local';
      if (this.objectStorageEnabled) {
        logger.info('Object storage integration enabled for screenshots');
      }
    } catch (error) {
      logger.error('Failed to initialize screenshot service:', error);
      logger.info('Running in basic mode without browser automation');
    }
  }

  async storeScreenshotInObjectStorage(
    buffer: Buffer,
    projectId: number,
    options: ScreenshotStorageOptions = {}
  ): Promise<StorageObject> {
    const timestamp = Date.now();
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 8);
    const key = options.checkpointId 
      ? `screenshots/checkpoints/${projectId}/${options.checkpointId}-${timestamp}-${hash}.png`
      : `screenshots/projects/${projectId}/${timestamp}-${hash}.png`;

    const storageObject = await storageService.uploadFile(
      key,
      buffer,
      {
        contentType: 'image/png',
        public: true,
        metadata: {
          projectId: projectId.toString(),
          checkpointId: options.checkpointId?.toString() || '',
          capturedAt: new Date().toISOString(),
          ...options.metadata
        }
      }
    );

    logger.info(`Screenshot stored in object storage: ${key}`);
    return storageObject;
  }

  async getScreenshotFromObjectStorage(key: string): Promise<Buffer | null> {
    try {
      const buffer = await storageService.downloadFile(key);
      return buffer;
    } catch (error) {
      logger.warn(`Failed to retrieve screenshot from object storage: ${key}`);
      return null;
    }
  }

  async listCheckpointScreenshots(projectId: number, checkpointId?: number): Promise<StorageObject[]> {
    const prefix = checkpointId
      ? `screenshots/checkpoints/${projectId}/${checkpointId}`
      : `screenshots/checkpoints/${projectId}`;
    
    return storageService.listFiles(prefix);
  }

  async captureProjectPreview(
    projectId: number, 
    userId: number,
    options: ScreenshotStorageOptions = {}
  ): Promise<StoredScreenshot> {
    try {
      const previewUrl = this.getProjectPreviewUrl(projectId);
      logger.info(`Capturing screenshot for project ${projectId} at ${previewUrl}`);

      const storageType = options.storeInObjectStorage ? 'object_storage' : 
                         options.storeAsBase64 ? 'base64' : 'local';

      if (this.browser) {
        const page = await this.browser.newPage();
        
        try {
          await page.setViewportSize({ width: 1920, height: 1080 });
          
          await page.goto(previewUrl, { 
            waitUntil: 'networkidle',
            timeout: 30000 
          });

          await page.waitForTimeout(2000);

          const screenshotBuffer = await page.screenshot({
            fullPage: false,
            type: 'png'
          });

          const thumbnailBuffer = await page.screenshot({
            fullPage: false,
            type: 'jpeg',
            quality: 80,
            clip: { x: 0, y: 0, width: 400, height: 300 }
          });

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const screenshotDir = path.join(process.cwd(), 'screenshots', projectId.toString());
          await fs.mkdir(screenshotDir, { recursive: true });

          const screenshotPath = path.join(screenshotDir, `screenshot-${timestamp}.png`);
          const thumbnailPath = path.join(screenshotDir, `thumbnail-${timestamp}.jpg`);

          await fs.writeFile(screenshotPath, screenshotBuffer);
          await fs.writeFile(thumbnailPath, thumbnailBuffer);

          const thumbnailBase64 = thumbnailBuffer.toString('base64');
          const screenshotBase64 = screenshotBuffer.toString('base64');

          let storageObject: StorageObject | undefined;
          let objectStorageKey: string | undefined;

          if (options.storeInObjectStorage && this.objectStorageEnabled) {
            storageObject = await this.storeScreenshotInObjectStorage(
              screenshotBuffer, 
              projectId, 
              { 
                ...options, 
                userId,
                metadata: {
                  ...options.metadata,
                  captureType: 'project_preview'
                }
              }
            );
            objectStorageKey = storageObject.key;
          }

          return {
            screenshotPath,
            objectStorageKey,
            base64Data: options.storeAsBase64 ? `data:image/png;base64,${screenshotBase64}` : undefined,
            thumbnail: `data:image/jpeg;base64,${thumbnailBase64}`,
            thumbnailBase64,
            storageObject,
            metadata: {
              width: 1920,
              height: 1080,
              timestamp: new Date(),
              projectId,
              checkpointId: options.checkpointId,
              storageType
            }
          };
        } finally {
          if (page && !page.isClosed()) {
            await page.close();
          }
        }
      } else {
        logger.warn('Browser not available, generating deterministic project preview');
        
        const projectPreview = await this.generateProjectPreview(projectId);
        const svgBase64 = Buffer.from(projectPreview).toString('base64');
        
        return {
          screenshotPath: `/screenshots/project-${projectId}-preview.png`,
          base64Data: options.storeAsBase64 ? `data:image/svg+xml;base64,${svgBase64}` : undefined,
          thumbnail: `data:image/svg+xml;base64,${svgBase64}`,
          thumbnailBase64: svgBase64,
          metadata: {
            width: 1920,
            height: 1080,
            timestamp: new Date(),
            projectId,
            checkpointId: options.checkpointId,
            storageType: 'base64'
          }
        };
      }
    } catch (error) {
      logger.error(`Failed to capture screenshot for project ${projectId}:`, error);
      throw error;
    }
  }

  async captureForCheckpoint(
    projectId: number,
    userId: number,
    checkpointId: number
  ): Promise<StoredScreenshot> {
    return this.captureProjectPreview(projectId, userId, {
      storeInObjectStorage: true,
      storeAsBase64: true,
      checkpointId,
      metadata: {
        captureType: 'checkpoint',
        checkpointId: checkpointId.toString()
      }
    });
  }

  async captureWorkflowState(projectId: number): Promise<{
    screenshots: Array<{
      workflow: string;
      status: string;
      screenshot?: string;
      error?: string;
    }>;
  }> {
    try {
      // This would capture the state of all running workflows
      const workflows = ['frontend', 'backend', 'database'];
      const screenshots = [];

      for (const workflow of workflows) {
        try {
          const previewUrl = this.getWorkflowPreviewUrl(projectId, workflow);
          
          if (this.browser) {
            const page = await this.browser.newPage();
            await page.setViewportSize({ width: 1280, height: 720 });
            await page.goto(previewUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
            
            const screenshotBuffer = await page.screenshot({ type: 'jpeg', quality: 70 });
            await page.close();

            screenshots.push({
              workflow,
              status: 'running',
              screenshot: `data:image/jpeg;base64,${screenshotBuffer.toString('base64')}`
            });
          } else {
            screenshots.push({
              workflow,
              status: 'unknown',
              error: 'Screenshot service not available'
            });
          }
        } catch (error) {
          logger.error(`Failed to capture workflow ${workflow}:`, error);
          screenshots.push({
            workflow,
            status: 'error',
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      return { screenshots };
    } catch (error) {
      logger.error('Failed to capture workflow states:', error);
      throw error;
    }
  }

  async captureErrorState(projectId: number, error: Error): Promise<{
    errorScreenshot: string;
    errorMessage: string;
    stackTrace?: string;
  }> {
    try {
      const errorHtml = this.generateErrorHtml(error);
      
      if (this.browser) {
        const page = await this.browser.newPage();
        await page.setContent(errorHtml);
        await page.setViewportSize({ width: 800, height: 600 });
        
        const screenshotBuffer = await page.screenshot({ type: 'png' });
        await page.close();

        return {
          errorScreenshot: `data:image/png;base64,${screenshotBuffer.toString('base64')}`,
          errorMessage: error.message,
          stackTrace: error.stack
        };
      } else {
        return {
          errorScreenshot: 'data:image/svg+xml;base64,' + Buffer.from(this.getErrorSvg(error.message)).toString('base64'),
          errorMessage: error.message,
          stackTrace: error.stack
        };
      }
    } catch (captureError) {
      logger.error('Failed to capture error state:', captureError);
      throw captureError;
    }
  }

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private getProjectPreviewUrl(projectId: number): string {
    const baseUrl = process.env.PREVIEW_SERVICE_URL || process.env.APP_URL || 'http://localhost:3100';
    return `${baseUrl}/preview/${projectId}`;
  }

  private getWorkflowPreviewUrl(projectId: number, workflow: string): string {
    const baseUrl = process.env.PREVIEW_SERVICE_URL || process.env.APP_URL || 'http://localhost:3100';
    return `${baseUrl}/preview/${projectId}/${workflow}`;
  }

  private async generateProjectPreview(projectId: number): Promise<string> {
    try {
      // Fetch project details from storage
      const { storage } = await import('../storage');
      const project = await storage.getProjectById(projectId);
      
      if (!project) {
        return this.getGenericPreviewSvg(projectId);
      }

      // Get project stats
      const files = await storage.getProjectFiles(projectId).catch(() => []);
      const fileCount = files.length;
      
      // Determine project type based on files
      const hasReact = files.some((f: any) => f.path?.includes('.jsx') || f.path?.includes('.tsx'));
      const hasVue = files.some((f: any) => f.path?.includes('.vue'));
      const hasPython = files.some((f: any) => f.path?.endsWith('.py'));
      const hasNode = files.some((f: any) => f.path?.includes('package.json'));
      
      let projectType = 'Project';
      let iconColor = '#3b82f6';
      let icon = '📁';
      
      if (hasReact) {
        projectType = 'React App';
        iconColor = '#61dafb';
        icon = '⚛️';
      } else if (hasVue) {
        projectType = 'Vue App';
        iconColor = '#42b883';
        icon = '🟢';
      } else if (hasPython) {
        projectType = 'Python App';
        iconColor = '#3776ab';
        icon = '🐍';
      } else if (hasNode) {
        projectType = 'Node.js App';
        iconColor = '#68a063';
        icon = '📦';
      }

      // Generate SVG with project information
      return `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="grad${projectId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${iconColor};stop-opacity:0.1" />
            <stop offset="100%" style="stop-color:${iconColor};stop-opacity:0.05" />
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#grad${projectId})"/>
        <rect width="1920" height="1080" fill="#ffffff" opacity="0.95"/>
        
        <!-- Header -->
        <rect width="1920" height="80" fill="${iconColor}" opacity="0.1"/>
        <text x="60" y="50" fill="${iconColor}" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="600">
          E-Code Platform
        </text>
        
        <!-- Project Icon and Name -->
        <text x="960" y="400" text-anchor="middle" font-size="120">
          ${icon}
        </text>
        <text x="960" y="520" text-anchor="middle" fill="#111827" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="700">
          ${this.escapeXml(project.name || 'Untitled Project')}
        </text>
        
        <!-- Project Type -->
        <text x="960" y="580" text-anchor="middle" fill="#6b7280" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="500">
          ${projectType}
        </text>
        
        <!-- Stats -->
        <text x="960" y="680" text-anchor="middle" fill="#9ca3af" font-family="system-ui, -apple-system, sans-serif" font-size="18">
          ${fileCount} file${fileCount !== 1 ? 's' : ''} · Project ID: ${projectId}
        </text>
        
        <!-- Description if available -->
        ${project.description ? `
        <text x="960" y="760" text-anchor="middle" fill="#6b7280" font-family="system-ui, -apple-system, sans-serif" font-size="20">
          ${this.escapeXml(project.description.substring(0, 80))}${project.description.length > 80 ? '...' : ''}
        </text>
        ` : ''}
        
        <!-- Footer -->
        <text x="960" y="1000" text-anchor="middle" fill="#9ca3af" font-family="system-ui, -apple-system, sans-serif" font-size="16">
          Preview generated at ${new Date().toLocaleString()}
        </text>
        <text x="960" y="1030" text-anchor="middle" fill="#d1d5db" font-family="system-ui, -apple-system, sans-serif" font-size="14">
          Real-time screenshot unavailable - Playwright not configured
        </text>
      </svg>`;
    } catch (error) {
      logger.error('Failed to generate project preview:', error);
      return this.getGenericPreviewSvg(projectId);
    }
  }

  private getGenericPreviewSvg(projectId: number): string {
    return `<svg width="1920" height="1080" xmlns="http://www.w3.org/2000/svg">
      <rect width="1920" height="1080" fill="#f9fafb"/>
      <text x="960" y="500" text-anchor="middle" fill="#6b7280" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="600">
        Project Preview
      </text>
      <text x="960" y="560" text-anchor="middle" fill="#9ca3af" font-family="system-ui, -apple-system, sans-serif" font-size="20">
        Project ID: ${projectId}
      </text>
      <text x="960" y="620" text-anchor="middle" fill="#d1d5db" font-family="system-ui, -apple-system, sans-serif" font-size="16">
        Real-time screenshot unavailable
      </text>
    </svg>`;
  }

  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private getErrorSvg(message: string): string {
    return `<svg width="800" height="200" xmlns="http://www.w3.org/2000/svg">
      <rect width="800" height="200" fill="#fee2e2"/>
      <text x="400" y="80" text-anchor="middle" fill="#dc2626" font-family="Arial" font-size="18" font-weight="bold">
        Error Captured
      </text>
      <text x="400" y="120" text-anchor="middle" fill="#7f1d1d" font-family="Arial" font-size="14">
        ${message.substring(0, 80)}${message.length > 80 ? '...' : ''}
      </text>
    </svg>`;
  }

  private generateErrorHtml(error: Error): string {
    return `<!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #fee2e2;
          padding: 20px;
          margin: 0;
        }
        .error-container {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
          color: #dc2626;
          margin: 0 0 10px;
          font-size: 24px;
        }
        .error-message {
          color: #7f1d1d;
          margin: 10px 0;
        }
        .stack-trace {
          background: #f3f4f6;
          padding: 10px;
          border-radius: 4px;
          font-family: monospace;
          font-size: 12px;
          overflow-x: auto;
          white-space: pre-wrap;
        }
      </style>
    </head>
    <body>
      <div class="error-container">
        <h1>Error Captured</h1>
        <div class="error-message">${error.message}</div>
        ${error.stack ? `<pre class="stack-trace">${error.stack}</pre>` : ''}
      </div>
    </body>
    </html>`;
  }
}

export const screenshotService = new ScreenshotService();