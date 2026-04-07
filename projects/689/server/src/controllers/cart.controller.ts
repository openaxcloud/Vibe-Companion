import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { CartService } from "../services/cart.service";
import { ApiError } from "../utils/ApiError";
import { ApiResponse } from "../utils/ApiResponse";
import { logger } from "../utils/logger";
import {
  AddToCartDTO,
  UpdateCartItemDTO,
  RemoveCartItemDTO,
  ClearCartDTO,
  ApplyCouponDTO
} from "../dtos/cart.dto";

const cartService = new CartService();

export class CartController {
  public getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);

      const cart = await cartService.getCart(userId);

      const response = new ApiResponse(
        StatusCodes.OK,
        cart,
        "Cart retrieved successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error fetching cart");
    }
  };

  public addItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);

      const payload: AddToCartDTO = {
        userId,
        productId: req.body.productId,
        variantId: req.body.variantId,
        quantity: Number(req.body.quantity) || 1
      };

      const updatedCart = await cartService.addItem(payload);

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedCart,
        "Item added to cart successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error adding item to cart");
    }
  };

  public updateItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);

      const payload: UpdateCartItemDTO = {
        userId,
        cartItemId: req.params.itemId,
        quantity: Number(req.body.quantity)
      };

      const updatedCart = await cartService.updateItem(payload);

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedCart,
        "Cart item updated successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error updating cart item");
    }
  };

  public removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);

      const payload: RemoveCartItemDTO = {
        userId,
        cartItemId: req.params.itemId
      };

      const updatedCart = await cartService.removeItem(payload);

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedCart,
        "Item removed from cart successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error removing item from cart");
    }
  };

  public clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);

      const payload: ClearCartDTO = {
        userId
      };

      const clearedCart = await cartService.clearCart(payload);

      const response = new ApiResponse(
        StatusCodes.OK,
        clearedCart,
        "Cart cleared successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error clearing cart");
    }
  };

  public applyCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);

      const payload: ApplyCouponDTO = {
        userId,
        couponCode: req.body.couponCode
      };

      const updatedCart = await cartService.applyCoupon(payload);

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedCart,
        "Coupon applied successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error applying coupon to cart");
    }
  };

  public removeCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);

      const updatedCart = await cartService.removeCoupon(userId);

      const response = new ApiResponse(
        StatusCodes.OK,
        updatedCart,
        "Coupon removed successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error removing coupon from cart");
    }
  };

  public syncCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = this.getUserId(req);
      const clientCart = req.body?.items ?? [];

      const syncedCart = await cartService.syncCart(userId, clientCart);

      const response = new ApiResponse(
        StatusCodes.OK,
        syncedCart,
        "Cart synchronized successfully"
      );

      res.status(StatusCodes.OK).json(response);
    } catch (error) {
      this.handleError(error, next, "Error synchronizing cart");
    }
  };

  private getUserId(req: Request): string {
    const user = (req as any).user;
    if (!user || !user.id) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Unauthorized: user not found in request");
    }
    return String(user.id);
  }

  private handleError(error: unknown, next: NextFunction, logMessage: string): void {
    logger.error(logMessage, { error });
    if (error instanceof ApiError) {
      return next(error);
    }
    return next(new ApiError(StatusCodes.INTERNAL_SERVER_ERROR, "Internal server error"));
  }
}

export const cartController = new CartController();