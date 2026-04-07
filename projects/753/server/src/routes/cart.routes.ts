import { Router, Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';

const router = Router();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    [key: string]: any;
  };
}

interface CartItem {
  productId: string;
  quantity: number;
}

interface Cart {
  userId: string;
  items: CartItem[];
  updatedAt: Date;
}

const cartAddSchema = z.object({
  productId: z.string().min(1, 'productId is required'),
  quantity: z.number().int().positive('quantity must be greater than 0'),
});

const cartUpdateSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'productId is required'),
        quantity: z.number().int().nonnegative('quantity must be >= 0'),
      })
    )
    .nonempty('items cannot be empty'),
});

const authenticate = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || !req.user.id) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next();
};

class CartService {
  private carts: Map<string, Cart>;

  constructor() {
    this.carts = new Map();
  }

  getCart(userId: string): Cart {
    const existing = this.carts.get(userId);
    if (existing) {
      return existing;
    }
    const newCart: Cart = {
      userId,
      items: [],
      updatedAt: new Date(),
    };
    this.carts.set(userId, newCart);
    return newCart;
  }

  addItem(userId: string, productId: string, quantity: number): Cart {
    const cart = this.getCart(userId);
    const existingIndex = cart.items.findIndex((i) => i.productId === productId);

    if (existingIndex >= 0) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({ productId, quantity });
    }

    cart.items = cart.items.filter((i) => i.quantity > 0);
    cart.updatedAt = new Date();
    this.carts.set(userId, cart);
    return cart;
  }

  updateItems(userId: string, items: CartItem[]): Cart {
    const filteredItems = items.filter((i) => i.quantity > 0);
    const cart: Cart = {
      userId,
      items: filteredItems,
      updatedAt: new Date(),
    };
    this.carts.set(userId, cart);
    return cart;
  }

  clearCart(userId: string): Cart {
    const cart: Cart = {
      userId,
      items: [],
      updatedAt: new Date(),
    };
    this.carts.set(userId, cart);
    return cart;
  }
}

const cartService = new CartService();

router.use(authenticate);

router.get('/cart', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const cart = cartService.getCart(userId);
    return res.json({
      userId: cart.userId,
      items: cart.items,
      updatedAt: cart.updatedAt.toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to fetch cart' });
  }
});

router.post('/cart/add', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = cartAddSchema.parse(req.body);
    const userId = req.user!.id;
    const cart = cartService.addItem(userId, parsed.productId, parsed.quantity);
    return res.status(200).json({
      message: 'Item added to cart',
      cart: {
        userId: cart.userId,
        items: cart.items,
        updatedAt: cart.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: 'Invalid request body',
        errors: err.errors,
      });
    }
    return res.status(500).json({ message: 'Failed to add item to cart' });
  }
});

router.post('/cart/update', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = cartUpdateSchema.parse(req.body);
    const userId = req.user!.id;
    const cart = cartService.updateItems(userId, parsed.items);
    return res.status(200).json({
      message: 'Cart updated',
      cart: {
        userId: cart.userId,
        items: cart.items,
        updatedAt: cart.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: 'Invalid request body',
        errors: err.errors,
      });
    }
    return res.status(500).json({ message: 'Failed to update cart' });
  }
});

router.post('/cart/clear', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const cart = cartService.clearCart(userId);
    return res.status(200).json({
      message: 'Cart cleared',
      cart: {
        userId: cart.userId,
        items: cart.items,
        updatedAt: cart.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to clear cart' });
  }
});

export default router;