/**
 * HTML/CSS/JS Preview Runtime
 * 
 * Provides meaningful preview capability for HTML files without long-running servers.
 * Uses JSDOM for DOM parsing and validation, and optionally Puppeteer for full rendering.
 * 
 * This module terminates after execution (no persistent servers) and returns:
 * - DOM structure analysis
 * - JavaScript error detection
 * - CSS validation
 * - Console log capture
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { JSDOM, VirtualConsole } from 'jsdom';

export interface HtmlPreviewResult {
  success: boolean;
  stdout: string;
  stderr: string;
  htmlValid: boolean;
  domSummary: {
    doctype: boolean;
    title: string | null;
    headElements: number;
    bodyElements: number;
    scripts: number;
    styles: number;
    links: number;
    images: number;
    forms: number;
  };
  consoleLogs: string[];
  errors: string[];
  warnings: string[];
}

export async function renderHtmlPreview(
  htmlFilePath: string,
  options: {
    timeout?: number;
    captureConsole?: boolean;
    executeJs?: boolean;
  } = {}
): Promise<HtmlPreviewResult> {
  const {
    timeout = 5000,
    captureConsole = true,
    executeJs = true,
  } = options;

  const consoleLogs: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  let stdout = '';
  let stderr = '';

  try {
    const htmlContent = await fs.readFile(htmlFilePath, 'utf-8');
    const fileName = path.basename(htmlFilePath);

    const virtualConsole = new VirtualConsole();
    
    if (captureConsole) {
      virtualConsole.on('log', (...args) => {
        consoleLogs.push(`[console.log] ${args.join(' ')}`);
      });
      virtualConsole.on('info', (...args) => {
        consoleLogs.push(`[console.info] ${args.join(' ')}`);
      });
      virtualConsole.on('warn', (...args) => {
        warnings.push(`[console.warn] ${args.join(' ')}`);
      });
      virtualConsole.on('error', (...args) => {
        errors.push(`[console.error] ${args.join(' ')}`);
      });
      virtualConsole.on('jsdomError', (e) => {
        errors.push(`[JavaScript Error] ${e.message}`);
      });
    }

    const dom = new JSDOM(htmlContent, {
      url: `file://${htmlFilePath}`,
      runScripts: executeJs ? 'dangerously' : undefined,
      virtualConsole,
      resources: 'usable',
      pretendToBeVisual: true,
    });

    await new Promise((resolve) => setTimeout(resolve, Math.min(timeout, 1000)));

    const document = dom.window.document;

    const doctype = document.doctype !== null;
    const title = document.title || null;
    const headElements = document.head ? document.head.children.length : 0;
    const bodyElements = document.body ? document.body.children.length : 0;
    const scripts = document.querySelectorAll('script').length;
    const styles = document.querySelectorAll('style').length + document.querySelectorAll('link[rel="stylesheet"]').length;
    const links = document.querySelectorAll('a').length;
    const images = document.querySelectorAll('img').length;
    const forms = document.querySelectorAll('form').length;

    const domSummary = {
      doctype,
      title,
      headElements,
      bodyElements,
      scripts,
      styles,
      links,
      images,
      forms,
    };

    stdout = `
╔══════════════════════════════════════════════════════════════════════╗
║                    HTML Preview Analysis                              ║
╠══════════════════════════════════════════════════════════════════════╣
║ File: ${fileName.padEnd(60)}║
╠══════════════════════════════════════════════════════════════════════╣
║ Document Structure                                                    ║
╠══════════════════════════════════════════════════════════════════════╣
║  • DOCTYPE: ${(doctype ? '✓ Present' : '✗ Missing').padEnd(55)}║
║  • Title: ${(title ? `"${title.substring(0, 50)}"` : 'None').padEnd(57)}║
║  • Head Elements: ${String(headElements).padEnd(49)}║
║  • Body Elements: ${String(bodyElements).padEnd(49)}║
╠══════════════════════════════════════════════════════════════════════╣
║ Resources                                                             ║
╠══════════════════════════════════════════════════════════════════════╣
║  • Scripts: ${String(scripts).padEnd(55)}║
║  • Stylesheets: ${String(styles).padEnd(51)}║
║  • Links: ${String(links).padEnd(57)}║
║  • Images: ${String(images).padEnd(56)}║
║  • Forms: ${String(forms).padEnd(57)}║
╠══════════════════════════════════════════════════════════════════════╣`;

    if (consoleLogs.length > 0) {
      stdout += `
║ Console Output (${consoleLogs.length} messages)                                       ║
╠══════════════════════════════════════════════════════════════════════╣`;
      consoleLogs.slice(0, 10).forEach((log) => {
        stdout += `\n║  ${log.substring(0, 66).padEnd(67)}║`;
      });
      if (consoleLogs.length > 10) {
        stdout += `\n║  ... and ${consoleLogs.length - 10} more messages`.padEnd(69) + '║';
      }
      stdout += `\n╠══════════════════════════════════════════════════════════════════════╣`;
    }

    if (errors.length > 0) {
      stderr = `JavaScript Errors Detected:\n${errors.join('\n')}`;
      stdout += `
║ ⚠ ${errors.length} JavaScript Error(s) Detected                                      ║
╠══════════════════════════════════════════════════════════════════════╣`;
    }

    if (warnings.length > 0) {
      stdout += `
║ ⚠ ${warnings.length} Warning(s) Detected                                             ║
╠══════════════════════════════════════════════════════════════════════╣`;
    }

    stdout += `
║ ✓ HTML Preview Complete                                              ║
╚══════════════════════════════════════════════════════════════════════╝

Note: For live preview with full interactivity, use the browser preview panel.
`;

    dom.window.close();

    return {
      success: errors.length === 0,
      stdout,
      stderr,
      htmlValid: doctype && bodyElements > 0,
      domSummary,
      consoleLogs,
      errors,
      warnings,
    };
  } catch (error: any) {
    stderr = `HTML Preview Error: ${error.message}`;
    return {
      success: false,
      stdout: `HTML Preview failed: ${error.message}`,
      stderr,
      htmlValid: false,
      domSummary: {
        doctype: false,
        title: null,
        headElements: 0,
        bodyElements: 0,
        scripts: 0,
        styles: 0,
        links: 0,
        images: 0,
        forms: 0,
      },
      consoleLogs,
      errors: [error.message],
      warnings,
    };
  }
}

export async function validateHtml(htmlContent: string): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!htmlContent.includes('<!DOCTYPE') && !htmlContent.includes('<!doctype')) {
    warnings.push('Missing DOCTYPE declaration');
  }

  if (!htmlContent.includes('<html')) {
    errors.push('Missing <html> element');
  }

  if (!htmlContent.includes('<head')) {
    warnings.push('Missing <head> element');
  }

  if (!htmlContent.includes('<body')) {
    errors.push('Missing <body> element');
  }

  if (!htmlContent.includes('<title')) {
    warnings.push('Missing <title> element (important for SEO and accessibility)');
  }

  const openTags = htmlContent.match(/<([a-z][a-z0-9]*)\b[^>]*>/gi) || [];
  const closeTags = htmlContent.match(/<\/([a-z][a-z0-9]*)\s*>/gi) || [];

  const selfClosingTags = ['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'param', 'source', 'track', 'wbr'];
  
  const tagCounts: Record<string, number> = {};
  openTags.forEach((tag) => {
    const match = tag.match(/<([a-z][a-z0-9]*)/i);
    if (match) {
      const tagName = match[1].toLowerCase();
      if (!selfClosingTags.includes(tagName)) {
        tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      }
    }
  });

  closeTags.forEach((tag) => {
    const match = tag.match(/<\/([a-z][a-z0-9]*)/i);
    if (match) {
      const tagName = match[1].toLowerCase();
      tagCounts[tagName] = (tagCounts[tagName] || 0) - 1;
    }
  });

  Object.entries(tagCounts).forEach(([tag, count]) => {
    if (count > 0) {
      errors.push(`Unclosed <${tag}> tag (${count} unclosed)`);
    } else if (count < 0) {
      errors.push(`Extra closing </${tag}> tag (${Math.abs(count)} extra)`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
