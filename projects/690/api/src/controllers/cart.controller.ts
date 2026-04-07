import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import { z } from 'zod';
import { CartService } from '../services/cart.service';
import { ApiError } from '../utils/ApiError';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';

const addItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int().positive('quantity must be a positive integer'),
  variantId: z.string().optional(),
});

const updateItemSchema = z.object({
  quantity: z.number().int().positive('quantity must be a positive integer'),
});

const removeItemSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  variantId: z.string().optional(),
});

const applyCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
});

export class CartController {
  private cartService: CartService;

  constructor(cartService?: CartService) {
    this.cartService = cartService ?? new CartService();
    this.getCart = this.getCart.bind(this);
    this.addItem = this.addItem.bind(this);
    this.updateItem = this.updateItem.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.clearCart = this.clearCart.bind(this);
    this.applyCoupon = this.applyCoupon.bind(this);
    this.removeCoupon = this.removeCoupon.bind(this);
  }

  public async getCart(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      const cart = await this.cartService.getCartByUserId(req.user.id);
      res.status(httpStatus.OK).json({ data: cart });
    } catch (error) {
      logger.error('Error fetching cart', { error, userId: req.user?.id });
      next(error);
    }
  }

  public async addItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      const parsed = addItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Invalid cart item payload',
          parsed.error.flatten().fieldErrors
        );
      }

      const { productId, quantity, variantId } = parsed.data;
      const updatedCart = await this.cartService.addItemToCart(req.user.id, {
        productId,
        quantity,
        variantId,
      });

      res.status(httpStatus.OK).json({ data: updatedCart });
    } catch (error) {
      logger.error('Error adding item to cart', { error, userId: req.user?.id, body: req.body });
      next(error);
    }
  }

  public async updateItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      const productId = req.params.productId;
      const variantId = req.query.variantId as string | undefined;

      if (!productId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'productId param is required');
      }

      const parsed = updateItemSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Invalid cart item payload',
          parsed.error.flatten().fieldErrors
        );
      }

      const { quantity } = parsed.data;
      const updatedCart = await this.cartService.updateCartItem(req.user.id, {
        productId,
        variantId,
        quantity,
      });

      res.status(httpStatus.OK).json({ data: updatedCart });
    } catch (error) {
      logger.error('Error updating cart item', {
        error,
        userId: req.user?.id,
        params: req.params,
        body: req.body,
      });
      next(error);
    }
  }

  public async removeItem(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      const parsed = removeItemSchema.safeParse({
        productId: req.params.productId,
        variantId: req.query.variantId,
      });

      if (!parsed.success) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Invalid remove item payload',
          parsed.error.flatten().fieldErrors
        );
      }

      const { productId, variantId } = parsed.data;
      const updatedCart = await this.cartService.removeItemFromCart(req.user.id, {
        productId,
        variantId,
      });

      res.status(httpStatus.OK).json({ data: updatedCart });
    } catch (error) {
      logger.error('Error removing cart item', {
        error,
        userId: req.user?.id,
        params: req.params,
        query: req.query,
      });
      next(error);
    }
  }

  public async clearCart(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      await this.cartService.clearCart(req.user.id);
      res.status(httpStatus.NO_CONTENT).send();
    } catch (error) {
      logger.error('Error clearing cart', { error, userId: req.user?.id });
      next(error);
    }
  }

  public async applyCoupon(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      const parsed = applyCouponSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          'Invalid coupon payload',
          parsed.error.flatten().fieldErrors
        );
      }

      const { code } = parsed.data;
      const updatedCart = await this.cartService.applyCoupon(req.user.id, code);
      res.status(httpStatus.OK).json({ data: updatedCart });
    } catch (error) {
      logger.error('Error applying coupon', {
        error,
        userId: req.user?.id,
        body: req.body,
      });
      next(error);
    }
  }

  public async removeCoupon(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new ApiError(httpStatus.UNAUTHORIZED, 'Unauthorized');
      }

      const updatedCart = await this.cartService.removeCoupon(req.user.id);
      res.status(httpStatus.OK).json({ data: updatedCart });
    } catch (error) {
      logger.error('Error removing coupon', { error, userId: req.user?.id });
      next(error);
    }
  }
}

export const cartController = new CartController();