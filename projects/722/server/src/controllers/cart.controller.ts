import { Request, Response, NextFunction } from 'express';
import httpStatus from 'http-status';
import CartService from '../services/cart.service';
import { ApiError } from '../utils/ApiError';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role?: string;
    [key: string]: unknown;
  };
}

class CartController {
  public async getCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const cart = await CartService.getCartByUserId(userId);
      res.status(httpStatus.OK).json(cart);
    } catch (error) {
      next(error);
    }
  }

  public async addItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const { productId, quantity } = req.body as { productId?: string; quantity?: number };

      if (!productId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
      }

      const validatedQuantity = this.validateQuantity(quantity);

      const updatedCart = await CartService.addItemToCart({
        userId,
        productId,
        quantity: validatedQuantity,
      });

      res.status(httpStatus.OK).json(updatedCart);
    } catch (error) {
      next(error);
    }
  }

  public async updateItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const { itemId } = req.params;
      const { quantity } = req.body as { quantity?: number };

      if (!itemId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Cart item ID is required');
      }

      const validatedQuantity = this.validateQuantity(quantity);

      const updatedCart = await CartService.updateCartItem({
        userId,
        itemId,
        quantity: validatedQuantity,
      });

      res.status(httpStatus.OK).json(updatedCart);
    } catch (error) {
      next(error);
    }
  }

  public async removeItem(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const { itemId } = req.params;

      if (!itemId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Cart item ID is required');
      }

      const updatedCart = await CartService.removeItemFromCart({
        userId,
        itemId,
      });

      res.status(httpStatus.OK).json(updatedCart);
    } catch (error) {
      next(error);
    }
  }

  public async clearCart(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);

      const updatedCart = await CartService.clearCartByUserId(userId);

      res.status(httpStatus.OK).json(updatedCart);
    } catch (error) {
      next(error);
    }
  }

  public async applyCoupon(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const { code } = req.body as { code?: string };

      if (!code || typeof code !== 'string') {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Coupon code is required');
      }

      const updatedCart = await CartService.applyCouponToCart({
        userId,
        code: code.trim(),
      });

      res.status(httpStatus.OK).json(updatedCart);
    } catch (error) {
      next(error);
    }
  }

  public async setItemQuantity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = this.getUserId(req);
      const { productId } = req.params;
      const { quantity } = req.body as { quantity?: number };

      if (!productId) {
        throw new ApiError(httpStatus.BAD_REQUEST, 'Product ID is required');
      }

      const validatedQuantity = this.validateQuantity(quantity);

      const updatedCart = await CartService.setItemQuantity({
        userId,
        productId,
        quantity: validatedQuantity,
      });

      res.status(httpStatus.OK).json(updatedCart);
    } catch (error) {
      next(error);
    }
  }

  private getUserId(req: AuthRequest): string {
    if (!req.user || !req.user.id) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Authentication required');
    }
    return req.user.id;
  }

  private validateQuantity(quantity?: number): number {
    if (quantity === undefined || quantity === null) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Quantity is required');
    }

    if (typeof quantity !== 'number' || Number.isNaN(quantity)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Quantity must be a valid number');
    }

    if (!Number.isInteger(quantity)) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Quantity must be an integer');
    }

    if (quantity <= 0) {
      throw new ApiError(httpStatus.BAD_REQUEST, 'Quantity must be greater than zero');
    }

    return quantity;
  }
}

export default new CartController();