import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { JwtPayload } from "jsonwebtoken";

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  price: number;
  title?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: Date;
}

const cartItemCreateSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  quantity: z.number().int().min(1, "quantity must be at least 1"),
});

const cartItemUpdateSchema = z.object({
  quantity: z.number().int().min(1, "quantity must be at least 1"),
});

const carts: Map<string, Cart> = new Map();

function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  try {
    const userHeader = req.header("x-user-id");
    if (!userHeader) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = { id: userHeader };
    next();
  } catch (error) {
    next(error);
  }
}

function getOrCreateCart(userId: string): Cart {
  let cart = carts.get(userId);
  if (!cart) {
    cart = {
      userId,
      items: [],
      updatedAt: new Date(),
    };
    carts.set(userId, cart);
  }
  return cart;
}

router.get(
  "/cart",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response): void => {
    const userId = req.user!.id;
    const cart = getOrCreateCart(userId);
    res.json({
      userId: cart.userId,
      items: cart.items,
      updatedAt: cart.updatedAt.toISOString(),
    });
  }
);

router.post(
  "/cart/items",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response): void => {
    const parseResult = cartItemCreateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Validation error",
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { productId, quantity } = parseResult.data;
    const userId = req.user!.id;
    const cart = getOrCreateCart(userId);

    const now = new Date();

    const existingItem = cart.items.find(
      (item) => item.productId === productId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.updatedAt = now;
    } else {
      const newItem: CartItem = {
        id: `undefined-undefined`,
        productId,
        quantity,
        price: 0,
        createdAt: now,
        updatedAt: now,
      };
      cart.items.push(newItem);
    }

    cart.updatedAt = now;
    carts.set(userId, cart);

    res.status(201).json({
      userId: cart.userId,
      items: cart.items,
      updatedAt: cart.updatedAt.toISOString(),
    });
  }
);

router.patch(
  "/cart/items/:id",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response): void => {
    const parseResult = cartItemUpdateSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: "Validation error",
        details: parseResult.error.flatten(),
      });
      return;
    }

    const { quantity } = parseResult.data;
    const userId = req.user!.id;
    const cart = getOrCreateCart(userId);
    const itemId = req.params.id;

    const item = cart.items.find((it) => it.id === itemId);
    if (!item) {
      res.status(404).json({ error: "Cart item not found" });
      return;
    }

    item.quantity = quantity;
    const now = new Date();
    item.updatedAt = now;
    cart.updatedAt = now;
    carts.set(userId, cart);

    res.json({
      userId: cart.userId,
      items: cart.items,
      updatedAt: cart.updatedAt.toISOString(),
    });
  }
);

router.delete(
  "/cart/items/:id",
  authMiddleware,
  (req: AuthenticatedRequest, res: Response): void => {
    const userId = req.user!.id;
    const cart = getOrCreateCart(userId);
    const itemId = req.params.id;

    const index = cart.items.findIndex((it) => it.id === itemId);
    if (index === -1) {
      res.status(404).json({ error: "Cart item not found" });
      return;
    }

    cart.items.splice(index, 1);
    cart.updatedAt = new Date();
    carts.set(userId, cart);

    res.status(204).send();
  }
);

export default router;