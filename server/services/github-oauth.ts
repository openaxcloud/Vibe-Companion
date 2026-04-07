import { Request, Response, NextFunction } from 'express';
import fetch from 'node-fetch';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger';

const logger = createLogger('github-oauth-service');

interface GitHubUser {
  id: number;
  login: string;
  name: string;
  email: string;
  avatar_url: string;
  html_url: string;
}

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  private: boolean;
  fork: boolean;
  created_at: string;
  updated_at: string;
  pushed_at: string;
  language: string;
  stargazers_count: number;
  watchers_count: number;
  forks_count: number;
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export class GitHubOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;

  constructor() {
    // Environment variables are required for GitHub OAuth
    this.clientId = process.env.GITHUB_CLIENT_ID || '';
    this.clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    this.redirectUri = process.env.GITHUB_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/github/callback`;
    
    // Validate configuration on initialization
    if (!this.clientId || !this.clientSecret) {
      logger.warn('[GitHubOAuthService] WARNING: GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables to enable GitHub integration.');
    }
  }
  
  // Check if GitHub OAuth is properly configured
  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret && 
              this.clientId !== '' && this.clientSecret !== '');
  }

  // Generate OAuth authorization URL
  getAuthorizationUrl(state: string): string {
    if (!this.isConfigured()) {
      throw new Error('GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.');
    }
    
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: 'repo user:email',
      state: state,
      allow_signup: 'true'
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForToken(code: string): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('GitHub OAuth is not configured. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.');
    }
    
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code: code,
        redirect_uri: this.redirectUri
      })
    });

    const data = await response.json() as any;

    if (data.error) {
      throw new Error(data.error_description || 'Failed to exchange code for token');
    }

    return data.access_token;
  }

  // Get GitHub user information
  async getUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch GitHub user');
    }

    return await response.json() as GitHubUser;
  }

  // Get user's repositories
  async getUserRepos(accessToken: string, page: number = 1, perPage: number = 30): Promise<GitHubRepo[]> {
    const response = await fetch(`https://api.github.com/user/repos?page=${page}&per_page=${perPage}&sort=updated`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }

    return await response.json() as GitHubRepo[];
  }

  // Get a specific repository
  async getRepository(accessToken: string, owner: string, repo: string): Promise<GitHubRepo> {
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch repository');
    }

    return await response.json() as GitHubRepo;
  }

  // Clone repository contents
  async cloneRepository(accessToken: string, owner: string, repo: string, branch?: string): Promise<any> {
    // First, get the repository info
    const repoInfo = await this.getRepository(accessToken, owner, repo);
    const defaultBranch = branch || repoInfo.default_branch;

    // Get the tree for the repository
    const treeResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (!treeResponse.ok) {
      throw new Error('Failed to fetch repository tree');
    }

    const tree = await treeResponse.json() as any;
    const files: Array<{ path: string; content: string }> = [];

    // Fetch content for each file (excluding directories)
    for (const item of tree.tree) {
      if (item.type === 'blob' && item.size < 1000000) { // Skip files larger than 1MB
        try {
          const contentResponse = await fetch(item.url, {
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `Bearer ${accessToken}`
            }
          });

          if (contentResponse.ok) {
            const contentData = await contentResponse.json() as any;
            if (contentData.encoding === 'base64' && contentData.content) {
              const content = Buffer.from(contentData.content, 'base64').toString('utf-8');
              files.push({
                path: item.path,
                content: content
              });
            }
          }
        } catch (error) {
          logger.error(`Failed to fetch content for ${item.path}:`, error);
        }
      }
    }

    return {
      repository: repoInfo,
      files: files,
      branch: defaultBranch
    };
  }

  // Store GitHub token for user with AES-256-GCM encryption
  async storeUserToken(userId: number, accessToken: string, githubUser: GitHubUser): Promise<void> {
    const { encryptToken } = await import('./credential-encryption');
    
    try {
      const { ciphertext, iv } = encryptToken(accessToken);
      
      await storage.updateUser(String(userId), {
        githubUsername: githubUser.login,
        avatarUrl: githubUser.avatar_url || undefined,
        githubTokenCiphertext: ciphertext,
        githubTokenIv: iv,
        githubTokenCreatedAt: new Date()
      });
      
      logger.info(`[GitHubOAuthService] Token stored securely for user ${userId}`);
    } catch (error) {
      logger.error('[GitHubOAuthService] Failed to store token:', error);
      throw new Error('Failed to store GitHub credentials securely');
    }
  }

  private static readonly TOKEN_WARNING_AGE_DAYS = 30;

  async isTokenExpired(userId: number): Promise<boolean> {
    try {
      const user = await storage.getUser(String(userId));
      if (!user?.githubTokenCreatedAt) {
        return true;
      }
      
      const tokenAge = Date.now() - new Date(user.githubTokenCreatedAt).getTime();
      const thirtyDaysMs = GitHubOAuthService.TOKEN_WARNING_AGE_DAYS * 24 * 60 * 60 * 1000;
      
      return tokenAge > thirtyDaysMs;
    } catch (error) {
      logger.error('[GitHubOAuthService] Failed to check token expiration:', error);
      return true;
    }
  }

  // Get stored GitHub token (decrypted)
  async getUserToken(userId: number): Promise<string | null> {
    try {
      const user = await storage.getUser(String(userId));
      if (!user?.githubTokenCiphertext || !user?.githubTokenIv) {
        return null;
      }
      
      // SECURITY POLICY: Tokens older than 30 days are denied for security.
      // Users must re-authenticate to get a fresh token.
      if (user.githubTokenCreatedAt) {
        const tokenAge = Date.now() - new Date(user.githubTokenCreatedAt).getTime();
        const thirtyDaysMs = GitHubOAuthService.TOKEN_WARNING_AGE_DAYS * 24 * 60 * 60 * 1000;
        
        if (tokenAge > thirtyDaysMs) {
          const daysOld = Math.floor(tokenAge / (24 * 60 * 60 * 1000));
          logger.warn(`[GitHubOAuthService] Token for user ${userId} is ${daysOld} days old (>${GitHubOAuthService.TOKEN_WARNING_AGE_DAYS} days). Re-authentication required for security.`);
          return null; // SECURITY: Deny usage of stale tokens
        }
      }
      
      const { decryptToken } = await import('./credential-encryption');
      return decryptToken(user.githubTokenCiphertext, user.githubTokenIv);
    } catch (error) {
      logger.error('[GitHubOAuthService] Failed to decrypt token:', error);
      return null;
    }
  }

  // Validate if stored token is still valid
  async validateStoredToken(userId: number): Promise<boolean> {
    const token = await this.getUserToken(userId);
    if (!token) return false;
    
    try {
      await this.getUser(token);
      return true;
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return false;
    }
  }

  // Get GitHub connection status with user info (uses cached username, no API call)
  async getConnectionStatus(userId: number): Promise<{ connected: boolean; username?: string; avatarUrl?: string }> {
    try {
      const user = await storage.getUser(String(userId));
      if (!user?.githubTokenCiphertext || !user?.githubTokenIv || !user?.githubUsername) {
        return { connected: false };
      }
      
      // Use cached username instead of making API call
      return {
        connected: true,
        username: user.githubUsername,
        avatarUrl: user.avatarUrl || undefined
      };
    } catch (err: any) { console.error("[catch]", err?.message || err);
      return { connected: false };
    }
  }

  // Get Git credentials for push/pull operations (uses cached username, no API call)
  // SECURITY: Uses getUserToken() to enforce 30-day token expiration policy
  async getGitCredentials(userId: number): Promise<{ username: string; password: string } | null> {
    try {
      const user = await storage.getUser(String(userId));
      if (!user?.githubUsername) {
        return null;
      }
      
      // SECURITY: Reuse getUserToken() to enforce expiration policy
      const token = await this.getUserToken(userId);
      if (!token) {
        logger.warn(`[GitHubOAuthService] Git credentials denied for user ${userId} - token expired or missing`);
        return null;
      }
      
      return {
        username: user.githubUsername,
        password: token
      };
    } catch (error) {
      logger.error('[GitHubOAuthService] Failed to get Git credentials:', error);
      return null;
    }
  }

  // Remove GitHub connection
  async disconnectUser(userId: number): Promise<void> {
    try {
      await storage.updateUser(String(userId), {
        githubUsername: null,
        githubTokenCiphertext: null,
        githubTokenIv: null,
        githubTokenCreatedAt: null
      });
      logger.info(`[GitHubOAuthService] GitHub disconnected for user ${userId}`);
    } catch (error) {
      logger.warn('[GitHubOAuthService] Failed to clear GitHub connection:', error);
    }
  }

  // Middleware to check GitHub authentication
  requireGitHubAuth = async (req: any, res: Response, next: NextFunction) => {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const token = await this.getUserToken(req.user.id);
    if (!token) {
      return res.status(401).json({ error: 'GitHub not connected', requiresAuth: true });
    }

    req.githubToken = token;
    next();
  };
}

export const githubOAuth = new GitHubOAuthService();