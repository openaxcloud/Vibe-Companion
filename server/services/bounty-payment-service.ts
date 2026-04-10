import Stripe from 'stripe';
import { getStripe } from '../lib/stripe-client';
import { storage } from '../storage';
import { createLogger } from '../utils/logger';
import { creditsService } from './credits-service';

const logger = createLogger('bounty-payments');

function getStripeClient(): Stripe {
  return getStripe();
}

const PLATFORM_FEE_PERCENTAGE = 0.10;

export interface CreateBountyPaymentOptions {
  amount: number;
  currency: string;
  bountyId: number;
  creatorId: number;
  title: string;
}

export interface TransferToHunterOptions {
  bountyId: number;
  hunterId: number;
  amount: number;
  currency: string;
}

export class BountyPaymentService {
  async createEscrowPayment(options: CreateBountyPaymentOptions): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = getStripeClient();
      const { amount, currency, bountyId, creatorId, title } = options;
      
      const user = await storage.getUser(creatorId.toString());
      if (!user) {
        throw new Error('Creator not found');
      }

      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || undefined,
          name: user.username || undefined,
          metadata: {
            userId: creatorId.toString(),
          },
        });
        customerId = customer.id;
        await storage.updateUserStripeInfo(creatorId.toString(), {
          stripeCustomerId: customer.id,
        });
      }

      const amountInCents = Math.round(amount * 100);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        customer: customerId,
        capture_method: 'manual',
        metadata: {
          bountyId: bountyId.toString(),
          creatorId: creatorId.toString(),
          type: 'bounty_escrow',
          title,
        },
        description: `Bounty Escrow: ${title}`,
      });

      logger.info(`Created escrow payment intent ${paymentIntent.id} for bounty ${bountyId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to create escrow payment:', error);
      throw error;
    }
  }

  async captureEscrowPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);
      logger.info(`Captured payment intent ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to capture escrow payment:', error);
      throw error;
    }
  }

  async cancelEscrowPayment(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = getStripeClient();
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);
      logger.info(`Cancelled payment intent ${paymentIntentId}`);
      return paymentIntent;
    } catch (error) {
      logger.error('Failed to cancel escrow payment:', error);
      throw error;
    }
  }

  async refundPayment(paymentIntentId: string, reason?: string): Promise<Stripe.Refund> {
    try {
      const stripe = getStripeClient();
      
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const creatorId = paymentIntent.metadata?.creatorId;
      
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          refundReason: reason || 'Bounty cancelled',
        },
      });
      
      if (creatorId && refund.amount) {
        const refundedAmount = refund.amount / 100;
        await creditsService.addCredits(creatorId, refundedAmount, `Bounty refund: ${reason || 'Bounty cancelled'}`);
        logger.info(`Added ${refundedAmount} credits to user ${creatorId} for refund`);
      }
      
      logger.info(`Refunded payment intent ${paymentIntentId}`);
      return refund;
    } catch (error) {
      logger.error('Failed to refund payment:', error);
      throw error;
    }
  }

  async createConnectAccount(userId: number, email: string): Promise<Stripe.Account> {
    try {
      const stripe = getStripeClient();
      
      const account = await stripe.accounts.create({
        type: 'express',
        email,
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          userId: userId.toString(),
          type: 'bounty_hunter',
        },
      });

      await storage.updateUserStripeInfo(userId.toString(), {
        stripeConnectAccountId: account.id,
        stripeConnectOnboarded: false,
      });

      logger.info(`Created Connect account ${account.id} for user ${userId}`);
      return account;
    } catch (error) {
      logger.error('Failed to create Connect account:', error);
      throw error;
    }
  }

  async createConnectOnboardingLink(accountId: string, returnUrl: string): Promise<string> {
    try {
      const stripe = getStripeClient();
      
      const accountLink = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${returnUrl}?refresh=true`,
        return_url: returnUrl,
        type: 'account_onboarding',
      });

      return accountLink.url;
    } catch (error) {
      logger.error('Failed to create onboarding link:', error);
      throw error;
    }
  }

  async checkConnectAccountStatus(accountId: string): Promise<{
    onboarded: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    try {
      const stripe = getStripeClient();
      const account = await stripe.accounts.retrieve(accountId);

      return {
        onboarded: account.details_submitted ?? false,
        payoutsEnabled: account.payouts_enabled ?? false,
        detailsSubmitted: account.details_submitted ?? false,
      };
    } catch (error) {
      logger.error('Failed to check Connect account status:', error);
      throw error;
    }
  }

  async transferToHunter(options: TransferToHunterOptions): Promise<Stripe.Transfer> {
    try {
      const stripe = getStripeClient();
      const { bountyId, hunterId, amount, currency } = options;

      const hunter = await storage.getUser(hunterId.toString());
      if (!hunter) {
        throw new Error('Hunter not found');
      }

      if (!hunter.stripeConnectAccountId) {
        throw new Error('Hunter does not have a Stripe Connect account');
      }

      const status = await this.checkConnectAccountStatus(hunter.stripeConnectAccountId);
      if (!status.payoutsEnabled) {
        throw new Error('Hunter Connect account is not ready for payouts');
      }

      const amountInCents = Math.round(amount * 100);
      const platformFee = Math.round(amountInCents * PLATFORM_FEE_PERCENTAGE);
      const hunterAmount = amountInCents - platformFee;

      const transfer = await stripe.transfers.create({
        amount: hunterAmount,
        currency: currency.toLowerCase(),
        destination: hunter.stripeConnectAccountId,
        metadata: {
          bountyId: bountyId.toString(),
          hunterId: hunterId.toString(),
          platformFee: platformFee.toString(),
          originalAmount: amountInCents.toString(),
          type: 'bounty_payout',
        },
        description: `Bounty Payout - Bounty #${bountyId}`,
      });

      logger.info(`Transferred ${hunterAmount} cents to hunter ${hunterId} for bounty ${bountyId} (platform fee: ${platformFee} cents)`);
      return transfer;
    } catch (error) {
      logger.error('Failed to transfer to hunter:', error);
      throw error;
    }
  }

  async processCompletedBounty(
    bountyId: number,
    paymentIntentId: string,
    hunterId: number,
    amount: number,
    currency: string
  ): Promise<{ capture: Stripe.PaymentIntent; transfer: Stripe.Transfer }> {
    try {
      const capture = await this.captureEscrowPayment(paymentIntentId);
      
      const transfer = await this.transferToHunter({
        bountyId,
        hunterId,
        amount,
        currency,
      });

      logger.info(`Processed completed bounty ${bountyId}: captured payment and transferred to hunter`);
      return { capture, transfer };
    } catch (error) {
      logger.error('Failed to process completed bounty:', error);
      throw error;
    }
  }

  async getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
    try {
      const stripe = getStripeClient();
      return await stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      logger.error('Failed to retrieve payment intent:', error);
      throw error;
    }
  }

  async createCheckoutSession(
    bountyId: number,
    amount: number,
    currency: string,
    title: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<Stripe.Checkout.Session> {
    try {
      const stripe = getStripeClient();

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              unit_amount: Math.round(amount * 100),
              product_data: {
                name: `Bounty: ${title}`,
                description: `Payment for bounty #${bountyId}`,
              },
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&bounty_id=${bountyId}`,
        cancel_url: `${cancelUrl}?bounty_id=${bountyId}`,
        payment_intent_data: {
          capture_method: 'manual',
          metadata: {
            bountyId: bountyId.toString(),
            type: 'bounty_escrow',
          },
        },
        metadata: {
          bountyId: bountyId.toString(),
          type: 'bounty_payment',
        },
      });

      logger.info(`Created checkout session ${session.id} for bounty ${bountyId}`);
      return session;
    } catch (error) {
      logger.error('Failed to create checkout session:', error);
      throw error;
    }
  }

  async handleCheckoutComplete(sessionId: string): Promise<{
    bountyId: number;
    paymentIntentId: string;
  }> {
    try {
      const stripe = getStripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent'],
      });

      const bountyId = parseInt(session.metadata?.bountyId || '0');
      const paymentIntent = session.payment_intent as Stripe.PaymentIntent;

      if (!bountyId || !paymentIntent) {
        throw new Error('Invalid checkout session');
      }

      return {
        bountyId,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error) {
      logger.error('Failed to handle checkout complete:', error);
      throw error;
    }
  }
}

export const bountyPaymentService = new BountyPaymentService();
