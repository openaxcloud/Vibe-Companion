// @ts-nocheck
/**
 * Input Validation Utilities
 * Comprehensive validation for all user inputs
 */

import validator from 'validator';
import { createLogger } from './logger';

const logger = createLogger('validators');

// Lazy-load isomorphic-dompurify to avoid jsdom issues in production bundles
let DOMPurifyInstance: typeof import('isomorphic-dompurify').default | null = null;

async function getDOMPurify(): Promise<typeof import('isomorphic-dompurify').default | null> {
  if (DOMPurifyInstance) return DOMPurifyInstance;
  try {
    const module = await import('isomorphic-dompurify');
    DOMPurifyInstance = module.default;
    return DOMPurifyInstance;
  } catch {
    return null;
  }
}

// Initialize DOMPurify asynchronously
getDOMPurify().catch(() => {});

// Fallback sanitization when DOMPurify is not available
function fallbackSanitizeHTML(input: string): string {
  const ALLOWED_TAGS = ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'];
  return input.replace(/<\/?([a-zA-Z0-9]+)[^>]*>/gi, (match, tagName) => {
    const tag = tagName.toLowerCase();
    if (ALLOWED_TAGS.includes(tag)) {
      if (tag === 'a') {
        const hrefMatch = match.match(/href="([^"]+)"/i);
        if (hrefMatch && !hrefMatch[1].toLowerCase().startsWith('javascript:')) {
          return match.startsWith('</') ? `</${tag}>` : `<${tag} href="${hrefMatch[1]}" rel="noopener noreferrer">`;
        }
      }
      return match.startsWith('</') ? `</${tag}>` : `<${tag}>`;
    }
    return '';
  });
}

export const validators = {
  /**
   * Validate email address
   */
  email: (email: string): boolean => {
    if (!email || typeof email !== 'string') return false;
    return validator.isEmail(email);
  },
  
  /**
   * Validate username
   */
  username: (username: string): boolean => {
    if (!username || typeof username !== 'string') return false;
    // 3-30 characters, alphanumeric, underscore, hyphen
    return /^[a-zA-Z0-9_-]{3,30}$/.test(username);
  },
  
  /**
   * Validate password strength
   */
  password: (password: string): boolean => {
    if (!password || typeof password !== 'string') return false;
    
    // At least 8 characters
    if (password.length < 8) return false;
    
    // Must contain uppercase, lowercase, number, and special character
    return /[A-Z]/.test(password) &&
           /[a-z]/.test(password) &&
           /[0-9]/.test(password) &&
           /[^A-Za-z0-9]/.test(password);
  },
  
  /**
   * Validate URL
   */
  url: (url: string): boolean => {
    if (!url || typeof url !== 'string') return false;
    
    return validator.isURL(url, {
      protocols: ['http', 'https'],
      require_protocol: true,
      require_valid_protocol: true,
      require_host: true,
      require_tld: process.env.NODE_ENV === 'production',
      allow_query_components: true,
      allow_fragments: true,
      validate_length: true
    });
  },
  
  /**
   * Sanitize HTML content
   */
  sanitizeHTML: (html: string): string => {
    if (!html || typeof html !== 'string') return '';
    
    if (DOMPurifyInstance) {
      return DOMPurifyInstance.sanitize(html, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code', 'pre', 'blockquote'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
        KEEP_CONTENT: true,
        ALLOW_DATA_ATTR: false,
        ADD_TAGS: [],
        ADD_ATTR: [],
        ADD_URI_SAFE_ATTR: [],
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
      });
    }
    return fallbackSanitizeHTML(html);
  },
  
  /**
   * Validate filename (prevent directory traversal)
   */
  filename: (filename: string): boolean => {
    if (!filename || typeof filename !== 'string') return false;
    
    // Check for directory traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      logger.warn('Directory traversal attempt detected', { filename });
      return false;
    }
    
    // Only allow safe characters
    return /^[a-zA-Z0-9_.-]+$/.test(filename) && filename.length <= 255;
  },
  
  /**
   * Validate UUID
   */
  uuid: (uuid: string): boolean => {
    if (!uuid || typeof uuid !== 'string') return false;
    return validator.isUUID(uuid);
  },
  
  /**
   * Validate JSON string
   */
  json: (jsonString: string): boolean => {
    if (!jsonString || typeof jsonString !== 'string') return false;
    
    try {
      JSON.parse(jsonString);
      return true;
    } catch {
      return false;
    }
  },
  
  /**
   * Validate phone number
   */
  phone: (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    return validator.isMobilePhone(phone, 'any', { strictMode: false });
  },
  
  /**
   * Validate credit card
   */
  creditCard: (cardNumber: string): boolean => {
    if (!cardNumber || typeof cardNumber !== 'string') return false;
    return validator.isCreditCard(cardNumber);
  },
  
  /**
   * Validate IP address
   */
  ip: (ip: string, version?: 4 | 6): boolean => {
    if (!ip || typeof ip !== 'string') return false;
    
    if (version) {
      return validator.isIP(ip, version);
    }
    
    return validator.isIP(ip);
  },
  
  /**
   * Validate port number
   */
  port: (port: string | number): boolean => {
    const portNum = typeof port === 'string' ? parseInt(port, 10) : port;
    return Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
  },
  
  /**
   * Validate date
   */
  date: (date: string, format?: string): boolean => {
    if (!date || typeof date !== 'string') return false;
    
    // ISO date format by default
    if (!format) {
      return validator.isISO8601(date);
    }
    
    return validator.isDate(date, { format, strictMode: true });
  },
  
  /**
   * Validate alphanumeric
   */
  alphanumeric: (text: string, locale?: validator.AlphanumericLocale): boolean => {
    if (!text || typeof text !== 'string') return false;
    return validator.isAlphanumeric(text, locale);
  },
  
  /**
   * Validate JWT token
   */
  jwt: (token: string): boolean => {
    if (!token || typeof token !== 'string') return false;
    return validator.isJWT(token);
  },
  
  /**
   * Validate base64
   */
  base64: (text: string): boolean => {
    if (!text || typeof text !== 'string') return false;
    return validator.isBase64(text);
  },
  
  /**
   * Validate hex color
   */
  hexColor: (color: string): boolean => {
    if (!color || typeof color !== 'string') return false;
    return validator.isHexColor(color);
  },
  
  /**
   * Validate MongoDB ObjectId
   */
  mongoId: (id: string): boolean => {
    if (!id || typeof id !== 'string') return false;
    return validator.isMongoId(id);
  },
  
  /**
   * Validate data URI
   */
  dataURI: (uri: string): boolean => {
    if (!uri || typeof uri !== 'string') return false;
    return validator.isDataURI(uri);
  },
  
  /**
   * Validate MIME type
   */
  mimeType: (type: string): boolean => {
    if (!type || typeof type !== 'string') return false;
    return validator.isMimeType(type);
  },
  
  /**
   * Sanitize input for display
   */
  sanitizeForDisplay: (input: string): string => {
    if (!input || typeof input !== 'string') return '';
    
    return input
      .replace(/[<>]/g, '') // Remove angle brackets
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .trim();
  },
  
  /**
   * Validate environment variable name
   */
  envVarName: (name: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    // Must start with letter or underscore, contain only alphanumeric and underscore
    return /^[A-Z_][A-Z0-9_]*$/.test(name);
  },
  
  /**
   * Validate Docker image name
   */
  dockerImage: (image: string): boolean => {
    if (!image || typeof image !== 'string') return false;
    // Basic Docker image name validation
    return /^[a-z0-9]+(?:[._-][a-z0-9]+)*(?:\/[a-z0-9]+(?:[._-][a-z0-9]+)*)*(?::[a-z0-9]+(?:[._-][a-z0-9]+)*)?$/.test(image);
  },
  
  /**
   * Validate semantic version
   */
  semver: (version: string): boolean => {
    if (!version || typeof version !== 'string') return false;
    return validator.isSemVer(version);
  },
  
  /**
   * Custom validation function
   */
  custom: (value: any, validationFn: (value: any) => boolean): boolean => {
    try {
      return validationFn(value);
    } catch (error) {
      logger.error('Custom validation error', { error });
      return false;
    }
  }
};

