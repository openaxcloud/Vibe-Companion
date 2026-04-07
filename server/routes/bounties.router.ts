// @ts-nocheck
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { storage, type IStorage } from '../storage';
import { bountyPaymentService } from '../services/bounty-payment-service';
import { createLogger } from '../utils/logger';
import { 
  insertBountySchema, 
  insertBountySubmissionSchema, 
  insertBountyReviewSchema,
  type Bounty,
  type BountySubmission,
  type BountyReview
} from '@shared/schema';

const logger = createLogger('bounties-router');

const createBountySchema = insertBountySchema.extend({
  title: z.string().min(3).max(255),
  description: z.string().min(10),
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: 'Amount must be a positive number',
  }),
  currency: z.string().default('USD'),
  skills: z.array(z.string()).optional().default([]),
  deadline: z.string().datetime().optional(),
  projectId: z.number().optional(),
});

const applyToBountySchema = insertBountySubmissionSchema.extend({
  proposal: z.string().min(20),
  estimatedTime: z.string().optional(),
});

const reviewBountySchema = insertBountyReviewSchema.extend({
  rating: z.number().min(1).max(5),
  review: z.string().optional(),
});

const listBountiesQuerySchema = z.object({
  status: z.enum(['draft', 'open', 'in_progress', 'submitted', 'completed', 'cancelled', 'disputed']).optional(),
  minAmount: z.string().optional(),
  maxAmount: z.string().optional(),
  skills: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
  isPublic: z.string().optional(),
  featured: z.string().optional(),
  sortBy: z.enum(['amount', 'createdAt', 'deadline', 'views', 'applications']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
});

const rateBountySchema = z.object({
  rating: z.number().min(1).max(5),
  review: z.string().optional(),
  reviewType: z.enum(['hunter_review', 'poster_review']),
});

export function createBountiesRouter(storageInstance: IStorage = storage): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const validatedData = createBountySchema.parse(req.body);
      
      const bounty = await storage.createBounty({
        title: validatedData.title,
        description: validatedData.description,
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: 'draft',
        authorId: parseInt(userId),
        skills: validatedData.skills as any,
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : undefined,
        projectId: validatedData.projectId,
      });

      const user = await storage.getUser(userId);
      let customerId = user?.stripeCustomerId;
      
      if (!customerId) {
        const paymentIntent = await bountyPaymentService.createEscrowPayment({
          amount: parseFloat(validatedData.amount),
          currency: validatedData.currency,
          bountyId: bounty.id,
          authorId: parseInt(userId),
          title: validatedData.title,
        });

        await storage.updateBounty(bounty.id, {
          stripePaymentIntentId: paymentIntent.id,
          escrowStatus: 'pending_payment',
        });

        return res.status(201).json({
          bounty,
          paymentIntent: {
            id: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
          },
        });
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const checkoutSession = await bountyPaymentService.createCheckoutSession(
        bounty.id,
        parseFloat(validatedData.amount),
        validatedData.currency,
        validatedData.title,
        customerId,
        `${baseUrl}/bounties/${bounty.id}`,
        `${baseUrl}/bounties`
      );

      await storage.updateBounty(bounty.id, {
        escrowStatus: 'pending_checkout',
      });

      res.status(201).json({
        bounty,
        checkoutUrl: checkoutSession.url,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to create bounty:', error);
      res.status(500).json({ error: 'Failed to create bounty' });
    }
  });

  router.get('/', async (req: Request, res: Response) => {
    try {
      const query = listBountiesQuerySchema.parse(req.query);
      
      const filters: any = {};
      
      if (query.status) {
        filters.status = query.status;
      } else {
        filters.status = 'open';
      }
      
      if (query.minAmount) {
        filters.minAmount = parseFloat(query.minAmount);
      }
      if (query.maxAmount) {
        filters.maxAmount = parseFloat(query.maxAmount);
      }
      if (query.skills) {
        filters.skills = query.skills.split(',').map(s => s.trim());
      }
      if (query.difficulty) {
        filters.difficulty = query.difficulty;
      }
      if (query.isPublic !== undefined) {
        filters.isPublic = query.isPublic === 'true';
      } else {
        filters.isPublic = true;
      }
      if (query.featured !== undefined) {
        filters.featured = query.featured === 'true';
      }

      filters.sortBy = query.sortBy;
      filters.sortOrder = query.sortOrder;
      filters.page = parseInt(query.page);
      filters.limit = parseInt(query.limit);

      const result = await storage.listBounties(filters);

      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to list bounties:', error);
      res.status(500).json({ error: 'Failed to list bounties' });
    }
  });

  router.get('/featured', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const bounties = await storage.getFeaturedBounties(limit);
      res.json({ bounties });
    } catch (error) {
      logger.error('Failed to get featured bounties:', error);
      res.status(500).json({ error: 'Failed to get featured bounties' });
    }
  });

  router.get('/my', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const type = req.query.type as string || 'created';
      
      let bounties;
      if (type === 'assigned') {
        bounties = await storage.getAssignedBounties(parseInt(userId));
      } else if (type === 'applied') {
        bounties = await storage.getAppliedBounties(parseInt(userId));
      } else {
        bounties = await storage.getCreatedBounties(parseInt(userId));
      }

      res.json({ bounties });
    } catch (error) {
      logger.error('Failed to get user bounties:', error);
      res.status(500).json({ error: 'Failed to get bounties' });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      await storage.incrementBountyViews(bountyId);

      const submissions = await storage.getBountySubmissions(bountyId);
      const reviews = await storage.getBountyReviews(bountyId);

      let authorRating = null;
      let hunterRating = null;
      
      if (bounty.authorId) {
        authorRating = await storage.getUserAverageRating(bounty.authorId, 'poster_review');
      }
      if (bounty.assigneeId) {
        hunterRating = await storage.getUserAverageRating(bounty.assigneeId, 'hunter_review');
      }

      res.json({
        bounty,
        submissions,
        reviews,
        ratings: {
          authorRating,
          hunterRating,
        },
      });
    } catch (error) {
      logger.error('Failed to get bounty:', error);
      res.status(500).json({ error: 'Failed to get bounty' });
    }
  });

  router.post('/:id/apply', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      if (bounty.status !== 'open') {
        return res.status(400).json({ error: 'Bounty is not open for applications' });
      }

      if (bounty.authorId === parseInt(userId)) {
        return res.status(400).json({ error: 'Cannot apply to your own bounty' });
      }

      const existingSubmission = await storage.getBountySubmissionByUserAndBounty(
        parseInt(userId),
        bountyId
      );

      if (existingSubmission) {
        return res.status(400).json({ error: 'You have already applied to this bounty' });
      }

      const validatedData = applyToBountySchema.parse({
        ...req.body,
        bountyId,
        userId: parseInt(userId),
      });

      const submission = await storage.createBountySubmission({
        bountyId,
        userId: parseInt(userId),
        proposal: validatedData.proposal,
        estimatedTime: validatedData.estimatedTime,
        status: 'pending',
      });

      await storage.incrementBountyApplications(bountyId);

      res.status(201).json({ submission });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to apply to bounty:', error);
      res.status(500).json({ error: 'Failed to apply to bounty' });
    }
  });

  router.post('/:id/assign', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const bountyId = parseInt(req.params.id);
      const { hunterId } = req.body;

      if (!hunterId) {
        return res.status(400).json({ error: 'Hunter ID is required' });
      }

      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      if (bounty.authorId !== parseInt(userId)) {
        return res.status(403).json({ error: 'Only the bounty creator can assign hunters' });
      }

      if (bounty.status !== 'open') {
        return res.status(400).json({ error: 'Bounty is not open for assignment' });
      }

      const submission = await storage.getBountySubmissionByUserAndBounty(
        parseInt(hunterId),
        bountyId
      );

      if (!submission) {
        return res.status(400).json({ error: 'Hunter has not applied to this bounty' });
      }

      await storage.updateBountySubmission(submission.id, { status: 'accepted' });

      const otherSubmissions = await storage.getBountySubmissions(bountyId);
      for (const sub of otherSubmissions) {
        if (sub.id !== submission.id && sub.status === 'pending') {
          await storage.updateBountySubmission(sub.id, { status: 'rejected' });
        }
      }

      const updatedBounty = await storage.updateBounty(bountyId, {
        assigneeId: parseInt(hunterId),
        status: 'in_progress',
      });

      res.json({ bounty: updatedBounty });
    } catch (error) {
      logger.error('Failed to assign bounty:', error);
      res.status(500).json({ error: 'Failed to assign bounty' });
    }
  });

  router.post('/:id/submit', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      if (bounty.assigneeId !== parseInt(userId)) {
        return res.status(403).json({ error: 'Only the assigned hunter can submit work' });
      }

      if (bounty.status !== 'in_progress') {
        return res.status(400).json({ error: 'Bounty is not in progress' });
      }

      const updatedBounty = await storage.updateBounty(bountyId, {
        status: 'submitted',
      });

      res.json({ bounty: updatedBounty });
    } catch (error) {
      logger.error('Failed to submit bounty work:', error);
      res.status(500).json({ error: 'Failed to submit work' });
    }
  });

  router.post('/:id/complete', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      if (bounty.authorId !== parseInt(userId)) {
        return res.status(403).json({ error: 'Only the bounty creator can complete the bounty' });
      }

      if (bounty.status !== 'submitted') {
        return res.status(400).json({ error: 'Bounty work has not been submitted' });
      }

      if (!bounty.assigneeId) {
        return res.status(400).json({ error: 'No hunter assigned to this bounty' });
      }

      if (bounty.stripePaymentIntentId) {
        try {
          await bountyPaymentService.processCompletedBounty(
            bountyId,
            bounty.stripePaymentIntentId,
            bounty.assigneeId,
            parseFloat(bounty.amount),
            bounty.currency
          );

          await storage.updateBounty(bountyId, {
            escrowStatus: 'completed',
          });
        } catch (paymentError) {
          logger.error('Payment processing failed:', paymentError);
          return res.status(500).json({ error: 'Payment processing failed' });
        }
      }

      const updatedBounty = await storage.updateBounty(bountyId, {
        status: 'completed',
        completedAt: new Date(),
      });

      res.json({ bounty: updatedBounty });
    } catch (error) {
      logger.error('Failed to complete bounty:', error);
      res.status(500).json({ error: 'Failed to complete bounty' });
    }
  });

  router.post('/:id/cancel', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const bountyId = parseInt(req.params.id);
      const { reason } = req.body;

      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      if (bounty.authorId !== parseInt(userId)) {
        return res.status(403).json({ error: 'Only the bounty creator can cancel' });
      }

      if (['completed', 'cancelled'].includes(bounty.status)) {
        return res.status(400).json({ error: 'Bounty cannot be cancelled' });
      }

      if (bounty.stripePaymentIntentId && bounty.escrowStatus !== 'pending_payment') {
        try {
          const paymentIntent = await bountyPaymentService.getPaymentIntent(
            bounty.stripePaymentIntentId
          );

          if (paymentIntent.status === 'requires_capture') {
            await bountyPaymentService.cancelEscrowPayment(bounty.stripePaymentIntentId);
          } else if (paymentIntent.status === 'succeeded') {
            await bountyPaymentService.refundPayment(bounty.stripePaymentIntentId, reason);
          }

          await storage.updateBounty(bountyId, {
            escrowStatus: 'refunded',
          });
        } catch (paymentError) {
          logger.error('Refund processing failed:', paymentError);
        }
      }

      const updatedBounty = await storage.updateBounty(bountyId, {
        status: 'cancelled',
      });

      res.json({ bounty: updatedBounty });
    } catch (error) {
      logger.error('Failed to cancel bounty:', error);
      res.status(500).json({ error: 'Failed to cancel bounty' });
    }
  });

  router.post('/:id/review', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      if (bounty.status !== 'completed') {
        return res.status(400).json({ error: 'Can only review completed bounties' });
      }

      if (bounty.authorId !== parseInt(userId)) {
        return res.status(403).json({ error: 'Only the bounty creator can leave a review' });
      }

      if (!bounty.assigneeId) {
        return res.status(400).json({ error: 'No hunter to review' });
      }

      const existingReview = await storage.getBountyReviewByReviewerAndBounty(
        parseInt(userId),
        bountyId
      );

      if (existingReview) {
        return res.status(400).json({ error: 'You have already reviewed this bounty' });
      }

      const validatedData = reviewBountySchema.parse({
        ...req.body,
        bountyId,
        reviewerId: parseInt(userId),
        hunterId: bounty.assigneeId,
      });

      const review = await storage.createBountyReview({
        bountyId,
        reviewerId: parseInt(userId),
        hunterId: bounty.assigneeId,
        rating: validatedData.rating,
        review: validatedData.review,
        reviewType: 'hunter_review',
      });

      const hunterRating = await storage.getUserAverageRating(bounty.assigneeId, 'hunter_review');
      if (hunterRating !== null) {
        await storage.updateBounty(bountyId, { hunterRating: hunterRating.toString() });
      }

      res.status(201).json({ review });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to create review:', error);
      res.status(500).json({ error: 'Failed to create review' });
    }
  });

  router.post('/:id/rate', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const bountyId = parseInt(req.params.id);
      const bounty = await storage.getBounty(bountyId);

      if (!bounty) {
        return res.status(404).json({ error: 'Bounty not found' });
      }

      if (bounty.status !== 'completed') {
        return res.status(400).json({ error: 'Can only rate completed bounties' });
      }

      const validatedData = rateBountySchema.parse(req.body);
      const { rating, review: reviewText, reviewType } = validatedData;

      if (reviewType === 'hunter_review') {
        if (bounty.authorId !== parseInt(userId)) {
          return res.status(403).json({ error: 'Only the bounty poster can rate the hunter' });
        }
        if (!bounty.assigneeId) {
          return res.status(400).json({ error: 'No hunter to rate' });
        }

        const existingReview = await storage.getBountyReviewByTypeAndBounty(
          'hunter_review',
          bountyId,
          parseInt(userId)
        );

        if (existingReview) {
          return res.status(400).json({ error: 'You have already rated the hunter for this bounty' });
        }

        const review = await storage.createBountyReview({
          bountyId,
          reviewerId: parseInt(userId),
          hunterId: bounty.assigneeId,
          rating,
          review: reviewText,
          reviewType: 'hunter_review',
        });

        const hunterRating = await storage.getUserAverageRating(bounty.assigneeId, 'hunter_review');
        if (hunterRating !== null) {
          await storage.updateBounty(bountyId, { hunterRating: hunterRating.toString() });
        }

        return res.status(201).json({ review, averageRating: hunterRating });
      } else if (reviewType === 'poster_review') {
        if (bounty.assigneeId !== parseInt(userId)) {
          return res.status(403).json({ error: 'Only the hunter can rate the bounty poster' });
        }

        const existingReview = await storage.getBountyReviewByTypeAndBounty(
          'poster_review',
          bountyId,
          parseInt(userId)
        );

        if (existingReview) {
          return res.status(400).json({ error: 'You have already rated the poster for this bounty' });
        }

        const review = await storage.createBountyReview({
          bountyId,
          reviewerId: parseInt(userId),
          hunterId: bounty.authorId,
          rating,
          review: reviewText,
          reviewType: 'poster_review',
        });

        const posterRating = await storage.getUserAverageRating(bounty.authorId, 'poster_review');
        if (posterRating !== null) {
          await storage.updateBounty(bountyId, { posterRating: posterRating.toString() });
        }

        return res.status(201).json({ review, averageRating: posterRating });
      }

      return res.status(400).json({ error: 'Invalid review type' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      logger.error('Failed to rate bounty:', error);
      res.status(500).json({ error: 'Failed to rate bounty' });
    }
  });

  router.post('/connect/onboard', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      let connectAccountId = user.stripeConnectAccountId;

      if (!connectAccountId) {
        const account = await bountyPaymentService.createConnectAccount(
          parseInt(userId),
          user.email || ''
        );
        connectAccountId = account.id;
      }

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const onboardingUrl = await bountyPaymentService.createConnectOnboardingLink(
        connectAccountId,
        `${baseUrl}/bounties/connect/complete`
      );

      res.json({ onboardingUrl });
    } catch (error) {
      logger.error('Failed to create onboarding link:', error);
      res.status(500).json({ error: 'Failed to create onboarding link' });
    }
  });

  router.get('/connect/status', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!user.stripeConnectAccountId) {
        return res.json({
          connected: false,
          onboarded: false,
          payoutsEnabled: false,
        });
      }

      const status = await bountyPaymentService.checkConnectAccountStatus(
        user.stripeConnectAccountId
      );

      if (status.onboarded && !user.stripeConnectOnboarded) {
        await storage.updateUserStripeInfo(userId, {
          stripeConnectOnboarded: true,
        });
      }

      res.json({
        connected: true,
        ...status,
      });
    } catch (error) {
      logger.error('Failed to get connect status:', error);
      res.status(500).json({ error: 'Failed to get connect status' });
    }
  });

  router.post('/payment/confirm', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required' });
      }

      const result = await bountyPaymentService.handleCheckoutComplete(sessionId);

      await storage.updateBounty(result.bountyId, {
        stripePaymentIntentId: result.paymentIntentId,
        escrowStatus: 'held',
        status: 'open',
      });

      const bounty = await storage.getBounty(result.bountyId);

      res.json({ bounty });
    } catch (error) {
      logger.error('Failed to confirm payment:', error);
      res.status(500).json({ error: 'Failed to confirm payment' });
    }
  });

  return router;
}

export const bountiesRouter = createBountiesRouter();
