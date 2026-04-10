// @ts-nocheck
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { createLogger } from '../utils/logger';
import { checkpointService } from '../services/checkpoint-service';

const logger = createLogger('WebImportService');

export class WebImportService {
  async importFromUrl(url: string, projectId?: number, userId?: number): Promise<{
    content: string;
    title: string;
    description?: string;
    images?: string[];
    code?: string[];
  }> {
    try {
      logger.info(`Importing content from URL: ${url}`);
      
      // Fetch the webpage
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; E-Code/1.0; +https://e-code.ai)'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.statusText}`);
      }

      const html = await response.text();
      const dom = new JSDOM(html);
      const document = dom.window.document;

      // Extract title
      const title = document.querySelector('title')?.textContent || 
                   document.querySelector('h1')?.textContent || 
                   'Imported Content';

      // Extract meta description
      const description = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                         document.querySelector('meta[property="og:description"]')?.getAttribute('content');

      // Extract main content
      const contentSelectors = [
        'main', 
        'article', 
        '[role="main"]',
        '.content',
        '#content',
        '.post-content',
        '.entry-content'
      ];

      let mainContent = '';
      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          mainContent = this.extractTextContent(element);
          break;
        }
      }

      // If no main content found, extract from body
      if (!mainContent) {
        const body = document.querySelector('body');
        if (body) {
          // Remove script and style tags
          body.querySelectorAll('script, style, noscript').forEach((el: Element) => el.remove());
          mainContent = this.extractTextContent(body);
        }
      }

      // Extract code snippets
      const codeBlocks: string[] = [];
      document.querySelectorAll('pre code, pre, code').forEach((element: Element) => {
        const code = element.textContent?.trim();
        if (code && code.length > 10) {
          codeBlocks.push(code);
        }
      });

      // Extract images
      const images: string[] = [];
      document.querySelectorAll('img').forEach((img: HTMLImageElement) => {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src && !src.startsWith('data:')) {
          // Convert relative URLs to absolute
          const absoluteUrl = new URL(src, url).href;
          images.push(absoluteUrl);
        }
      });

      // Clean up content
      mainContent = this.cleanContent(mainContent);

      // Create formatted output
      const formattedContent = this.formatImportedContent({
        url,
        title,
        description,
        content: mainContent,
        codeBlocks,
        images
      });

      // Track import in checkpoint if project context provided
      if (projectId && userId) {
        await checkpointService.createComprehensiveCheckpoint({
          projectId,
          userId,
          message: `Imported web content from ${new URL(url).hostname}`,
          agentTaskDescription: `Web import from ${url}`,
          filesModified: 0,
          linesOfCodeWritten: mainContent.split('\n').length,
          tokensUsed: Math.ceil(mainContent.length / 4), // Estimate
          executionTimeMs: Date.now() - Date.now(),
          apiCallsCount: 1
        });
      }

      logger.info(`Successfully imported content from ${url}`);

      return {
        content: formattedContent,
        title,
        description,
        images,
        code: codeBlocks
      };
    } catch (error) {
      logger.error(`Failed to import from URL ${url}:`, error);
      throw error;
    }
  }

  private extractTextContent(element: Element): string {
    // Clone to avoid modifying original
    const clone = element.cloneNode(true) as Element;
    
    // Remove unwanted elements
    clone.querySelectorAll('script, style, nav, header, footer, aside, .ads, .advertisement').forEach(el => el.remove());

    // Get text content and preserve some structure
    let text = '';
    const walker = (clone as any).ownerDocument.createTreeWalker(
      clone,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node;
    while (node = walker.nextNode()) {
      if (node.nodeType === Node.TEXT_NODE) {
        const content = node.textContent?.trim();
        if (content) {
          text += content + ' ';
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        // Add line breaks for block elements
        if (['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'br'].includes(node.tagName.toLowerCase())) {
          text += '\n';
        }
      }
    }

    return text;
  }

  private cleanContent(content: string): string {
    return content
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n{3,}/g, '\n\n') // Replace multiple newlines with double newline
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');
  }

  private formatImportedContent(data: {
    url: string;
    title: string;
    description?: string;
    content: string;
    codeBlocks: string[];
    images: string[];
  }): string {
    let formatted = `# Imported Content from ${data.url}\n\n`;
    formatted += `## ${data.title}\n\n`;
    
    if (data.description) {
      formatted += `**Description:** ${data.description}\n\n`;
    }

    formatted += `### Content\n\n${data.content}\n\n`;

    if (data.codeBlocks.length > 0) {
      formatted += `### Code Snippets Found\n\n`;
      data.codeBlocks.forEach((code, index) => {
        formatted += `\`\`\`\n${code}\n\`\`\`\n\n`;
      });
    }

    if (data.images.length > 0) {
      formatted += `### Images Referenced\n\n`;
      data.images.forEach(img => {
        formatted += `- ${img}\n`;
      });
    }

    return formatted;
  }

  async importFigmaDesign(figmaUrl: string): Promise<{
    content: string;
    components?: any[];
    styles?: any[];
  }> {
    // This would integrate with Figma API
    // For now, return a placeholder
    return {
      content: `Figma design import from ${figmaUrl} - Full implementation requires Figma API token`,
      components: [],
      styles: []
    };
  }

  async importGitHubRepo(repoUrl: string): Promise<{
    content: string;
    files?: any[];
    readme?: string;
  }> {
    // Extract owner and repo from URL
    const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }

    const [, owner, repo] = match;
    
    interface GitHubRepo {
      full_name: string;
      description: string | null;
      language: string | null;
      stargazers_count: number;
      forks_count: number;
      created_at: string;
      updated_at: string;
      clone_url: string;
    }
    
    try {
      // Fetch repository information
      const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'E-Code-Platform'
        }
      });

      if (!repoResponse.ok) {
        throw new Error('Failed to fetch repository information');
      }

      const repoData = await repoResponse.json() as GitHubRepo;

      // Fetch README
      let readme = '';
      try {
        const readmeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
          headers: {
            'Accept': 'application/vnd.github.v3.raw',
            'User-Agent': 'E-Code-Platform'
          }
        });
        
        if (readmeResponse.ok) {
          readme = await readmeResponse.text();
        }
      } catch (error) {
        logger.warn('No README found for repository');
      }

      const content = `# GitHub Repository Import

**Repository:** ${repoData.full_name}
**Description:** ${repoData.description || 'No description provided'}
**Language:** ${repoData.language || 'Unknown'}
**Stars:** ${repoData.stargazers_count}
**Forks:** ${repoData.forks_count}
**Created:** ${new Date(repoData.created_at).toLocaleDateString()}
**Updated:** ${new Date(repoData.updated_at).toLocaleDateString()}

## README

${readme || 'No README available'}

## Import Instructions

To fully import this repository:
1. Use the GitHub import feature in the projects page
2. Or clone using: \`git clone ${repoData.clone_url}\`
`;

      return {
        content,
        readme
      };
    } catch (error) {
      logger.error(`Failed to import GitHub repo ${repoUrl}:`, error);
      throw error;
    }
  }
}

export const webImportService = new WebImportService();