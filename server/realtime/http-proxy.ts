import { Request, Response } from 'express';
import axios, { AxiosRequestConfig } from 'axios';
import { createLogger } from '../utils/logger';
import { URL } from 'url';

const logger = createLogger('http-proxy');

// Whitelist of allowed domains for security
const ALLOWED_DOMAINS = [
  'api.github.com',
  'api.openai.com',
  'api.anthropic.com',
  'jsonplaceholder.typicode.com',
  'api.stripe.com',
  'api.twilio.com',
  'httpbin.org',
  'echo.websocket.org'
];

export class HttpProxyService {
  private requestHistory: Map<string, any[]> = new Map();
  
  async proxyRequest(req: Request, res: Response) {
    try {
      const { method, url, headers, body } = req.body;
      
      if (!url || !method) {
        return res.status(400).json({ 
          error: 'URL and method are required' 
        });
      }
      
      // Security check - validate domain
      const urlObj = new URL(url);
      const isAllowed = ALLOWED_DOMAINS.some(domain => 
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );
      
      if (!isAllowed && process.env.NODE_ENV === 'production') {
        return res.status(403).json({ 
          error: 'Domain not allowed. Contact support to whitelist this domain.' 
        });
      }
      
      // Build axios config
      const config: AxiosRequestConfig = {
        method,
        url,
        headers: this.sanitizeHeaders(headers || {}),
        data: body,
        timeout: 30000,
        validateStatus: () => true // Don't throw on any status
      };
      
      // Track request start time
      const startTime = Date.now();
      
      // Make the actual request
      const response = await axios(config);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Store in history
      const projectId = req.body.projectId;
      if (projectId) {
        this.addToHistory(projectId, {
          method,
          url,
          requestHeaders: headers,
          requestBody: body,
          status: response.status,
          statusText: response.statusText,
          responseHeaders: response.headers,
          responseBody: response.data,
          responseTime,
          timestamp: new Date()
        });
      }
      
      // Return the proxied response
      res.status(200).json({
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
        responseTime
      });
      
    } catch (error: any) {
      logger.error('Proxy request error:', error);
      
      res.status(500).json({
        error: 'Proxy request failed',
        message: error.message,
        code: error.code
      });
    }
  }
  
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sanitized = { ...headers };
    
    // Remove sensitive headers that shouldn't be proxied
    delete sanitized['host'];
    delete sanitized['connection'];
    delete sanitized['cookie'];
    delete sanitized['authorization']; // Will be re-added if explicitly set
    
    // Add proxy identification
    sanitized['X-Forwarded-For'] = 'E-Code-Proxy';
    sanitized['User-Agent'] = sanitized['User-Agent'] || 'E-Code-HTTP-Client/1.0';
    
    return sanitized;
  }
  
  private addToHistory(projectId: string, request: any) {
    const key = `project:${projectId}`;
    
    if (!this.requestHistory.has(key)) {
      this.requestHistory.set(key, []);
    }
    
    const history = this.requestHistory.get(key)!;
    history.unshift(request); // Add to beginning
    
    // Keep only last 100 requests per project
    if (history.length > 100) {
      history.pop();
    }
  }
  
  getProjectHistory(projectId: string): any[] {
    return this.requestHistory.get(`project:${projectId}`) || [];
  }
  
  clearProjectHistory(projectId: string) {
    this.requestHistory.delete(`project:${projectId}`);
  }
  
  async testConnection(url: string): Promise<boolean> {
    try {
      const response = await axios.head(url, { timeout: 5000 });
      return response.status < 400;
    } catch (error) {
      return false;
    }
  }
}

export const httpProxyService = new HttpProxyService();