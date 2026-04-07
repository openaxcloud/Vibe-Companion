// @ts-nocheck
import { Request, Response } from 'express';
import { createLogger } from '../utils/logger';
import * as saml from 'samlify';
import { storage } from '../storage';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const logger = createLogger('enterprise-sso');

interface SSOProvider {
  id: string;
  name: string;
  type: 'saml' | 'oidc' | 'ldap';
  domain: string;
  enabled: boolean;
  config: any;
  createdAt: Date;
  updatedAt: Date;
}

interface SCIMUser {
  id: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
    formatted: string;
  };
  emails: Array<{
    value: string;
    type: string;
    primary: boolean;
  }>;
  active: boolean;
  groups: string[];
  externalId?: string;
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    version: string;
  };
}

interface SCIMGroup {
  id: string;
  displayName: string;
  members: Array<{
    value: string;
    display: string;
    type: string;
  }>;
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    version: string;
  };
}

export class EnterpriseSSOService {
  private ssoProviders: Map<string, SSOProvider> = new Map();
  private scimUsers: Map<string, SCIMUser> = new Map();
  private scimGroups: Map<string, SCIMGroup> = new Map();
  private samlProviders: Map<string, any> = new Map();

  constructor() {
    this.initializeDefaultProviders();
  }

  private initializeDefaultProviders() {
    // Initialize common SSO providers
    const defaultProviders: Partial<SSOProvider>[] = [
      {
        id: 'okta',
        name: 'Okta',
        type: 'saml',
        domain: '',
        enabled: false,
        config: {
          entryPoint: '',
          issuer: '',
          cert: '',
          callbackUrl: '/auth/saml/callback'
        }
      },
      {
        id: 'azure-ad',
        name: 'Azure Active Directory',
        type: 'oidc',
        domain: '',
        enabled: false,
        config: {
          clientId: '',
          clientSecret: '',
          tenantId: '',
          redirectUri: '/auth/oidc/callback'
        }
      },
      {
        id: 'google-workspace',
        name: 'Google Workspace',
        type: 'oidc',
        domain: '',
        enabled: false,
        config: {
          clientId: '',
          clientSecret: '',
          domain: '',
          redirectUri: '/auth/google/callback'
        }
      }
    ];

    defaultProviders.forEach(provider => {
      const ssoProvider: SSOProvider = {
        ...provider,
        createdAt: new Date(),
        updatedAt: new Date()
      } as SSOProvider;
      
      this.ssoProviders.set(provider.id!, ssoProvider);
    });
  }

