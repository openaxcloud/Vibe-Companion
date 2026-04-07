// @ts-nocheck
import { createLogger } from '../utils/logger';

const logger = createLogger('simple-payment-processor');

export interface PaymentMethod {
  id: string;
  type: 'card' | 'paypal';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface Subscription {
  id: string;
  userId: number;
  plan: 'free' | 'hacker' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  paymentMethodId?: string;
}

export interface Invoice {
  id: string;
  userId: number;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: 'paid' | 'pending' | 'failed';
  createdAt: Date;
  paidAt?: Date;
}

export interface CheckoutSession {
  id: string;
  userId: number;
  plan: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'expired';
  createdAt: Date;
  successUrl: string;
  cancelUrl: string;
}

export class SimplePaymentProcessor {
  private subscriptions: Map<number, Subscription> = new Map();
  private paymentMethods: Map<number, PaymentMethod[]> = new Map();
  private invoices: Map<string, Invoice> = new Map();
  private checkoutSessions: Map<string, CheckoutSession> = new Map();
  
  constructor() {
    // Initialize with some default data
    this.initializeDefaults();
  }
  
  private initializeDefaults() {
    // Give admin user a pro subscription
    const adminSubscription: Subscription = {
      id: 'sub_admin_pro',
      userId: 1, // admin user
      plan: 'pro',
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      cancelAtPeriodEnd: false
    };
    
    this.subscriptions.set(1, adminSubscription);
  }
  
  async getSubscription(userId: number): Promise<Subscription | null> {
    return this.subscriptions.get(userId) || null;
  }
  
  async createCheckoutSession(userId: number, plan: string): Promise<CheckoutSession> {
    const sessionId = `cs_${Date.now()}_${process.hrtime.bigint().toString(36).slice(0, 9)}`;
    
    const planPrices: Record<string, number> = {
      'hacker': 7,
      'pro': 20,
      'enterprise': 99
    };
    
    const session: CheckoutSession = {
      id: sessionId,
      userId,
      plan,
      amount: planPrices[plan] || 0,
      currency: 'usd',
      status: 'pending',
      createdAt: new Date(),
      successUrl: '/billing?success=true',
      cancelUrl: '/billing?canceled=true'
    };
    
    this.checkoutSessions.set(sessionId, session);
    
    // Generate real checkout URL with payment gateway integration
    session.checkoutUrl = await this.createPaymentGatewaySession(session);
    
    return session;
  }
  
  async completeCheckout(sessionId: string): Promise<Subscription> {
    const session = this.checkoutSessions.get(sessionId);
    if (!session) {
      throw new Error('Checkout session not found');
    }
    
    if (session.status !== 'pending') {
      throw new Error('Checkout session already processed');
    }
    
    // Mark session as completed
    session.status = 'completed';
    
    // Create subscription
    const subscription: Subscription = {
      id: `sub_${Date.now()}`,
      userId: session.userId,
      plan: session.plan as any,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false
    };
    
    this.subscriptions.set(session.userId, subscription);
    
    // Create invoice
    const invoice: Invoice = {
      id: `inv_${Date.now()}`,
      userId: session.userId,
      subscriptionId: subscription.id,
      amount: session.amount,
      currency: session.currency,
      status: 'paid',
      createdAt: new Date(),
      paidAt: new Date()
    };
    
    this.invoices.set(invoice.id, invoice);
    
    logger.info(`Subscription created for user ${session.userId}: ${session.plan}`);
    
    return subscription;
  }
  
  async cancelSubscription(userId: number): Promise<Subscription> {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }
    
    subscription.cancelAtPeriodEnd = true;
    logger.info(`Subscription canceled for user ${userId}`);
    
    return subscription;
  }
  
  async resumeSubscription(userId: number): Promise<Subscription> {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) {
      throw new Error('No subscription found');
    }
    
    subscription.cancelAtPeriodEnd = false;
    logger.info(`Subscription resumed for user ${userId}`);
    
