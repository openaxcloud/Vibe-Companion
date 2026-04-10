// @ts-nocheck
/**
 * MCP Server Authentication Layer
 * Provides OAuth and API key authentication for external clients like Claude.ai
 */

import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// MCP authentication configuration
export const MCP_AUTH_CONFIG = {
  // API key for simple authentication
  apiKeys: new Set([
    process.env.MCP_API_KEY || 'mcp_key_' + crypto.randomBytes(32).toString('hex')
  ]),
  
  // OAuth configuration for Claude.ai
  oauth: {
    clientId: process.env.MCP_OAUTH_CLIENT_ID || 'ecode-mcp-server',
    clientSecret: process.env.MCP_OAUTH_CLIENT_SECRET || crypto.randomBytes(32).toString('hex'),
    redirectUri: process.env.MCP_OAUTH_REDIRECT_URI || 'https://claude.ai/auth/callback',
    scopes: ['tools:read', 'tools:execute', 'resources:read', 'resources:write']
  },
  
  // JWT configuration
  jwt: {
    secret: process.env.MCP_JWT_SECRET || crypto.randomBytes(64).toString('hex'),
    expiresIn: '24h'
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100
  }
};

// Store active OAuth sessions
const oauthSessions = new Map<string, {
  state: string;
  codeChallenge?: string;
  createdAt: Date;
  scopes: string[];
}>();

// Store issued tokens
const issuedTokens = new Map<string, {
  type: 'bearer' | 'api_key';
  scopes: string[];
  createdAt: Date;
  expiresAt: Date;
  clientId?: string;
}>();

/**
 * Middleware to authenticate MCP requests
 */
export function authenticateMCP(req: Request, res: Response, next: NextFunction) {
  // Check for API key authentication
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey && MCP_AUTH_CONFIG.apiKeys.has(apiKey)) {
    req.user = { type: 'api_key', id: 'api_user' };
    return next();
  }
  
  // Check for Bearer token authentication
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    
    try {
      const decoded = jwt.verify(token, MCP_AUTH_CONFIG.jwt.secret) as any;
      
      // Check if token is still valid
      if (issuedTokens.has(token)) {
        const tokenInfo = issuedTokens.get(token)!;
        if (new Date() < tokenInfo.expiresAt) {
          req.user = { type: 'oauth', id: decoded.sub, scopes: tokenInfo.scopes };
          return next();
        }
      }
    } catch (error) {
      // Invalid token
    }
  }
  
  // No valid authentication found
  res.status(401).json({ 
    error: 'Authentication required',
    message: 'Please provide a valid API key or OAuth token'
  });
}

/**
 * OAuth authorization endpoint
 */
export function oauthAuthorize(req: Request, res: Response) {
  const {
    response_type,
    client_id,
    redirect_uri,
    scope,
    state,
    code_challenge,
    code_challenge_method
  } = req.query as Record<string, string>;
  
  // Validate required parameters
  if (response_type !== 'code') {
    return res.status(400).json({ error: 'unsupported_response_type' });
  }
  
  if (client_id !== MCP_AUTH_CONFIG.oauth.clientId) {
    return res.status(400).json({ error: 'invalid_client' });
  }
  
  // Generate authorization code
  const authCode = crypto.randomBytes(32).toString('hex');
  
  // Store session
  oauthSessions.set(authCode, {
    state: state || '',
    codeChallenge: code_challenge,
    createdAt: new Date(),
    scopes: scope ? scope.split(' ') : MCP_AUTH_CONFIG.oauth.scopes
  });
  
  // Clean up old sessions
  const now = new Date().getTime();
  oauthSessions.forEach((session, code) => {
    if (now - session.createdAt.getTime() > 10 * 60 * 1000) {
      oauthSessions.delete(code);
    }
  });
  
  // Redirect back to Claude.ai with authorization code
  const redirectUrl = new URL(redirect_uri || MCP_AUTH_CONFIG.oauth.redirectUri);
  redirectUrl.searchParams.set('code', authCode);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }
  
  res.redirect(redirectUrl.toString());
}

