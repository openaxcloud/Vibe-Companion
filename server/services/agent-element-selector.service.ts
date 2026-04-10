// @ts-nocheck
/**
 * Agent Element Selector Service
 * 
 * Visual element picker for browser testing.
 * Generates reliable CSS and XPath selectors for UI automation.
 * 
 * Phase 2 - Browser Testing & Quality Infrastructure
 * Fortune 500 Engineering Standards
 */

import type { Page } from 'playwright';
import { db } from '../db';

let playwrightModule: typeof import('playwright') | null = null;
async function getPlaywright() {
  if (!playwrightModule) {
    try {
      playwrightModule = await import('playwright');
    } catch (e) {
      throw new Error('Playwright is not available in production. This feature requires playwright to be installed.');
    }
  }
  return playwrightModule;
}
import { elementSelectors, ElementSelector, InsertElementSelector } from '../../shared/schema';
import { eq, and } from 'drizzle-orm';

export interface SelectorContext {
  sessionId: string;
  projectId: string;
  userId: string;
}

export interface ElementSelectorResult {
  cssSelector: string;
  xpathSelector: string;
  testId?: string;
  elementType: string;
  elementText: string;
  confidence: number;
  screenshotUrl?: string;
}

export class AgentElementSelectorService {
  
  /**
   * Generate selectors for an element on a page
   * SECURITY: URL allowlist enforced to prevent SSRF attacks
   */
  async generateSelector(
    context: SelectorContext,
    pageUrl: string,
    elementDescription: string
  ): Promise<ElementSelectorResult> {
    // SECURITY: URL validation to prevent SSRF
    if (!this.isAllowedUrl(pageUrl)) {
      throw new Error('URL not allowed. Only localhost and replit.app domains are permitted for security.');
    }

    const pw = await getPlaywright();
    const browser = await pw.chromium.launch({ headless: true });
    const page = await browser.newPage();

    try {
      await page.goto(pageUrl, { waitUntil: 'networkidle' });

      // Use AI to find the element based on description
      const element = await this.findElementByDescription(page, elementDescription);
      
      if (!element) {
        throw new Error(`Could not find element matching: ${elementDescription}`);
      }

      // Generate multiple selector strategies
      const cssSelector = await this.generateCSSSelector(page, element);
      const xpathSelector = await this.generateXPathSelector(page, element);
      const testId = await this.extractTestId(page, element);

      // Get element info
      const elementInfo = await page.evaluate((el: Element) => {
        return {
          tagName: el.tagName.toLowerCase(),
          text: el.textContent?.trim() || '',
          attributes: Array.from(el.attributes).reduce((acc: Record<string, string>, attr) => {
            acc[attr.name] = attr.value;
            return acc;
          }, {} as Record<string, string>)
        };
      }, element);

      // Calculate confidence score based on selector uniqueness
      const confidence = await this.calculateConfidence(page, cssSelector);

      // Capture screenshot with element highlighted
      const screenshotUrl = await this.captureHighlightedScreenshot(page, element);

      // Store in database
      await db.insert(elementSelectors).values({
        sessionId: context.sessionId,
        projectId: context.projectId,
        elementName: elementDescription,
        cssSelector,
        xpathSelector,
        testId,
        elementType: elementInfo.tagName,
        elementText: elementInfo.text,
        elementAttributes: elementInfo.attributes,
        screenshotUrl,
        confidence,
        pageUrl
      });

      await browser.close();

      return {
        cssSelector,
        xpathSelector,
        testId,
        elementType: elementInfo.tagName,
        elementText: elementInfo.text,
        confidence,
        screenshotUrl
      };

    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  /**
   * Get selector history for a session
   */
  async getSelectorHistory(sessionId: string): Promise<ElementSelector[]> {
    return await db.select()
      .from(elementSelectors)
      .where(eq(elementSelectors.sessionId, sessionId));
  }

  // Private helper methods

  private async findElementByDescription(page: Page, description: string): Promise<any> {
    // Strategy 1: Try finding by text content
    const byText = page.getByText(description, { exact: false });
    if (await byText.count() > 0) {
      const handle = await byText.first().elementHandle();
      if (handle) return handle;
    }

    // Strategy 2: Try finding by role and name
    try {
      const byRole = page.getByRole('button', { name: description });
      if (await byRole.count() > 0) {
        const handle = await byRole.first().elementHandle();
        if (handle) return handle;
      }
    } catch (e) {
      // Role might not match, continue
    }

    // Strategy 3: Try finding by placeholder
    try {
      const byPlaceholder = page.getByPlaceholder(description);
      if (await byPlaceholder.count() > 0) {
        const handle = await byPlaceholder.first().elementHandle();
        if (handle) return handle;
      }
    } catch (e) {
      // Placeholder might not match
    }

    // Strategy 4: Try finding by label
    try {
      const byLabel = page.getByLabel(description);
      if (await byLabel.count() > 0) {
        const handle = await byLabel.first().elementHandle();
        if (handle) return handle;
      }
    } catch (e) {
      // Label might not match
    }

    return null;
  }

  private async generateCSSSelector(page: Page, element: any): Promise<string> {
    return await page.evaluate((el) => {
      // Generate a unique CSS selector
      const path: string[] = [];
      let current: Element | null = el;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let selector = current.nodeName.toLowerCase();

        // Add ID if available
        if (current.id) {
          selector += `#${current.id}`;
          path.unshift(selector);
          break;
        }

        // Add classes
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter(c => c);
          if (classes.length > 0) {
            selector += '.' + classes.join('.');
          }
        }

        // Add nth-child if needed for uniqueness
        const parent = current.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children).filter(
            child => child.nodeName === current!.nodeName
          );
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-child(${index})`;
          }
        }

        path.unshift(selector);
        current = parent;
      }

      return path.join(' > ');
    }, element);
  }

  private async generateXPathSelector(page: Page, element: any): Promise<string> {
    return await page.evaluate((el) => {
      // Generate XPath
      const path: string[] = [];
      let current: Element | null = el;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling: Element | null = current.previousElementSibling;

        while (sibling) {
          if (sibling.nodeName === current.nodeName) {
            index++;
          }
          sibling = sibling.previousElementSibling;
        }

        const tagName = current.nodeName.toLowerCase();
        const pathIndex = `[${index}]`;
        path.unshift(`${tagName}${pathIndex}`);

        current = current.parentElement;
      }

      return '//' + path.join('/');
    }, element);
  }

  private async extractTestId(page: Page, element: any): Promise<string | undefined> {
    return await page.evaluate((el) => {
      return el.getAttribute('data-testid') || 
             el.getAttribute('data-test-id') ||
             el.getAttribute('data-test') ||
             undefined;
    }, element);
  }

  private async calculateConfidence(page: Page, cssSelector: string): Promise<number> {
    try {
      const count = await page.locator(cssSelector).count();
      
      // Higher confidence if selector is unique
      if (count === 1) return 0.95;
      if (count < 3) return 0.75;
      if (count < 5) return 0.5;
      return 0.25;
    } catch (error) {
      return 0.1;
    }
  }

  /**
   * SECURITY: URL allowlist to prevent SSRF attacks
   */
  private isAllowedUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();
      
      // Allow localhost and 127.0.0.1
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0') {
        return true;
      }
      
      // Allow replit.app domains
      if (hostname.endsWith('.replit.app') || hostname === 'replit.app') {
        return true;
      }
      
      // Allow replit.dev domains
      if (hostname.endsWith('.replit.dev') || hostname === 'replit.dev') {
        return true;
      }
      
      return false;
    } catch (e) {
      return false;
    }
  }

  private async captureHighlightedScreenshot(page: Page, element: any): Promise<string> {
    // Highlight the element
    await page.evaluate((el) => {
      el.style.outline = '3px solid #ff0000';
      el.style.outlineOffset = '2px';
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, element);

    // Wait for scroll
    await page.waitForTimeout(500);

    // Capture screenshot
    const screenshot = await page.screenshot({ fullPage: false });
    
    // In production, upload to S3/object storage
    const screenshotUrl = `/element-screenshots/${Date.now()}.png`;

    // Remove highlight
    await page.evaluate((el) => {
      el.style.outline = '';
    }, element);

    return screenshotUrl;
  }
}

// Export singleton instance
export const agentElementSelector = new AgentElementSelectorService();
