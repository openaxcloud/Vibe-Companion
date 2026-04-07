// @ts-nocheck
import { createLogger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

const logger = createLogger('ResponsiveValidationService');

export interface Breakpoint {
  name: string;
  width: number;
  height: number;
  isMobile?: boolean;
}

export interface ValidationOptions {
  breakpoints?: Breakpoint[];
  timeout?: number;
  waitForSelector?: string;
  checkTouchTargets?: boolean;
  checkHorizontalScroll?: boolean;
  testIds?: string[];
  screenshotFormat?: 'png' | 'jpeg';
  cleanupScreenshots?: boolean;
}

export interface BreakpointResult {
  name: string;
  width: number;
  height: number;
  passed: boolean;
  screenshot?: string;
  errors?: string[];
}

export interface ResponsiveResult {
  success: boolean;
  breakpoints: BreakpointResult[];
  overallScore: number;
  issues: string[];
}

export interface Screenshot {
  breakpoint: Breakpoint;
  path: string;
  base64?: string;
  timestamp: Date;
}

const DEFAULT_BREAKPOINTS: Breakpoint[] = [
  { name: 'Desktop', width: 1920, height: 1080, isMobile: false },
  { name: 'Laptop', width: 1366, height: 768, isMobile: false },
  { name: 'Tablet', width: 768, height: 1024, isMobile: true },
  { name: 'Mobile', width: 375, height: 667, isMobile: true },
  { name: 'Mobile Large', width: 414, height: 896, isMobile: true },
];

const DEFAULT_OPTIONS: ValidationOptions = {
  breakpoints: DEFAULT_BREAKPOINTS,
  timeout: 30000,
  checkTouchTargets: true,
  checkHorizontalScroll: true,
  screenshotFormat: 'png',
  cleanupScreenshots: true,
};

type Browser = any;
type Page = any;

export class ResponsiveValidationService {
  private browser: Browser | null = null;
  private screenshotDir: string;

  constructor() {
    this.screenshotDir = path.join(os.tmpdir(), 'responsive-validation-screenshots');
  }

  async initialize(): Promise<void> {
    try {
      const playwright = await import('playwright').catch(() => null);
      
      if (playwright) {
        this.browser = await playwright.chromium.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        logger.info('ResponsiveValidationService initialized with Playwright');
      } else {
        logger.warn('Playwright not available, responsive validation will be limited');
      }

      await fs.mkdir(this.screenshotDir, { recursive: true });
    } catch (error) {
      logger.error('Failed to initialize ResponsiveValidationService:', error);
      throw error;
    }
  }

  async validateResponsive(
    url: string,
    options: ValidationOptions = {}
  ): Promise<ResponsiveResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const breakpoints = opts.breakpoints || DEFAULT_BREAKPOINTS;
    const issues: string[] = [];
    const breakpointResults: BreakpointResult[] = [];

    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      return {
        success: false,
        breakpoints: breakpoints.map(bp => ({
          name: bp.name,
          width: bp.width,
          height: bp.height,
          passed: false,
          errors: ['Browser not available for validation']
        })),
        overallScore: 0,
        issues: ['Playwright browser could not be initialized']
      };
    }

    logger.info(`Starting responsive validation for ${url} across ${breakpoints.length} breakpoints`);

    for (const breakpoint of breakpoints) {
      const result = await this.validateBreakpoint(url, breakpoint, opts);
      breakpointResults.push(result);

      if (!result.passed && result.errors) {
        issues.push(...result.errors.map(err => `[${breakpoint.name}] ${err}`));
      }
    }

    const passedCount = breakpointResults.filter(r => r.passed).length;
    const overallScore = Math.round((passedCount / breakpointResults.length) * 100);
    const success = overallScore === 100;

    if (opts.cleanupScreenshots) {
      await this.cleanupScreenshots();
    }

    logger.info(`Responsive validation complete. Score: ${overallScore}%, Success: ${success}`);

    return {
      success,
      breakpoints: breakpointResults,
      overallScore,
      issues
    };
  }

  private async validateBreakpoint(
    url: string,
    breakpoint: Breakpoint,
    options: ValidationOptions
  ): Promise<BreakpointResult> {
    const errors: string[] = [];
    let screenshotPath: string | undefined;
    const jsErrors: string[] = [];

    if (!this.browser) {
      return {
        name: breakpoint.name,
        width: breakpoint.width,
        height: breakpoint.height,
        passed: false,
        errors: ['Browser not available']
      };
    }

    let page: Page | null = null;

    try {
      page = await this.browser.newPage();
      
      await page.setViewportSize({
        width: breakpoint.width,
        height: breakpoint.height
      });

      if (breakpoint.isMobile) {
        await page.emulate({
          viewport: { width: breakpoint.width, height: breakpoint.height },
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
          hasTouch: true,
          isMobile: true
        }).catch(() => {
          // Emulation may not be fully supported
        });
      }

      page.on('pageerror', (error: Error) => {
        jsErrors.push(error.message);
      });

      page.on('console', (msg: any) => {
        if (msg.type() === 'error') {
          jsErrors.push(msg.text());
        }
      });

      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: options.timeout || 30000
      });

      if (options.waitForSelector) {
        await page.waitForSelector(options.waitForSelector, {
          timeout: options.timeout || 30000
        });
      }

      await page.waitForTimeout(1000);

      if (jsErrors.length > 0) {
        errors.push(`JavaScript errors detected: ${jsErrors.slice(0, 3).join('; ')}`);
      }

      if (breakpoint.isMobile && options.checkHorizontalScroll) {
        const hasHorizontalScroll = await page.evaluate(() => {
          return document.documentElement.scrollWidth > document.documentElement.clientWidth;
        });

        if (hasHorizontalScroll) {
          errors.push('Horizontal scroll detected on mobile viewport');
        }
      }

      if (breakpoint.isMobile && options.checkTouchTargets) {
        const smallTouchTargets = await page.evaluate(() => {
          const interactiveElements = document.querySelectorAll('button, a, input, select, textarea, [role="button"], [onclick]');
          const smallTargets: string[] = [];

          interactiveElements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.height < 44 && rect.height > 0) {
              const identifier = el.getAttribute('data-testid') || 
                                el.id || 
                                el.className.split(' ')[0] || 
                                el.tagName.toLowerCase();
              smallTargets.push(`${identifier} (${Math.round(rect.height)}px)`);
            }
          });

          return smallTargets.slice(0, 5);
        });

        if (smallTouchTargets.length > 0) {
          errors.push(`Touch targets below 44px: ${smallTouchTargets.join(', ')}`);
        }
      }

      if (options.testIds && options.testIds.length > 0) {
        for (const testId of options.testIds) {
          const isVisible = await page.evaluate((id: string) => {
            const element = document.querySelector(`[data-testid="${id}"]`);
            if (!element) return false;
            
            const rect = element.getBoundingClientRect();
            const style = window.getComputedStyle(element);
            
            return rect.width > 0 && 
                   rect.height > 0 && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden' &&
                   style.opacity !== '0';
          }, testId);

          if (!isVisible) {
            errors.push(`Element with data-testid="${testId}" is not visible`);
          }
        }
      }

      const timestamp = Date.now();
      const filename = `${breakpoint.name.replace(/\s+/g, '-').toLowerCase()}-${breakpoint.width}x${breakpoint.height}-${timestamp}.${options.screenshotFormat || 'png'}`;
      screenshotPath = path.join(this.screenshotDir, filename);

      await page.screenshot({
        path: screenshotPath,
        fullPage: false,
        type: options.screenshotFormat || 'png'
      });

      const screenshotBuffer = await fs.readFile(screenshotPath);
      const base64Screenshot = `data:image/${options.screenshotFormat || 'png'};base64,${screenshotBuffer.toString('base64')}`;

      logger.debug(`Validated breakpoint ${breakpoint.name}: ${errors.length === 0 ? 'PASSED' : 'FAILED'}`);

      return {
        name: breakpoint.name,
        width: breakpoint.width,
        height: breakpoint.height,
        passed: errors.length === 0,
        screenshot: base64Screenshot,
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to validate breakpoint ${breakpoint.name}:`, error);
      
      return {
        name: breakpoint.name,
        width: breakpoint.width,
        height: breakpoint.height,
        passed: false,
        errors: [`Validation failed: ${errorMessage}`]
      };
    } finally {
      if (page && !page.isClosed()) {
        await page.close().catch((err) => {
          logger.debug('[ResponsiveValidation] Page cleanup error (non-critical):', err?.message);
        });
      }
    }
  }

  async takeBreakpointScreenshots(
    url: string,
    breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS
  ): Promise<Screenshot[]> {
    const screenshots: Screenshot[] = [];

    if (!this.browser) {
      await this.initialize();
    }

    if (!this.browser) {
      logger.error('Browser not available for taking screenshots');
      return screenshots;
    }

    logger.info(`Taking screenshots at ${breakpoints.length} breakpoints for ${url}`);

    for (const breakpoint of breakpoints) {
      let page: Page | null = null;

      try {
        page = await this.browser.newPage();
        
        await page.setViewportSize({
          width: breakpoint.width,
          height: breakpoint.height
        });

        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: 30000
        });

        await page.waitForTimeout(1000);

        const timestamp = new Date();
        const filename = `screenshot-${breakpoint.name.replace(/\s+/g, '-').toLowerCase()}-${breakpoint.width}x${breakpoint.height}-${timestamp.getTime()}.png`;
        const screenshotPath = path.join(this.screenshotDir, filename);

        await page.screenshot({
          path: screenshotPath,
          fullPage: false,
          type: 'png'
        });

        const screenshotBuffer = await fs.readFile(screenshotPath);
        const base64 = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;

        screenshots.push({
          breakpoint,
          path: screenshotPath,
          base64,
          timestamp
        });

        logger.debug(`Screenshot captured for ${breakpoint.name} (${breakpoint.width}x${breakpoint.height})`);

      } catch (error) {
        logger.error(`Failed to take screenshot for breakpoint ${breakpoint.name}:`, error);
      } finally {
        if (page && !page.isClosed()) {
          await page.close().catch((err) => {
            logger.debug('[ResponsiveValidation] Page cleanup error (non-critical):', err?.message);
          });
        }
      }
    }

    return screenshots;
  }

  async cleanupScreenshots(): Promise<void> {
    try {
      const files = await fs.readdir(this.screenshotDir);
      
      for (const file of files) {
        const filePath = path.join(this.screenshotDir, file);
        await fs.unlink(filePath).catch((err) => {
          logger.debug('[ResponsiveValidation] Failed to delete screenshot:', file, err?.message);
        });
      }

      logger.debug('Screenshot cleanup completed');
    } catch (error) {
      logger.warn('Failed to cleanup screenshots:', error);
    }
  }

  async cleanup(): Promise<void> {
    await this.cleanupScreenshots();
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }

    logger.info('ResponsiveValidationService cleaned up');
  }

  getDefaultBreakpoints(): Breakpoint[] {
    return [...DEFAULT_BREAKPOINTS];
  }
}

const responsiveValidationService = new ResponsiveValidationService();

export async function validateResponsive(
  url: string,
  options?: ValidationOptions
): Promise<ResponsiveResult> {
  return responsiveValidationService.validateResponsive(url, options);
}

export async function takeBreakpointScreenshots(
  url: string,
  breakpoints: Breakpoint[] = DEFAULT_BREAKPOINTS
): Promise<Screenshot[]> {
  return responsiveValidationService.takeBreakpointScreenshots(url, breakpoints);
}

export { responsiveValidationService };
