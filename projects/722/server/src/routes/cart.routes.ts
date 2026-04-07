import { Router, Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

const router = Router();

interface CartItem {
  productId: string;
  quantity: number;
}

interface Cart {
  userId: string;
  items: CartItem[];
}

// In-memory store for example purposes. Replace with real DB/service in production.
const carts: Map<string, Cart> = new Map();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    [key: string]: unknown;
  };
}

const getUserIdFromRequest = (req: AuthenticatedRequest): string => {
  // In a real app, you'd rely on authentication middleware having set req.user
  // For now, support either req.user.id or a temporary header for testing.
  if (req.user?.id) {
    return req.user.id;
  }
  const headerUserId = req.header('x-user-id');
  if (!headerUserId) {
    throw new Error('Unauthorized: user not authenticated');
  }
  return headerUserId;
};

const getOrCreateCart = (userId: string): Cart => {
  let cart = carts.get(userId);
  if (!cart) {
    cart = { userId, items: [] };
    carts.set(userId, cart);
  }
  return cart;
};

const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((err) => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  return next();
};

router.get(
  '/cart',
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const cart = getOrCreateCart(userId);
      return res.status(200).json({
        userId: cart.userId,
        items: cart.items,
      });
    } catch (err) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: err instanceof Error ? err.message : 'Unauthorized access',
      });
    }
  }
);

router.post(
  '/cart/items',
  [
    body('productId')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('productId is required'),
    body('quantity')
      .isInt({ min: 1 })
      .withMessage('quantity must be an integer greater than 0'),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const { productId, quantity } = req.body as { productId: string; quantity: number };

      const cart = getOrCreateCart(userId);
      const existingItemIndex = cart.items.findIndex(
        (item) => item.productId === productId
      );

      if (existingItemIndex >= 0) {
        cart.items[existingItemIndex].quantity = quantity;
      } else {
        cart.items.push({ productId, quantity });
      }

      carts.set(userId, cart);

      return res.status(200).json({
        userId: cart.userId,
        items: cart.items,
      });
    } catch (err) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: err instanceof Error ? err.message : 'Unauthorized access',
      });
    }
  }
);

router.delete(
  '/cart/items/:productId',
  [
    param('productId')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('productId is required'),
    handleValidationErrors,
  ],
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const { productId } = req.params;

      const cart = getOrCreateCart(userId);
      const initialLength = cart.items.length;

      cart.items = cart.items.filter((item) => item.productId !== productId);
      carts.set(userId, cart);

      if (cart.items.length === initialLength) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Item not found in cart',
        });
      }

      return res.status(200).json({
        userId: cart.userId,
        items: cart.items,
      });
    } catch (err) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: err instanceof Error ? err.message : 'Unauthorized access',
      });
    }
  }
);

router.delete(
  '/cart',
  async (req: AuthenticatedRequest, res: Response): Promise<Response> => {
    try {
      const userId = getUserIdFromRequest(req);
      const cart = getOrCreateCart(userId);

      cart.items = [];
      carts.set(userId, cart);

      return res.status(200).json({
        userId: cart.userId,
        items: cart.items,
      });
    } catch (err) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: err instanceof Error ? err.message : 'Unauthorized access',
      });
    }
  }
);

export default router;