import Stripe from 'stripe';
import { storage } from '../storage';

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  limits: {
    projects: number;
    storage: number; // in MB
    collaborators: number;
    deployments: number;
    privateProjects: boolean;
    customDomains: boolean;
    aiAssistance: boolean;
    prioritySupport: boolean;
  };
}

export class SubscriptionManager {
  private stripe: Stripe | null = null;
  
  private plans: Record<string, SubscriptionPlan> = {
    free: {
      id: 'free',
      name: 'Free',
      description: 'Perfect for learning and personal projects',
      price: 0,
      interval: 'month',
      features: [
        'Up to 3 public projects',
        '500 MB storage',
        'Basic code editor',
        'Community support'
      ],
      limits: {
        projects: 3,
        storage: 500,
        collaborators: 0,
        deployments: 0,
        privateProjects: false,
        customDomains: false,
        aiAssistance: false,
        prioritySupport: false
      }
    },
    hacker: {
      id: 'hacker',
      name: 'Hacker',
      description: 'For developers who want more power',
      price: 7,
      interval: 'month',
      features: [
        'Unlimited public projects',
        'Up to 5 private projects',
        '5 GB storage',
        'Up to 3 collaborators per project',
        'Basic deployments',
        'AI code assistance'
      ],
      limits: {
        projects: -1, // unlimited
        storage: 5120,
        collaborators: 3,
        deployments: 10,
        privateProjects: true,
        customDomains: false,
        aiAssistance: true,
        prioritySupport: false
      }
    },
    pro: {
      id: 'pro',
      name: 'Pro',
      description: 'For professional developers and teams',
      price: 20,
      interval: 'month',
      features: [
        'Unlimited projects',
        '50 GB storage',
        'Unlimited collaborators',
        'Unlimited deployments',
        'Custom domains',
        'Advanced AI assistance',
        'Priority support',
        'Team management'
      ],
      limits: {
        projects: -1,
        storage: 51200,
        collaborators: -1,
        deployments: -1,
        privateProjects: true,
        customDomains: true,
        aiAssistance: true,
        prioritySupport: true
      }
    }
  };