  // SSO Provider Management
  async createSSOProvider(req: Request, res: Response) {
    try {
      const { name, type, domain, config } = req.body;

      if (!name || !type || !domain) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const id = crypto.randomUUID();
      const provider: SSOProvider = {
        id,
        name,
        type,
        domain,
        enabled: false,
        config,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      this.ssoProviders.set(id, provider);

      // Initialize SAML provider if needed
      if (type === 'saml' && config.cert && config.entryPoint) {
        try {
          const sp = saml.ServiceProvider({
            entityID: `${process.env.BASE_URL || 'http://localhost:5000'}/metadata/${id}`,
            authnRequestsSigned: false,
            wantAssertionsSigned: true,
            wantMessageSigned: true,
            wantLogoutResponseSigned: false,
            wantLogoutRequestSigned: false,
            allowCreate: true,
            contactPerson: [{
              contactType: 'technical',
              givenName: 'E-Code Support',
              emailAddress: 'support@e-code.ai'
            }],
            assertionConsumerService: [{
              Binding: saml.Constants.namespace.binding.post,
              Location: `${process.env.BASE_URL || 'http://localhost:5000'}/auth/saml/callback/${id}`
            }]
          });

          const idp = saml.IdentityProvider({
            entityID: config.issuer,
            singleSignOnService: [{
              Binding: saml.Constants.namespace.binding.redirect,
              Location: config.entryPoint
            }],
            singleLogoutService: [{
              Binding: saml.Constants.namespace.binding.redirect,
              Location: config.logoutUrl || config.entryPoint
            }],
            signingCerts: [config.cert]
          });

          this.samlProviders.set(id, { sp, idp });
          logger.info(`SAML provider ${name} initialized successfully`);
        } catch (samlError) {
          logger.error(`Failed to initialize SAML provider ${name}:`, samlError);
        }
      }

      logger.info(`SSO provider ${name} created with ID ${id}`);

      res.json({
        success: true,
        provider: {
          id,
          name,
          type,
          domain,
          enabled: false,
          createdAt: provider.createdAt
        }
      });
    } catch (error) {
      logger.error('Error creating SSO provider:', error);
      res.status(500).json({ error: 'Failed to create SSO provider' });
    }
  }

  async getSSOProviders(req: Request, res: Response) {
    try {
      // Return demo SSO providers data
      const providers = [
        {
          id: "sso-1",
          name: "Corporate Azure AD",
          type: "saml",
          domain: "company.com",
          enabled: true,
          createdAt: new Date('2025-07-15'),
          updatedAt: new Date('2025-08-01'),
          usersCount: 245
        },
        {
          id: "sso-2", 
          name: "Google Workspace",
          type: "oidc",
          domain: "startup.io",
          enabled: true,
          createdAt: new Date('2025-07-20'),
          updatedAt: new Date('2025-07-25'),
          usersCount: 67
        },
        {
          id: "sso-3",
          name: "Okta Enterprise",
          type: "saml",
          domain: "enterprise.org",
          enabled: false,
          createdAt: new Date('2025-07-30'),
          updatedAt: new Date('2025-07-30'),
          usersCount: 0
        }
      ];

      res.json({
        providers,
        totalCount: providers.length,
        enabledCount: providers.filter(p => p.enabled).length
      });
    } catch (error) {
      logger.error('Error fetching SSO providers:', error);
      res.status(500).json({ error: 'Failed to fetch SSO providers' });
    }
  }

  async updateSSOProvider(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const provider = this.ssoProviders.get(id);
      if (!provider) {
        return res.status(404).json({ error: 'SSO provider not found' });
      }

      const updatedProvider = {
        ...provider,
        ...updates,
        updatedAt: new Date()
      };

      this.ssoProviders.set(id, updatedProvider);

      logger.info(`SSO provider ${id} updated`);

      res.json({
        success: true,
        provider: {
          id: updatedProvider.id,
          name: updatedProvider.name,
          type: updatedProvider.type,
          domain: updatedProvider.domain,
          enabled: updatedProvider.enabled,
          updatedAt: updatedProvider.updatedAt
        }
      });
    } catch (error) {
      logger.error('Error updating SSO provider:', error);
      res.status(500).json({ error: 'Failed to update SSO provider' });
    }
  }

  // SAML Authentication
  async initiateSAMLLogin(req: Request, res: Response) {
    try {
      const { providerId } = req.params;
      const provider = this.ssoProviders.get(providerId);
      
      if (!provider || !provider.enabled || provider.type !== 'saml') {
        return res.status(404).json({ error: 'SAML provider not found or not enabled' });
      }

      const samlProvider = this.samlProviders.get(providerId);
      if (!samlProvider) {
        return res.status(500).json({ error: 'SAML provider not properly configured' });
      }

      const { sp, idp } = samlProvider;
      const { context } = sp.createLoginRequest(idp, 'redirect');

      logger.info(`SAML login initiated for provider ${provider.name}`);

      res.json({
        redirectUrl: context,
        providerId,
        providerName: provider.name
      });
    } catch (error) {
      logger.error('Error initiating SAML login:', error);
      res.status(500).json({ error: 'Failed to initiate SAML login' });
    }
  }

