// @ts-nocheck
/**
 * Viewport Validation Service
 * 
 * Tests generated apps at 3 specific viewports using Playwright:
 * - Mobile: 375x667
 * - Tablet: 768x1024
 * - Desktop: 1280x720
 * 
 * Takes screenshots at each viewport and checks for basic rendering.
 * 
 * @author E-Code Platform
 * @version 1.0.0
 * @since December 14, 2025
 */

import { createLogger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const logger = createLogger('ViewportValidationService');

export interface ViewportConfig {
  name: string;
  width: number;
  height: number;
  isMobile: boolean;
}

export interface ViewportResult {
  viewport: string;
  width: number;
  height: number;
  success: boolean;
  screenshot?: string;
  videoPath?: string;
  loadTimeMs?: number;
  jsErrors: string[];
  consoleErrors: string[];
}

export interface ViewportValidationResult {
  success: boolean;
  testedAt: Date;
  url: string;
  viewports: ViewportResult[];
  overallScore: number;
  issues: string[];
  videoPaths?: string[];
}

export interface ValidationOptions {
  timeout?: number;
  waitForSelector?: string;
  recordVideo?: boolean;
  videoDir?: string;
}

const REQUIRED_VIEWPORTS: ViewportConfig[] = [
  { name: 'Mobile', width: 375, height: 667, isMobile: true },
  { name: 'Tablet', width: 768, height: 1024, isMobile: true },
  { name: 'Desktop', width: 1280, height: 720, isMobile: false }
];

type Browser = any;
type Page = any;

export class ViewportValidationService {
  private browser: Browser | null = null;
  private screenshotDir: string;
  private videoDir: string;

  constructor() {
    this.screenshotDir = path.join(os.tmpdir(), 'viewport-validation-screenshots');
    this.videoDir = path.join(os.tmpdir(), 'viewport-validation-videos');
  }

  async initialize(): Promise<void> {
    try {
      const playwright = await import('playwright').catch(() => null);
      
      if (playwright) {
        this.browser = await playwright.chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        logger.info('ViewportValidationService initialized with Playwright');
      } else {
        logger.warn('Playwright not available, viewport validation will be limited');
      }

      await fs.mkdir(this.screenshotDir, { recursive: true });
      await fs.mkdir(this.videoDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to initialize ViewportValidationService:', error);
    }
  }

  async validateViewports(
    url: string,
    options: ValidationOptions = {}
  ): Promise<ViewportValidationResult> {
    const startTime = Date.now();
    const timeout = options.timeout || 30000;
    const recordVideo = options.recordVideo ?? true;
    const videoOutputDir = options.videoDir || this.videoDir;
    const issues: string[] = [];
    const viewportResults: ViewportResult[] = [];
    const videoPaths: string[] = [];
    
    if (options.videoDir) {
      await fs.mkdir(options.videoDir, { recursive: true }).catch((err) => {
        logger.warn('[ViewportValidation] Failed to create video directory:', options.videoDir, err?.message);
      });
    }

    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      return {
        success: false,
        testedAt: new Date(),
        url,
        viewports: REQUIRED_VIEWPORTS.map(vp => ({
          viewport: vp.name,
          width: vp.width,
          height: vp.height,
          success: false,
          jsErrors: ['Playwright browser not available'],
          consoleErrors: []
        })),
        overallScore: 0,
        issues: ['Playwright browser could not be initialized']
      };
    }

    logger.info(`Starting viewport validation for ${url} across ${REQUIRED_VIEWPORTS.length} viewports${recordVideo ? ' with video recording' : ''}`);

    for (const viewport of REQUIRED_VIEWPORTS) {
      const result = await this.testViewport(url, viewport, timeout, options.waitForSelector, recordVideo, videoOutputDir);
      viewportResults.push(result);

      if (result.videoPath) {
        videoPaths.push(result.videoPath);
      }

      if (!result.success) {
        issues.push(`[${viewport.name}] ${result.jsErrors.join('; ') || result.consoleErrors.join('; ') || 'Failed to load'}`);
      }
    }

    const passedCount = viewportResults.filter(r => r.success).length;
    const overallScore = Math.round((passedCount / viewportResults.length) * 100);
    const success = overallScore === 100;

    const totalTime = Date.now() - startTime;
    logger.info(`Viewport validation complete in ${totalTime}ms. Score: ${overallScore}%, Success: ${success}${videoPaths.length > 0 ? `, Videos: ${videoPaths.length}` : ''}`);

    return {
      success,
      testedAt: new Date(),
      url,
      viewports: viewportResults,
      overallScore,
      issues,
      videoPaths: videoPaths.length > 0 ? videoPaths : undefined
    };
  }

  private async testViewport(
    url: string,
    viewport: ViewportConfig,
    timeout: number,
    waitForSelector?: string,
    recordVideo: boolean = false,
    videoOutputDir?: string
  ): Promise<ViewportResult> {
    const startTime = Date.now();
    const jsErrors: string[] = [];
    const consoleErrors: string[] = [];
    let screenshot: string | undefined;
    let videoPath: string | undefined;
    let context: any = null;
    let page: Page | null = null;

    try {
      const contextOptions: any = {
        viewport: { width: viewport.width, height: viewport.height }
      };
      
      if (viewport.isMobile) {
        contextOptions.userAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';
        contextOptions.hasTouch = true;
        contextOptions.isMobile = true;
      }
      
      if (recordVideo) {
        contextOptions.recordVideo = {
          dir: videoOutputDir || this.videoDir,
          size: { width: viewport.width, height: viewport.height }
        };
      }
      
      context = await this.browser!.newContext(contextOptions);
      page = await context.newPage();

      page.on('pageerror', (error: Error) => {
        jsErrors.push(error.message);
      });

      page.on('console', (msg: any) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout
      });

      if (waitForSelector) {
        await page.waitForSelector(waitForSelector, { timeout });
      }

      await page.waitForTimeout(1000);

      const timestamp = Date.now();
      const filename = `${viewport.name.toLowerCase()}-${viewport.width}x${viewport.height}-${timestamp}.png`;
      const screenshotPath = path.join(this.screenshotDir, filename);

      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        type: 'png'
      });

      const screenshotBuffer = await fs.readFile(screenshotPath);
      screenshot = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

      const loadTimeMs = Date.now() - startTime;

      if (recordVideo && page) {
        try {
          const video = page.video();
          if (video) {
            videoPath = await video.path();
            logger.debug(`Video recorded for ${viewport.name}: ${videoPath}`);
          }
        } catch (e) {
          logger.warn(`Failed to get video path for ${viewport.name}:`, e);
        }
      }

      logger.debug(`Viewport ${viewport.name} (${viewport.width}x${viewport.height}) validated successfully in ${loadTimeMs}ms${videoPath ? ' with video' : ''}`);

      return {
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        success: jsErrors.length === 0 && consoleErrors.length === 0,
        screenshot,
        videoPath,
        loadTimeMs,
        jsErrors,
        consoleErrors
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to validate viewport ${viewport.name}:`, error);
      
      return {
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        success: false,
        loadTimeMs: Date.now() - startTime,
        jsErrors: [`Validation failed: ${errorMessage}`],
        consoleErrors
      };
    } finally {
      // ✅ Close context instead of just page - this properly cleans up Playwright resources
      if (context) {
        await context.close().catch((err) => {
          logger.debug('[ViewportValidation] Context cleanup error (non-critical):', err?.message);
        });
      }
    }
  }

  async takeScreenshots(url: string): Promise<{ viewport: string; screenshot: string }[]> {
    const screenshots: { viewport: string; screenshot: string }[] = [];

    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      return screenshots;
    }

    for (const viewport of REQUIRED_VIEWPORTS) {
      let page: Page | null = null;
      
      try {
        page = await this.browser.newPage();
        
        await page.setViewportSize({
          width: viewport.width,
          height: viewport.height
        });

        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        await page.waitForTimeout(1000);

        const screenshotBuffer = await page.screenshot({ type: 'png' });
        const base64 = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

        screenshots.push({
          viewport: `${viewport.name} (${viewport.width}x${viewport.height})`,
          screenshot: base64
        });

        logger.debug(`Screenshot captured for ${viewport.name}`);

      } catch (error) {
        logger.error(`Failed to take screenshot for ${viewport.name}:`, error);
      } finally {
        if (page && !page.isClosed()) {
          await page.close().catch((err) => {
            logger.debug('[ViewportValidation] Page cleanup error (non-critical):', err?.message);
          });
        }
      }
    }

    return screenshots;
  }

  async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.screenshotDir);
      for (const file of files) {
        await fs.unlink(path.join(this.screenshotDir, file)).catch((err) => {
          logger.debug('[ViewportValidation] Failed to delete screenshot:', file, err?.message);
        });
      }
    } catch (error) {
      logger.warn('Failed to cleanup screenshots:', error);
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('ViewportValidationService cleaned up');
  }

  getRequiredViewports(): ViewportConfig[] {
    return [...REQUIRED_VIEWPORTS];
  }
}

const viewportValidationService = new ViewportValidationService();

export async function validateViewports(
  url: string,
  options?: ValidationOptions
): Promise<ViewportValidationResult> {
  return viewportValidationService.validateViewports(url, options);
}

export async function takeViewportScreenshots(url: string): Promise<{ viewport: string; screenshot: string }[]> {
  return viewportValidationService.takeScreenshots(url);
}

export { viewportValidationService };