/**
 * OAuth token endpoint
 */
export function oauthToken(req: Request, res: Response) {
  const {
    grant_type,
    code,
    client_id,
    client_secret,
    code_verifier,
    refresh_token
  } = req.body;
  
  // Validate client credentials
  if (client_id !== MCP_AUTH_CONFIG.oauth.clientId || 
      client_secret !== MCP_AUTH_CONFIG.oauth.clientSecret) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  
  if (grant_type === 'authorization_code') {
    // Validate authorization code
    if (!code || !oauthSessions.has(code)) {
      return res.status(400).json({ error: 'invalid_grant' });
    }
    
    const session = oauthSessions.get(code)!;
    oauthSessions.delete(code);
    
    // Validate PKCE if used
    if (session.codeChallenge && code_verifier) {
      const challenge = crypto
        .createHash('sha256')
        .update(code_verifier)
        .digest('base64url');
      
      if (challenge !== session.codeChallenge) {
        return res.status(400).json({ error: 'invalid_grant' });
      }
    }
    
    // Generate access token
    const accessToken = jwt.sign(
      {
        sub: client_id,
        scopes: session.scopes,
        type: 'access_token'
      },
      MCP_AUTH_CONFIG.jwt.secret,
      { expiresIn: MCP_AUTH_CONFIG.jwt.expiresIn } as jwt.SignOptions
    );
    
    // Generate refresh token
    const refreshTokenValue = jwt.sign(
      {
        sub: client_id,
        type: 'refresh_token'
      },
      MCP_AUTH_CONFIG.jwt.secret,
      { expiresIn: '30d' } as jwt.SignOptions
    );
    
    // Store token info
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    issuedTokens.set(accessToken, {
      type: 'bearer',
      scopes: session.scopes,
      createdAt: new Date(),
      expiresAt,
      clientId: client_id
    });
    
    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24 hours
      refresh_token: refreshTokenValue,
      scope: session.scopes.join(' ')
    });
  } else if (grant_type === 'refresh_token') {
    // Validate refresh token
    try {
      const decoded = jwt.verify(refresh_token, MCP_AUTH_CONFIG.jwt.secret) as any;
      
      if (decoded.type !== 'refresh_token') {
        return res.status(400).json({ error: 'invalid_grant' });
      }
      
      // Generate new access token
      const accessToken = jwt.sign(
        {
          sub: decoded.sub,
          scopes: MCP_AUTH_CONFIG.oauth.scopes,
          type: 'access_token'
        },
        MCP_AUTH_CONFIG.jwt.secret,
        { expiresIn: MCP_AUTH_CONFIG.jwt.expiresIn } as jwt.SignOptions
      );
      
      // Store token info
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      
      issuedTokens.set(accessToken, {
        type: 'bearer',
        scopes: MCP_AUTH_CONFIG.oauth.scopes,
        createdAt: new Date(),
        expiresAt,
        clientId: decoded.sub
      });
      
      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 86400,
        scope: MCP_AUTH_CONFIG.oauth.scopes.join(' ')
      });
    } catch (error) {
      res.status(400).json({ error: 'invalid_grant' });
    }
  } else {
    res.status(400).json({ error: 'unsupported_grant_type' });
  }
}

/**
 * Get authentication info for display
 */
export function getAuthInfo() {
  const apiKey = Array.from(MCP_AUTH_CONFIG.apiKeys)[0];
  
  return {
    apiKey: process.env.NODE_ENV === 'production' ? 'Hidden in production' : apiKey,
    oauth: {
      authorizationUrl: '/mcp/oauth/authorize',
      tokenUrl: '/mcp/oauth/token',
      clientId: MCP_AUTH_CONFIG.oauth.clientId,
      scopes: MCP_AUTH_CONFIG.oauth.scopes
    },
    endpoints: {
      connect: '/mcp/connect',
      message: '/mcp/message',
      tools: '/mcp/tools',
      resources: '/mcp/resources',
      events: '/mcp/events'
    }
  };
}