  constructor() {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16'
      });
    }
  }

  async createCheckoutSession(userId: number, planId: string): Promise<string | null> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const plan = this.plans[planId];
    if (!plan || plan.price === 0) {
      throw new Error('Invalid plan');
    }

    // Get or create Stripe customer
    let customerId = await this.getOrCreateStripeCustomer(user);

    // Create price if it doesn't exist
    const priceId = await this.getOrCreateStripePrice(plan);

    // Create checkout session
    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: `${process.env.APP_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.APP_URL}/subscription/cancel`,
      metadata: {
        userId: userId.toString(),
        planId: planId
      }
    });

    return session.url;
  }

  async handleWebhook(body: Buffer, signature: string): Promise<void> {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new Error('Stripe webhook not configured');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      throw new Error('Invalid webhook signature');
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }
  }

  async cancelSubscription(userId: number): Promise<void> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const subscription = await this.getUserSubscription(userId);
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw new Error('No active subscription found');
    }

    await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true
    });

    // Update in database
    await this.updateUserSubscription(userId, {
      cancelAtPeriodEnd: true
    });
  }

  async getUserPlan(userId: number): Promise<SubscriptionPlan> {
    const subscription = await this.getUserSubscription(userId);
    
    if (!subscription || !subscription.planId) {
      return this.plans.free;
    }

    return this.plans[subscription.planId] || this.plans.free;
  }

  async checkLimit(userId: number, limitType: keyof SubscriptionPlan['limits']): Promise<boolean> {
    const plan = await this.getUserPlan(userId);
    const limit = plan.limits[limitType];

    if (limit === -1 || limit === true) {
      return true; // Unlimited or feature enabled
    }

    if (limit === false) {
      return false; // Feature disabled
    }

    // Check numeric limits
    switch (limitType) {
      case 'projects':
        const projectCount = await storage.getProjectCountByUser(userId);
        return projectCount < limit;

      case 'storage':
        const storageUsed = await this.calculateUserStorage(userId);
        return storageUsed < limit * 1024 * 1024; // Convert MB to bytes

      default:
        return true;
    }
  }

  private async getOrCreateStripeCustomer(user: any): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // Check if user already has a Stripe customer ID
    const subscription = await this.getUserSubscription(user.id);
    if (subscription?.stripeCustomerId) {
      return subscription.stripeCustomerId;
    }

    // Create new customer
    const customer = await this.stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id.toString()
      }
    });

    // Save customer ID
    await this.updateUserSubscription(user.id, {
      stripeCustomerId: customer.id
    });

    return customer.id;
  }

  private async getOrCreateStripePrice(plan: SubscriptionPlan): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    // In production, you would store these price IDs in config
    // For now, we'll create them dynamically
    const productId = await this.getOrCreateStripeProduct(plan);

    const prices = await this.stripe.prices.list({
      product: productId,
      active: true
    });

    const existingPrice = prices.data.find(
      p => p.unit_amount === plan.price * 100 && p.recurring?.interval === plan.interval
    );

    if (existingPrice) {
      return existingPrice.id;
    }

    // Create new price
    const price = await this.stripe.prices.create({
      product: productId,
      unit_amount: plan.price * 100, // Convert to cents
      currency: 'usd',
      recurring: {
        interval: plan.interval
      }
    });

    return price.id;
  }

  private async getOrCreateStripeProduct(plan: SubscriptionPlan): Promise<string> {
    if (!this.stripe) {
      throw new Error('Stripe is not configured');
    }

    const products = await this.stripe.products.list({
      active: true
    });

    const existingProduct = products.data.find(p => p.metadata.planId === plan.id);
    if (existingProduct) {
      return existingProduct.id;
    }

    // Create new product
    const product = await this.stripe.products.create({
      name: plan.name,
      description: plan.description,
      metadata: {
        planId: plan.id
      }
    });

    return product.id;
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const userId = parseInt(session.metadata!.userId);
    const planId = session.metadata!.planId;

    await this.updateUserSubscription(userId, {
      planId,
      stripeSubscriptionId: session.subscription as string,
      status: 'active',
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    });
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    // Update subscription status in database
    const userId = parseInt(subscription.metadata.userId);
    
    await this.updateUserSubscription(userId, {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    const userId = parseInt(subscription.metadata.userId);
    
    await this.updateUserSubscription(userId, {
      planId: 'free',
      status: 'canceled',
      stripeSubscriptionId: null
    });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    // Send email notification to user
    console.error('Payment failed for invoice:', invoice.id);
  }

  private async getUserSubscription(userId: number): Promise<any> {
    // In real implementation, this would fetch from a subscriptions table
    // For now, returning mock data structure
    return {
      userId,
      planId: 'free',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      status: 'active',
      currentPeriodEnd: null,
      cancelAtPeriodEnd: false
    };
  }

  private async updateUserSubscription(userId: number, data: any): Promise<void> {
    // In real implementation, this would update the subscriptions table
    console.log('Updating user subscription:', userId, data);
  }

  private async calculateUserStorage(userId: number): Promise<number> {
    // Calculate total storage used by user's projects
    const projects = await storage.getProjectsByUser(userId);
    let totalSize = 0;

    for (const project of projects) {
      const files = await storage.getFilesByProject(project.id);
      for (const file of files) {
        if (!file.isFolder && file.content) {
          totalSize += new TextEncoder().encode(file.content).length;
        }
      }
    }

    return totalSize;
  }

  async getProjectCountByUser(userId: number): Promise<number> {
    const projects = await storage.getProjectsByUser(userId);
    return projects.length;
  }
}

export const subscriptionManager = new SubscriptionManager();