/**
 * Validation middleware factory
 */
export const validate = (rules: Record<string, any>) => {
  return (req: any, res: any, next: any) => {
    const errors: Record<string, string> = {};
    
    for (const [field, rule] of Object.entries(rules)) {
      const value = req.body[field] || req.query[field] || req.params[field];
      
      // Check required fields
      if (rule.required && !value) {
        errors[field] = `${field} is required`;
        continue;
      }
      
      // Skip validation if field is optional and not provided
      if (!rule.required && !value) {
        continue;
      }
      
      // Run validation
      if (rule.type) {
        const validator = validators[rule.type as keyof typeof validators];
        if (validator && typeof validator === 'function') {
          const isValid = validator(value as any);
          if (!isValid) {
            errors[field] = rule.message || `${field} is invalid`;
          }
        }
      }
      
      // Custom validation
      if (rule.custom && typeof rule.custom === 'function') {
        const isValid = rule.custom(value);
        if (!isValid) {
          errors[field] = rule.message || `${field} failed custom validation`;
        }
      }
      
      // Min/max length
      if (rule.minLength && value.length < rule.minLength) {
        errors[field] = `${field} must be at least ${rule.minLength} characters`;
      }
      
      if (rule.maxLength && value.length > rule.maxLength) {
        errors[field] = `${field} must be at most ${rule.maxLength} characters`;
      }
      
      // Min/max value
      if (rule.min !== undefined && Number(value) < rule.min) {
        errors[field] = `${field} must be at least ${rule.min}`;
      }
      
      if (rule.max !== undefined && Number(value) > rule.max) {
        errors[field] = `${field} must be at most ${rule.max}`;
      }
    }
    
    if (Object.keys(errors).length > 0) {
      logger.warn('Validation errors', { errors, ip: req.ip });
      return res.status(400).json({ errors });
    }
    
    next();
  };
};