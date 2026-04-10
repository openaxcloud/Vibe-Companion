/**
 * Frontend Security Utilities
 * Client-side protection mechanisms
 */

import DOMPurify from 'dompurify';

/**
 * XSS Protection
 */
export const xssProtection = {
  // Sanitize HTML content
  sanitizeHtml: (dirty: string, options?: DOMPurify.Config): string => {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true,
      ...options,
    });
  },

  // Sanitize user input
  sanitizeInput: (input: string): string => {
    return DOMPurify.sanitize(input, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
    });
  },

  // Escape HTML entities
  escapeHtml: (text: string): string => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  // Validate URL to prevent javascript: protocol
  validateUrl: (url: string): boolean => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  },
};

/**
 * Secure Local Storage
 */
export class SecureStorage {
  private static encryptionKey: string | null = null;

  // Initialize with encryption key (from server or generated)
  static initialize(key?: string): void {
    this.encryptionKey = key || this.generateKey();
  }

  // Generate a simple encryption key (for demo purposes)
  private static generateKey(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Simple XOR encryption (in production, use proper encryption)
  private static encrypt(text: string): string {
    if (!this.encryptionKey) this.initialize();
    
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ this.encryptionKey!.charCodeAt(i % this.encryptionKey!.length)
      );
    }
    return btoa(result); // Base64 encode
  }

  // Simple XOR decryption
  private static decrypt(encrypted: string): string {
    if (!this.encryptionKey) this.initialize();
    
    const text = atob(encrypted); // Base64 decode
    let result = '';
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(
        text.charCodeAt(i) ^ this.encryptionKey!.charCodeAt(i % this.encryptionKey!.length)
      );
    }
    return result;
  }

  // Set item with encryption and expiry
  static setItem(key: string, value: any, expiryMinutes?: number): void {
    const data = {
      value,
      expiry: expiryMinutes ? Date.now() + expiryMinutes * 60000 : null,
    };
    
    const encrypted = this.encrypt(JSON.stringify(data));
    localStorage.setItem(`secure_${key}`, encrypted);
  }

  // Get item with decryption and expiry check
  static getItem<T = any>(key: string): T | null {
    const encrypted = localStorage.getItem(`secure_${key}`);
    if (!encrypted) return null;

    try {
      const decrypted = this.decrypt(encrypted);
      const data = JSON.parse(decrypted);
      
      // Check expiry
      if (data.expiry && Date.now() > data.expiry) {
        this.removeItem(key);
        return null;
      }
      
      return data.value;
    } catch (error) {
      console.error('Failed to decrypt storage item:', error);
      this.removeItem(key);
      return null;
    }
  }

  // Remove item
  static removeItem(key: string): void {
    localStorage.removeItem(`secure_${key}`);
  }

  // Clear all secure items
  static clear(): void {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('secure_'));
    keys.forEach(key => localStorage.removeItem(key));
  }

  // Check if storage is available and secure
  static isAvailable(): boolean {
    try {
      const test = '__secure_storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * CSRF Token Management
 */
export class CSRFManager {
  private static token: string | null = null;
  private static tokenExpiry: number = 0;

  // Set CSRF token from server
  static setToken(token: string, expiryMinutes: number = 60): void {
    this.token = token;
    this.tokenExpiry = Date.now() + expiryMinutes * 60000;
    SecureStorage.setItem('csrf_token', token, expiryMinutes);
  }

  // Get current CSRF token
  static getToken(): string | null {
    // Check if token is expired
    if (this.tokenExpiry && Date.now() > this.tokenExpiry) {
      this.token = null;
    }

    // Try to get from memory first
    if (this.token) return this.token;

    // Try to get from secure storage
    const stored = SecureStorage.getItem<string>('csrf_token');
    if (stored) {
      this.token = stored;
      return stored;
    }

    return null;
  }

  // Add CSRF token to request headers
  static addToHeaders(headers: HeadersInit = {}): HeadersInit {
    const token = this.getToken();
    if (token) {
      return {
        ...headers,
        'X-CSRF-Token': token,
      };
    }
    return headers;
  }

  // Validate CSRF token in form
  static validateForm(formData: FormData): boolean {
    const formToken = formData.get('csrf_token') as string;
    const currentToken = this.getToken();
    return !!formToken && formToken === currentToken;
  }

  // Clear token
  static clear(): void {
    this.token = null;
    this.tokenExpiry = 0;
    SecureStorage.removeItem('csrf_token');
  }
}

/**
 * Click-jacking Protection
 */
export const clickjackingProtection = {
  // Check if page is in iframe
  isFramed: (): boolean => {
    try {
      return window.self !== window.top;
    } catch {
      return true; // Assume framed if can't access top
    }
  },

  // Bust out of frames
  bustFrame(): void {
    if (clickjackingProtection.isFramed()) {
      window.top!.location.href = window.self.location.href;
    }
  },

  // Hide content if framed
  hideIfFramed(): void {
    if (clickjackingProtection.isFramed()) {
      document.body.style.display = 'none';
      console.error('Page cannot be displayed in a frame');
    }
  },

  // Add frame-busting CSS
  addFrameBustingCSS(): void {
    const style = document.createElement('style');
    style.textContent = `
      html { display: none !important; }
      @media print { html { display: block !important; } }
    `;
    document.head.appendChild(style);

    // Show content only if not framed
    if (!clickjackingProtection.isFramed()) {
      style.textContent = '';
    }
  },
};

/**
 * Content Security Policy
 */
export const contentSecurity = {
  // Report CSP violations
  reportViolation: (violation: SecurityPolicyViolationEvent): void => {
    const report = {
      documentUri: violation.documentURI,
      violatedDirective: violation.violatedDirective,
      blockedUri: violation.blockedURI,
      lineNumber: violation.lineNumber,
      columnNumber: violation.columnNumber,
      sourceFile: violation.sourceFile,
      timestamp: Date.now(),
    };

    // Send to server
    fetch('/api/security/csp-report', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...CSRFManager.addToHeaders(),
      },
      body: JSON.stringify(report),
    }).catch(error => {
      console.error('Failed to report CSP violation:', error);
    });
  },

  // Initialize CSP event listener
  initialize: (): void => {
    document.addEventListener('securitypolicyviolation', contentSecurity.reportViolation);
  },
};

