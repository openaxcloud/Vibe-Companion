import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StatusCodes } from 'http-status-codes';
import type { AuthenticatedRequest } from '../types/auth.types';
import { requireAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validateRequest.middleware';
import { CartService } from '../services/cart.service';
import { ApiError } from '../utils/ApiError';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();
const cartService = new CartService();

const addItemSchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'productId is required'),
    quantity: z.number().int().min(1, 'Quantity must be at least 1'),
  }),
});

const updateQuantitySchema = z.object({
  body: z.object({
    productId: z.string().min(1, 'productId is required'),
    quantity: z.number().int().min(0, 'Quantity must be at least 0'),
  }),
});

const removeItemSchema = z.object({
  params: z.object({
    productId: z.string().min(1, 'productId is required'),
  }),
});

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const cart = await cartService.getCartByUserId(userId);
    res.status(StatusCodes.OK).json({
      success: true,
      data: cart,
    });
  })
);

router.post(
  '/items',
  requireAuth,
  validateRequest(addItemSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { productId, quantity } = req.body as {
      productId: string;
      quantity: number;
    };

    const updatedCart = await cartService.addItem(userId, { productId, quantity });

    res.status(StatusCodes.CREATED).json({
      success: true,
      data: updatedCart,
    });
  })
);

router.put(
  '/items',
  requireAuth,
  validateRequest(updateQuantitySchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { productId, quantity } = req.body as {
      productId: string;
      quantity: number;
    };

    if (quantity === 0) {
      const updatedCart = await cartService.removeItem(userId, productId);
      res.status(StatusCodes.OK).json({
        success: true,
        data: updatedCart,
      });
      return;
    }

    const updatedCart = await cartService.updateItemQuantity(userId, { productId, quantity });

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedCart,
    });
  })
);

router.delete(
  '/items/:productId',
  requireAuth,
  validateRequest(removeItemSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    const { productId } = req.params;

    const updatedCart = await cartService.removeItem(userId, productId);

    if (!updatedCart) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Cart or item not found');
    }

    res.status(StatusCodes.OK).json({
      success: true,
      data: updatedCart,
    });
  })
);

router.delete(
  '/',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const userId = req.user.id;
    await cartService.clearCart(userId);

    res.status(StatusCodes.NO_CONTENT).send();
  })
);

export default router;