import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { z } from 'zod';
import { PaymentService } from '../services/payment.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';

const paymentService = new PaymentService();

const initCardPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(4),
  customerId: z.string().min(1),
  metadata: z.record(z.any()).optional()
});

const initRedirectPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(3).max(4),
  customerId: z.string().min(1),
  returnUrl: z.string().url(),
  cancelUrl: z.string().url(),
  metadata: z.record(z.any()).optional()
});

const handleZodError = (error: unknown): never => {
  if (error instanceof z.ZodError) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'Validation error', {
      issues: error.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message
      }))
    });
  }
  throw error;
};

export const initiateCardPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = initCardPaymentSchema.parse(req.body);

    const { amount, currency, customerId, metadata } = parsedBody;

    const paymentIntent = await paymentService.createCardPaymentIntent({
      amount,
      currency,
      customerId,
      metadata,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        clientSecret: paymentIntent.clientSecret,
        paymentIntentId: paymentIntent.id,
        requiresAction: paymentIntent.requiresAction ?? false,
        status: paymentIntent.status
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(handleZodError(error));
    }
    logger.error('Error initiating card payment', { error });
    next(error);
  }
};

export const initiateRedirectPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const parsedBody = initRedirectPaymentSchema.parse(req.body);

    const { amount, currency, customerId, returnUrl, cancelUrl, metadata } = parsedBody;

    const session = await paymentService.createRedirectSession({
      amount,
      currency,
      customerId,
      returnUrl,
      cancelUrl,
      metadata,
      ipAddress: req.ip,
      userAgent: req.get('user-agent') || undefined
    });

    res.status(httpStatus.OK).json({
      success: true,
      data: {
        redirectUrl: session.redirectUrl,
        sessionId: session.id,
        status: session.status
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return next(handleZodError(error));
    }
    logger.error('Error initiating redirect payment', { error });
    next(error);
  }
};

export const handlePaymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const signature = req.get('stripe-signature') || req.get('x-signature') || '';

    if (!signature) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Missing webhook signature');
    }

    const rawBody = (req as any).rawBody ?? req.body;

    const event = await paymentService.constructWebhookEvent(rawBody, signature);

    await paymentService.handleWebhookEvent(event);

    res.status(httpStatus.OK).json({ received: true });
  } catch (error) {
    logger.error('Error handling payment webhook', { error });
    next(error);
  }
};

export const getPaymentStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const paymentId = req.params.id;

    if (!paymentId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Payment ID is required');
    }

    const status = await paymentService.getPaymentStatus(paymentId);

    if (!status) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Payment not found');
    }

    res.status(httpStatus.OK).json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Error getting payment status', { error });
    next(error);
  }
};

export const cancelPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const paymentId = req.params.id;

    if (!paymentId) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Payment ID is required');
    }

    const result = await paymentService.cancelPayment(paymentId);

    res.status(httpStatus.OK).json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error cancelling payment', { error });
    next(error);
  }
};

export default {
  initiateCardPayment,
  initiateRedirectPayment,
  handlePaymentWebhook,
  getPaymentStatus,
  cancelPayment
};