/**
 * Input Validation
 */
export const inputValidation = {
  // Validate email
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Validate URL
  isValidUrl: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // Validate phone number
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  },

  // Validate alphanumeric
  isAlphanumeric: (text: string): boolean => {
    return /^[a-zA-Z0-9]+$/.test(text);
  },

  // Validate username
  isValidUsername: (username: string): boolean => {
    return /^[a-zA-Z0-9_-]{3,20}$/.test(username);
  },

  // Validate password strength
  checkPasswordStrength: (password: string): {
    score: number;
    feedback: string[];
  } => {
    let score = 0;
    const feedback: string[] = [];

    if (password.length >= 8) score++;
    else feedback.push('Password should be at least 8 characters');

    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    else feedback.push('Add uppercase letters');

    if (/[a-z]/.test(password)) score++;
    else feedback.push('Add lowercase letters');

    if (/[0-9]/.test(password)) score++;
    else feedback.push('Add numbers');

    if (/[^A-Za-z0-9]/.test(password)) score++;
    else feedback.push('Add special characters');

    // Check for common patterns
    if (!/(.)\1{2,}/.test(password)) score++;
    else feedback.push('Avoid repeated characters');

    return { score: Math.min(score, 5), feedback };
  },
};

/**
 * Rate Limiting (client-side)
 */
export class RateLimiter {
  private static attempts: Map<string, { count: number; resetTime: number }> = new Map();

  static check(key: string, maxAttempts: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const record = this.attempts.get(key) || { count: 0, resetTime: now + windowMs };

    // Reset if window expired
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    // Check if limit exceeded
    if (record.count >= maxAttempts) {
      return false;
    }

    // Increment and store
    record.count++;
    this.attempts.set(key, record);
    return true;
  }

  static getRemainingTime(key: string): number {
    const record = this.attempts.get(key);
    if (!record) return 0;
    
    const remaining = record.resetTime - Date.now();
    return Math.max(0, Math.ceil(remaining / 1000));
  }

  static reset(key: string): void {
    this.attempts.delete(key);
  }

  static clearAll(): void {
    this.attempts.clear();
  }
}

/**
 * Secure Fetch Wrapper
 */
export const secureFetch = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  // Add security headers
  const headers = new Headers(options.headers);
  
  // Add CSRF token for state-changing requests
  if (options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method)) {
    const csrfHeaders = CSRFManager.addToHeaders();
    Object.entries(csrfHeaders).forEach(([key, value]) => {
      headers.set(key, value as string);
    });
  }

  // Add security headers
  headers.set('X-Requested-With', 'XMLHttpRequest');

  // Validate URL
  if (!xssProtection.validateUrl(url) && !url.startsWith('/')) {
    throw new Error('Invalid URL');
  }

  // Perform fetch with timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000); // 30 second timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'same-origin', // Include cookies for same-origin requests
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
};

/**
 * Session Security
 */
export const sessionSecurity = {
  // Monitor session activity
  lastActivity: Date.now(),
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
  warningTimeout: 25 * 60 * 1000, // 25 minutes

  // Update activity
  updateActivity: (): void => {
    sessionSecurity.lastActivity = Date.now();
  },

  // Check if session is expired
  isExpired: (): boolean => {
    return Date.now() - sessionSecurity.lastActivity > sessionSecurity.inactivityTimeout;
  },

  // Check if should warn
  shouldWarn: (): boolean => {
    return Date.now() - sessionSecurity.lastActivity > sessionSecurity.warningTimeout;
  },

  // Initialize activity monitoring
  initialize: (onExpire: () => void, onWarn: () => void): void => {
    // Update activity on user interaction
    ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
      document.addEventListener(event, sessionSecurity.updateActivity);
    });

    // Check session periodically
    setInterval(() => {
      if (sessionSecurity.isExpired()) {
        onExpire();
      } else if (sessionSecurity.shouldWarn()) {
        onWarn();
      }
    }, 60000); // Check every minute
  },
};

/**
 * Initialize all security features
 */
export const initializeSecurity = (): void => {
  // Initialize secure storage
  SecureStorage.initialize();

  // Initialize CSP monitoring
  contentSecurity.initialize();

  // Check for click-jacking
  clickjackingProtection.hideIfFramed();

  // Initialize session monitoring
  sessionSecurity.initialize(
    () => {
      // Session expired
      console.warn('Session expired due to inactivity');
      window.location.href = '/login';
    },
    () => {
      // Warn about expiring session
      console.warn('Session will expire soon');
    }
  );

  // Add unload handler to clean sensitive data
  window.addEventListener('unload', () => {
    CSRFManager.clear();
    RateLimiter.clearAll();
  });
};

export default {
  xssProtection,
  SecureStorage,
  CSRFManager,
  clickjackingProtection,
  contentSecurity,
  inputValidation,
  RateLimiter,
  secureFetch,
  sessionSecurity,
  initializeSecurity,
};