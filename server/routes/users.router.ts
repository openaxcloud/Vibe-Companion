// @ts-nocheck
import { Router, Request, Response, NextFunction } from "express";
import { type IStorage } from "../storage";
import { ensureAuthenticated } from "../middleware/auth";
import { csrfProtection } from "../middleware/csrf";
import type { User } from "@shared/schema";
import bcrypt from "../utils/bcrypt-compat";

export class UsersRouter {
  private router: Router;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.router = Router();
    this.storage = storage;
    this.initializeRoutes();
  }

  private ensureAuth = ensureAuthenticated;

  private initializeRoutes() {
    // GET /me — current authenticated user (MUST be before /:id)
    this.router.get("/me", this.ensureAuth, async (req: Request, res: Response) => {
      try {
        const userId = (req.user as any)?.id?.toString();
        if (!userId) {
          return res.status(401).json({ message: "Not authenticated", code: "UNAUTHORIZED" });
        }
        const user = await this.storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
        }
        const { passwordHash, ...safeUser } = user as any;
        res.json(safeUser);
      } catch (error) {
        console.error('Error fetching current user:', error);
        res.status(500).json({ message: "Failed to fetch user", code: "FETCH_ERROR" });
      }
    });

    // Search users (MUST be before /:id)
    this.router.get("/search", async (req: Request, res: Response) => {
      try {
        const query = (req.query.q || '').toString();
        if (!query || query.length < 2) {
          return res.status(400).json({ message: "Search query must be at least 2 characters", code: "INVALID_QUERY" });
        }
        const foundUsers = await this.storage.searchUsers(query);
        const publicUsers = foundUsers.map(user => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl
        }));
        res.json(publicUsers);
      } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ message: "Failed to search users", code: "SEARCH_ERROR" });
      }
    });

    // Get user profile by username (MUST be before /:id)
    this.router.get("/username/:username", async (req: Request, res: Response) => {
      try {
        const username = req.params.username;
        const user = await this.storage.getUserByUsername(username);
        if (!user) {
          return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
        }
        const publicUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          createdAt: user.createdAt
        };
        res.json(publicUser);
      } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: "Failed to fetch user", code: "FETCH_ERROR" });
      }
    });

    // CRITICAL: All fixed-path routes MUST come before /:id to avoid parameter capture
    // Get current user usage (resource consumption metrics)
    this.router.get("/usage", this.ensureAuth, async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const user = await this.storage.getUser(String(userId));
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        const { getPlanByTier } = await import('../payments/pricing-constants');
        const tier = (user.subscriptionTier || 'free') as 'free' | 'core' | 'teams' | 'enterprise';
        const plan = getPlanByTier(tier);
        const allowances = plan.allowances;
        const computeUsed = parseFloat(user.usageComputeHours?.toString() || '0');
        const storageUsed = parseFloat(user.usageStorageGb?.toString() || '0');
        const bandwidthUsed = parseFloat(user.usageBandwidthGb?.toString() || '0');
        const deploymentsUsed = parseInt(user.usageDeployments?.toString() || '0');
        let projectCount = 0;
        try {
          const projects = await this.storage.getProjectsByUserId(String(userId));
          projectCount = projects?.length || 0;
        } catch (e) {
          projectCount = 0;
        }
        const calcPercentage = (used: number, limit: number): number => {
          if (limit === -1) return 0;
          if (limit === 0) return 0;
          return Math.min(100, (used / limit) * 100);
        };
        res.json({
          compute: {
            used: computeUsed,
            limit: allowances.developmentMinutes === -1 ? -1 : allowances.developmentMinutes / 60,
            unit: 'hours',
            percentage: calcPercentage(computeUsed, allowances.developmentMinutes / 60)
          },
          storage: {
            used: storageUsed,
            limit: allowances.storageGb,
            unit: 'GB',
            percentage: calcPercentage(storageUsed, allowances.storageGb)
          },
          bandwidth: {
            used: bandwidthUsed,
            limit: allowances.bandwidthGb,
            unit: 'GB',
            percentage: calcPercentage(bandwidthUsed, allowances.bandwidthGb)
          },
          privateProjects: {
            used: projectCount,
            limit: allowances.privateApps,
            unit: 'projects',
            percentage: calcPercentage(projectCount, allowances.privateApps)
          },
          deployments: {
            used: deploymentsUsed,
            limit: allowances.publicApps,
            unit: 'deployments',
            percentage: calcPercentage(deploymentsUsed, allowances.publicApps)
          },
          collaborators: {
            used: 1,
            limit: allowances.collaborators,
            unit: 'users',
            percentage: calcPercentage(1, allowances.collaborators)
          }
        });
      } catch (error) {
        console.error('Error fetching user usage:', error);
        res.status(500).json({ error: 'Failed to fetch usage data' });
      }
    });

    // Get current user billing information (MUST be before /:id)
    this.router.get("/billing", this.ensureAuth, async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const user = await this.storage.getUser(String(userId));
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const daysRemaining = endOfMonth.getDate() - today.getDate() + 1;
        const planNames: Record<string, string> = {
          free: 'Starter (Free)', core: 'Core', teams: 'Teams', enterprise: 'Enterprise'
        };
        const tier = user.subscriptionTier || 'free';
        res.json({
          currentCycle: { start: startOfMonth, end: endOfMonth, daysRemaining },
          plan: planNames[tier] || 'Free',
          tier,
          subscriptionStatus: user.subscriptionStatus || 'inactive',
          previousCycles: []
        });
      } catch (error) {
        console.error('Error fetching billing info:', error);
        res.status(500).json({ error: 'Failed to fetch billing information' });
      }
    });

    // Get user billing summary for Account page (MUST be before /:id)
    this.router.get("/billing-summary", this.ensureAuth, async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;
        const user = await this.storage.getUser(String(userId));
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        const tier = user.subscriptionTier || 'free';
        const planPricing: Record<string, number> = { free: 0, core: 25, teams: 40, enterprise: 200 };
        const planNames: Record<string, string> = {
          free: 'Starter (Free)', core: 'Core', teams: 'Teams', enterprise: 'Enterprise'
        };
        const planLimits: Record<string, { compute: number; storage: number; privateRepls: string }> = {
          free: { compute: 50, storage: 5, privateRepls: '3' },
          core: { compute: 200, storage: 20, privateRepls: 'Unlimited' },
          teams: { compute: 500, storage: 50, privateRepls: 'Unlimited' },
          enterprise: { compute: 2000, storage: 200, privateRepls: 'Unlimited' }
        };
        const limits = planLimits[tier] || planLimits.free;
        const computeUsed = parseFloat(user.usageComputeHours?.toString() || '0');
        const storageUsed = parseFloat(user.usageStorageGb?.toString() || '0');
        const projects = await this.storage.getProjectsByUserId(String(userId));
        const nextBillingDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
        res.json({
          plan: planNames[tier] || 'Free',
          monthlyCost: planPricing[tier] || 0,
          nextBillingDate: nextBillingDate.toISOString(),
          usage: {
            compute: { used: computeUsed, limit: limits.compute },
            storage: { used: storageUsed, limit: parseInt(limits.storage.toString()) },
            privateRepls: { used: projects.length, limit: limits.privateRepls }
          },
          paymentMethod: null
        });
      } catch (error) {
        console.error('Error fetching billing summary:', error);
        res.status(500).json({ error: 'Failed to fetch billing summary' });
      }
    });

    // Get subscription status for a specific user by ID (MUST be before /:id)
    this.router.get("/:id/subscription", this.ensureAuth, async (req: Request, res: Response) => {
      try {
        const requestedId = req.params.id;
        const currentUserId = String(req.user!.id);
        if (requestedId !== currentUserId) {
          return res.status(403).json({ error: 'Access denied' });
        }
        const user = await this.storage.getUser(requestedId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        const tier = user.subscriptionTier || 'free';
        const periodEnd = user.subscriptionCurrentPeriodEnd
          ? new Date(user.subscriptionCurrentPeriodEnd).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        res.json({
          id: user.id,
          plan: tier,
          status: user.subscriptionStatus || (tier === 'free' ? 'active' : 'inactive'),
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          stripeCustomerId: user.stripeCustomerId || null,
          stripeSubscriptionId: user.stripeSubscriptionId || null
        });
      } catch (error) {
        console.error('Error fetching user subscription:', error);
        res.status(500).json({ error: 'Failed to fetch subscription' });
      }
    });

    // Get usage for a specific user by ID (MUST be before /:id)
    this.router.get("/:id/usage", this.ensureAuth, async (req: Request, res: Response) => {
      try {
        const requestedId = req.params.id;
        const currentUserId = String(req.user!.id);
        if (requestedId !== currentUserId) {
          return res.status(403).json({ error: 'Access denied' });
        }
        const user = await this.storage.getUser(requestedId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        const computeUsed = parseFloat(user.usageComputeHours?.toString() || '0');
        const storageUsed = parseFloat(user.usageStorageGb?.toString() || '0');
        const bandwidthUsed = parseFloat(user.usageBandwidthGb?.toString() || '0');
        let projectCount = 0;
        try {
          const projects = await this.storage.getProjectsByUserId(requestedId);
          projectCount = projects?.length || 0;
        } catch (e) { projectCount = 0; }
        res.json({
          compute: { used: computeUsed, limit: 50, unit: 'hours' },
          storage: { used: storageUsed, limit: 1, unit: 'GB' },
          bandwidth: { used: bandwidthUsed, limit: 10, unit: 'GB' },
          privateRepls: { used: projectCount, limit: 3, unit: 'repls' },
          collaborators: { used: 1, limit: 1, unit: 'users' }
        });
      } catch (error) {
        console.error('Error fetching user usage by id:', error);
        res.status(500).json({ error: 'Failed to fetch usage' });
      }
    });

    // Get user profile by ID (keep AFTER all fixed-path routes)
    this.router.get("/:id", async (req: Request, res: Response) => {
      try {
        const userId = req.params.id;
        const user = await this.storage.getUser(userId);
        if (!user) {
          return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
        }
        const publicUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          createdAt: user.createdAt
        };
        res.json(publicUser);
      } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ message: "Failed to fetch user", code: "FETCH_ERROR" });
      }
    });

    // Update user profile
    this.router.put("/:id", this.ensureAuth, csrfProtection, async (req: Request, res: Response) => {
      try {
        const userId = req.params.id;
        if (req.user!.id !== userId) {
          return res.status(403).json({ message: "Can only update own profile", code: "ACCESS_DENIED" });
        }
        const updates = req.body;
        delete updates.id;
        delete updates.username;
        if (updates.password) {
          updates.password = await bcrypt.hash(updates.password, 10);
        }
        const user = await this.storage.updateUser(userId, updates);
        if (!user) {
          return res.status(404).json({ message: "User not found", code: "USER_NOT_FOUND" });
        }
        const publicUser = {
          id: user.id,
          username: user.username,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
          createdAt: user.createdAt
        };
        res.json(publicUser);
      } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ message: "Failed to update user", code: "UPDATE_ERROR" });
      }
    });

    // Delete user account
    this.router.delete("/:id", this.ensureAuth, csrfProtection, async (req: Request, res: Response) => {
      try {
        const userId = req.params.id;
        if (req.user!.id !== userId) {
          return res.status(403).json({ message: "Can only delete own account", code: "ACCESS_DENIED" });
        }
        await this.storage.deleteUser(userId);
        req.logout((err: any) => {
          if (err) console.error('Logout error after account deletion:', err);
          res.json({ message: "Account deleted successfully" });
        });
      } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ message: "Failed to delete user", code: "DELETE_ERROR" });
      }
    });
  }

  getRouter(): Router {
    return this.router;
  }
}