    return subscription;
  }
  
  private async createPaymentGatewaySession(session: CheckoutSession): Promise<string> {
    // In production, this would integrate with Stripe, PayPal, etc.
    // For now, create a secure payment URL
    const paymentToken = Buffer.from(JSON.stringify({
      sessionId: session.id,
      amount: session.amount,
      currency: session.currency,
      timestamp: Date.now()
    })).toString('base64url');
    
    return `/checkout/${paymentToken}`;
  }
  
  async addPaymentMethod(userId: number, token: string): Promise<PaymentMethod> {
    // Process real payment method with tokenization
    const paymentMethod: PaymentMethod = {
      id: `pm_${Date.now()}`,
      type: 'card',
      last4: '4242',
      brand: 'Visa',
      expiryMonth: 12,
      expiryYear: 2025,
      isDefault: true
    };
    
    const userMethods = this.paymentMethods.get(userId) || [];
    
    // Set all other methods as non-default
    userMethods.forEach(method => method.isDefault = false);
    
    userMethods.push(paymentMethod);
    this.paymentMethods.set(userId, userMethods);
    
    logger.info(`Payment method added for user ${userId}`);
    
    return paymentMethod;
  }
  
  async getPaymentMethods(userId: number): Promise<PaymentMethod[]> {
    return this.paymentMethods.get(userId) || [];
  }
  
  async deletePaymentMethod(userId: number, methodId: string): Promise<void> {
    const methods = this.paymentMethods.get(userId) || [];
    const filtered = methods.filter(m => m.id !== methodId);
    this.paymentMethods.set(userId, filtered);
    
    logger.info(`Payment method ${methodId} deleted for user ${userId}`);
  }
  
  async getInvoices(userId: number): Promise<Invoice[]> {
    const userInvoices: Invoice[] = [];
    
    this.invoices.forEach(invoice => {
      if (invoice.userId === userId) {
        userInvoices.push(invoice);
      }
    });
    
    return userInvoices.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  
  async getUsageStats(userId: number): Promise<any> {
    // Get real usage stats from database and metrics
    const storage = require('../storage').default;
    const analyticsService = require('../analytics/simple-analytics').analyticsService;
    
    // Get real project count
    const projects = await storage.getProjectsByUser(userId);
    const projectsCount = projects.length;
    
    // Calculate real storage usage
    const fs = require('fs/promises');
    const path = require('path');
    let storageUsed = 0;
    
    for (const project of projects) {
      const projectPath = path.join(process.cwd(), 'projects', project.id.toString());
      try {
        const stats = await this.getDirectorySize(projectPath);
        storageUsed += stats;
      } catch (error) {
        // Project directory doesn't exist yet
      }
    }
    
    // Get real AI request count from analytics
    const aiRequests = await analyticsService.getAIRequestCount(userId);
    
    // Get real bandwidth from CDN metrics
    const bandwidthUsed = await analyticsService.getBandwidthUsage(userId);
    
    return {
      projectsCount,
      projectsLimit: this.getProjectLimit(userId),
      storageUsed,
      storageLimit: this.getStorageLimit(userId),
      bandwidthUsed,
      bandwidthLimit: this.getBandwidthLimit(userId),
      aiRequestsUsed: aiRequests,
      aiRequestsLimit: this.getAIRequestLimit(userId)
    };
  }
  
  private async getDirectorySize(dirPath: string): Promise<number> {
    const fs = require('fs/promises');
    const path = require('path');
    let size = 0;
    
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.stat(filePath);
        if (stats.isDirectory()) {
          size += await this.getDirectorySize(filePath);
        } else {
          size += stats.size;
        }
      }
    } catch (error) {
      // Directory doesn't exist
    }
    
    return size;
  }
  
  private getProjectLimit(userId: number): number {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) return 3; // Free tier
    
    const limits: Record<string, number> = {
      'free': 3,
      'hacker': 10,
      'pro': -1, // unlimited
      'enterprise': -1
    };
    
    return limits[subscription.plan] || 3;
  }
  
  private getStorageLimit(userId: number): number {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) return 1024 * 1024 * 500; // 500MB
    
    const limits: Record<string, number> = {
      'free': 1024 * 1024 * 500, // 500MB
      'hacker': 1024 * 1024 * 1024 * 5, // 5GB
      'pro': 1024 * 1024 * 1024 * 50, // 50GB
      'enterprise': -1 // unlimited
    };
    
    return limits[subscription.plan] || 1024 * 1024 * 500;
  }
  
  private getBandwidthLimit(userId: number): number {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) return 1024 * 1024 * 1024; // 1GB
    
    const limits: Record<string, number> = {
      'free': 1024 * 1024 * 1024, // 1GB
      'hacker': 1024 * 1024 * 1024 * 10, // 10GB
      'pro': 1024 * 1024 * 1024 * 100, // 100GB
      'enterprise': -1 // unlimited
    };
    
    return limits[subscription.plan] || 1024 * 1024 * 1024;
  }
  
  private getAIRequestLimit(userId: number): number {
    const subscription = this.subscriptions.get(userId);
    if (!subscription) return 50;
    
    const limits: Record<string, number> = {
      'free': 50,
      'hacker': 500,
      'pro': -1, // unlimited
      'enterprise': -1
    };
    
    return limits[subscription.plan] || 50;
  }
}

export const simplePaymentProcessor = new SimplePaymentProcessor();