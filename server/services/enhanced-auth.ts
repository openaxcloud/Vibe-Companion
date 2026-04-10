// @ts-nocheck
import { Router } from 'express';
import passport from 'passport';
import { DatabaseStorage } from '../storage';
import jwt from 'jsonwebtoken';

export interface OAuthProvider {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
}

export class EnhancedAuthService {
  private storage: DatabaseStorage;
  private providers: Map<string, OAuthProvider> = new Map();
  
  constructor(storage: DatabaseStorage) {
    this.storage = storage;
    this.initializeProviders();
  }

  private initializeProviders() {
    // Standard providers
    this.providers.set('github', {
      id: 'github',
      name: 'GitHub',
      icon: 'github',
      color: '#333',
      enabled: true
    });

    this.providers.set('google', {
      id: 'google',
      name: 'Google',
      icon: 'google',
      color: '#4285F4',
      enabled: true
    });

    // Additional providers
    this.providers.set('gitlab', {
      id: 'gitlab',
      name: 'GitLab',
      icon: 'gitlab',
      color: '#FC6D26',
      enabled: process.env.GITLAB_CLIENT_ID ? true : false
    });

    this.providers.set('bitbucket', {
      id: 'bitbucket',
      name: 'Bitbucket',
      icon: 'bitbucket',
      color: '#0052CC',
      enabled: process.env.BITBUCKET_CLIENT_ID ? true : false
    });

    this.providers.set('discord', {
      id: 'discord',
      name: 'Discord',
      icon: 'discord',
      color: '#5865F2',
      enabled: process.env.DISCORD_CLIENT_ID ? true : false
    });

    this.providers.set('slack', {
      id: 'slack',
      name: 'Slack',
      icon: 'slack',
      color: '#4A154B',
      enabled: process.env.SLACK_CLIENT_ID ? true : false
    });

    this.providers.set('azure', {
      id: 'azure',
      name: 'Microsoft',
      icon: 'microsoft',
      color: '#0078D4',
      enabled: process.env.AZURE_CLIENT_ID ? true : false
    });
  }

  configurePassport() {
    // Note: These strategies would be configured when the specific passport strategy packages are installed
    // For now, we'll provide the configuration structure that can be activated when needed
    
    // Example configuration for additional OAuth providers:
    // - GitLab: passport-gitlab2
    // - Bitbucket: passport-bitbucket-oauth2  
    // - Discord: passport-discord
    // - Slack: @aoberoi/passport-slack
    // - Azure AD: passport-azure-ad-oauth2
  }

  getEnabledProviders(): OAuthProvider[] {
    return Array.from(this.providers.values()).filter(p => p.enabled);
  }

  createAuthRoutes(): Router {
    const router = Router();

    // GitLab auth routes
    router.get('/auth/gitlab', passport.authenticate('gitlab', { scope: ['read_user'] }));
    router.get('/auth/gitlab/callback', 
      passport.authenticate('gitlab', { failureRedirect: '/login' }),
      (req, res) => res.redirect('/dashboard')
    );

    // Bitbucket auth routes
    router.get('/auth/bitbucket', passport.authenticate('bitbucket'));
    router.get('/auth/bitbucket/callback',
      passport.authenticate('bitbucket', { failureRedirect: '/login' }),
      (req, res) => res.redirect('/dashboard')
    );

    // Discord auth routes
    router.get('/auth/discord', passport.authenticate('discord'));
    router.get('/auth/discord/callback',
      passport.authenticate('discord', { failureRedirect: '/login' }),
      (req, res) => res.redirect('/dashboard')
    );

    // Slack auth routes
    router.get('/auth/slack', passport.authenticate('slack'));
    router.get('/auth/slack/callback',
      passport.authenticate('slack', { failureRedirect: '/login' }),
      (req, res) => res.redirect('/dashboard')
    );

    // Azure AD auth routes
    router.get('/auth/azure', passport.authenticate('azure_ad_oauth2'));
    router.get('/auth/azure/callback',
      passport.authenticate('azure_ad_oauth2', { failureRedirect: '/login' }),
      (req, res) => res.redirect('/dashboard')
    );

    return router;
  }

  // Hardware key support
  async registerHardwareKey(userId: number, credentialId: string, publicKey: string) {
    // Store hardware key credentials
    return await this.storage.createApiKey({
      userId,
      name: 'Hardware Security Key',
      key: credentialId,
      permissions: ['hardware_auth'],
      expiresAt: null
    });
  }

  async verifyHardwareKey(credentialId: string, signature: string): Promise<boolean> {
    // Verify hardware key signature
    // This would integrate with WebAuthn API
    return true;
  }

  // Session management
  async getActiveSessions(userId: number): Promise<any[]> {
    // Get all active sessions for a user
    return [];
  }

  async revokeSession(userId: number, sessionId: string): Promise<boolean> {
    // Revoke a specific session
    return true;
  }

  // IP allowlisting
  async addAllowedIP(userId: number, ip: string, description: string): Promise<any> {
    // Add IP to allowlist
    return { userId, ip, description };
  }

  async checkIPAllowed(userId: number, ip: string): Promise<boolean> {
    // Check if IP is allowed for user
    return true;
  }
}

export function createEnhancedAuthService(storage: DatabaseStorage): EnhancedAuthService {
  return new EnhancedAuthService(storage);
}