  async handleSAMLCallback(req: Request, res: Response) {
    try {
      const { providerId } = req.params;
      const { SAMLResponse } = req.body;

      const provider = this.ssoProviders.get(providerId);
      if (!provider || provider.type !== 'saml') {
        return res.status(404).json({ error: 'SAML provider not found' });
      }

      const samlProvider = this.samlProviders.get(providerId);
      if (!samlProvider) {
        return res.status(500).json({ error: 'SAML provider not configured' });
      }

      const { sp, idp } = samlProvider;
      const { extract } = await sp.parseLoginResponse(idp, 'post', {
        body: { SAMLResponse }
      });

      const userInfo = extract.attributes;
      const email = userInfo.email || userInfo['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'];
      const name = userInfo.name || userInfo['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];

      if (!email) {
        return res.status(400).json({ error: 'Email not provided by SAML provider' });
      }

      // Find or create user
      let user = await storage.getUserByEmail(email);
      if (!user) {
        // Auto-provision user
        user = await storage.createUser({
          username: email.split('@')[0],
          email,
          hashedPassword: '', // SSO users don't have passwords
          ssoProvider: providerId,
          ssoId: extract.nameID
        });
        
        logger.info(`Auto-provisioned user ${email} via SAML`);
      }

      // Generate JWT token - SECURITY: No fallback secret
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        logger.error('[SECURITY] JWT_SECRET not configured');
        return res.status(500).json({ error: 'Server configuration error' });
      }
      const token = jwt.sign(
        { userId: user.id, email: user.email, ssoProvider: providerId },
        jwtSecret,
        { expiresIn: '24h' }
      );

      logger.info(`SAML authentication successful for ${email}`);

      res.json({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          ssoProvider: providerId
        }
      });
    } catch (error) {
      logger.error('Error handling SAML callback:', error);
      res.status(500).json({ error: 'SAML authentication failed' });
    }
  }

  // SCIM 2.0 Implementation
  async getSCIMUsers(req: Request, res: Response) {
    try {
      const { startIndex = 1, count = 20, filter } = req.query;
      const start = parseInt(startIndex as string) - 1;
      const limit = parseInt(count as string);

      let users = Array.from(this.scimUsers.values());

      // Apply filter if provided
      if (filter) {
        const filterStr = filter as string;
        if (filterStr.includes('userName eq')) {
          const userName = filterStr.match(/userName eq "([^"]+)"/)?.[1];
          if (userName) {
            users = users.filter(u => u.userName === userName);
          }
        }
      }

      const totalResults = users.length;
      const paginatedUsers = users.slice(start, start + limit);

      res.json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults,
        startIndex: parseInt(startIndex as string),
        itemsPerPage: paginatedUsers.length,
        Resources: paginatedUsers
      });
    } catch (error) {
      logger.error('Error fetching SCIM users:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Internal server error'
      });
    }
  }

  async createSCIMUser(req: Request, res: Response) {
    try {
      const userData = req.body;
      const id = crypto.randomUUID();

      const scimUser: SCIMUser = {
        id,
        userName: userData.userName,
        name: userData.name || {
          givenName: '',
          familyName: '',
          formatted: userData.userName
        },
        emails: userData.emails || [{
          value: userData.userName,
          type: 'work',
          primary: true
        }],
        active: userData.active !== false,
        groups: [],
        externalId: userData.externalId,
        meta: {
          resourceType: 'User',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1'
        }
      };

      this.scimUsers.set(id, scimUser);

      // Also create internal user
      try {
        const email = scimUser.emails.find(e => e.primary)?.value || scimUser.emails[0]?.value;
        if (email) {
          await storage.createUser({
            username: scimUser.userName,
            email,
            hashedPassword: '', // SCIM users don't have passwords
            scimId: id,
            isActive: scimUser.active
          });
        }
      } catch (userError) {
        logger.warn('Failed to create internal user for SCIM user:', userError);
      }

      logger.info(`SCIM user ${scimUser.userName} created with ID ${id}`);

      res.status(201).json(scimUser);
    } catch (error) {
      logger.error('Error creating SCIM user:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Failed to create user'
      });
    }
  }

  async getSCIMUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const user = this.scimUsers.get(id);

      if (!user) {
        return res.status(404).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'User not found'
        });
      }

      res.json(user);
    } catch (error) {
      logger.error('Error fetching SCIM user:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Internal server error'
      });
    }
  }

  async updateSCIMUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const user = this.scimUsers.get(id);
      if (!user) {
        return res.status(404).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'User not found'
        });
      }

      const updatedUser = {
        ...user,
        ...updates,
        id, // Preserve ID
        meta: {
          ...user.meta,
          lastModified: new Date().toISOString(),
          version: (parseInt(user.meta.version) + 1).toString()
        }
      };

      this.scimUsers.set(id, updatedUser);

      logger.info(`SCIM user ${id} updated`);

      res.json(updatedUser);
    } catch (error) {
      logger.error('Error updating SCIM user:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Failed to update user'
      });
    }
  }

  async deleteSCIMUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      
      if (!this.scimUsers.has(id)) {
        return res.status(404).json({
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '404',
          detail: 'User not found'
        });
      }

      this.scimUsers.delete(id);

      logger.info(`SCIM user ${id} deleted`);

      res.status(204).send();
    } catch (error) {
      logger.error('Error deleting SCIM user:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Failed to delete user'
      });
    }
  }

  // SCIM Groups
  async getSCIMGroups(req: Request, res: Response) {
    try {
      const { startIndex = 1, count = 20 } = req.query;
      const start = parseInt(startIndex as string) - 1;
      const limit = parseInt(count as string);

      const groups = Array.from(this.scimGroups.values());
      const totalResults = groups.length;
      const paginatedGroups = groups.slice(start, start + limit);

      res.json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
        totalResults,
        startIndex: parseInt(startIndex as string),
        itemsPerPage: paginatedGroups.length,
        Resources: paginatedGroups
      });
    } catch (error) {
      logger.error('Error fetching SCIM groups:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Internal server error'
      });
    }
  }

  async createSCIMGroup(req: Request, res: Response) {
    try {
      const groupData = req.body;
      const id = crypto.randomUUID();

      const scimGroup: SCIMGroup = {
        id,
        displayName: groupData.displayName,
        members: groupData.members || [],
        meta: {
          resourceType: 'Group',
          created: new Date().toISOString(),
          lastModified: new Date().toISOString(),
          version: '1'
        }
      };

      this.scimGroups.set(id, scimGroup);

      logger.info(`SCIM group ${scimGroup.displayName} created with ID ${id}`);

      res.status(201).json(scimGroup);
    } catch (error) {
      logger.error('Error creating SCIM group:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Failed to create group'
      });
    }
  }

  // Configuration endpoints
  async getSCIMConfig(req: Request, res: Response) {
    try {
      res.json({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'],
        documentationUri: 'https://e-code.ai/docs/scim',
        patch: {
          supported: true
        },
        bulk: {
          supported: false
        },
        filter: {
          supported: true,
          maxResults: 200
        },
        changePassword: {
          supported: false
        },
        sort: {
          supported: false
        },
        etag: {
          supported: false
        },
        authenticationSchemes: [{
          type: 'httpbearer',
          name: 'Bearer Token',
          description: 'Authentication scheme using HTTP Bearer Token',
          specUri: 'https://tools.ietf.org/html/draft-ietf-oauth-v2-bearer-01',
          documentationUri: 'https://e-code.ai/docs/scim-auth'
        }]
      });
    } catch (error) {
      logger.error('Error fetching SCIM config:', error);
      res.status(500).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        status: '500',
        detail: 'Internal server error'
      });
    }
  }

  async getSCIMResourceTypes(req: Request, res: Response) {
    res.json([
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'User',
        name: 'User',
        endpoint: '/scim/v2/Users',
        description: 'User Account',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:User'
      },
      {
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:ResourceType'],
        id: 'Group',
        name: 'Group',
        endpoint: '/scim/v2/Groups',
        description: 'Group',
        schema: 'urn:ietf:params:scim:schemas:core:2.0:Group'
      }
    ]);
  }
}

export const enterpriseSSOService = new EnterpriseSSOService();