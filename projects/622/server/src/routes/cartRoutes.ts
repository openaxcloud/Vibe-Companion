import { Router, Request, Response, NextFunction } from 'express';
import { Types } from 'mongoose';
import { authMiddleware } from '../middleware/authMiddleware';
import { CartModel, CartDocument } from '../models/Cart';
import { ProductModel } from '../models/Product';

const cartRouter = Router();

type UserRequest = Request & {
  user?: {
    id: string;
  };
};

interface CartItemPayload {
  productId: string;
  quantity?: number;
}

interface UpdateCartItemPayload {
  quantity: number;
}

const ensureSessionId = (req: Request): string => {
  if (!req.session) {
    throw new Error('Session middleware is not configured');
  }
  if (!req.session.id || typeof req.session.id !== 'string') {
    // express-session guarantees a session ID, but guard anyway
    return (req.session as any).id || (req as any).sessionID || '';
  }
  return req.session.id;
};

const getCartOwner = (req: UserRequest): { userId?: string; sessionId?: string } => {
  if (req.user && req.user.id) {
    return { userId: req.user.id };
  }
  const sessionId = ensureSessionId(req);
  return { sessionId };
};

const findOrCreateCart = async (owner: { userId?: string; sessionId?: string }): Promise<CartDocument> => {
  const query: Record<string, any> = {};
  if (owner.userId) {
    query.userId = new Types.ObjectId(owner.userId);
  } else if (owner.sessionId) {
    query.sessionId = owner.sessionId;
  }

  let cart = await CartModel.findOne(query);
  if (!cart) {
    cart = new CartModel({
      userId: owner.userId ? new Types.ObjectId(owner.userId) : undefined,
      sessionId: owner.sessionId,
      items: [],
    });
    await cart.save();
  }

  return cart;
};

const findCart = async (owner: { userId?: string; sessionId?: string }): Promise<CartDocument | null> => {
  const query: Record<string, any> = {};
  if (owner.userId) {
    query.userId = new Types.ObjectId(owner.userId);
  } else if (owner.sessionId) {
    query.sessionId = owner.sessionId;
  } else {
    return null;
  }

  return CartModel.findOne(query);
};

const validateObjectId = (id: string): boolean => {
  return Types.ObjectId.isValid(id);
};

const mapCartResponse = (cart: CartDocument | null) => {
  if (!cart) {
    return { items: [], totalItems: 0, subtotal: 0 };
  }
  const items = cart.items.map((item) => ({
    productId: item.productId.toString(),
    quantity: item.quantity,
    price: item.price,
    name: item.name,
    image: item.image,
  }));
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  return { items, totalItems, subtotal };
};

const loadProductForCart = async (productId: string) => {
  if (!validateObjectId(productId)) {
    return null;
  }
  const product = await ProductModel.findById(productId).select('price name image isActive stock');
  if (!product || product.isActive === false || product.stock <= 0) {
    return null;
  }
  return product;
};

const ensurePositiveQuantity = (quantity?: number): number => {
  if (!quantity || quantity < 1) {
    return 1;
  }
  return Math.floor(quantity);
};

const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// GET /cart - Get current cart (supports authenticated user or guest via session)
cartRouter.get(
  '/',
  asyncHandler(async (req: UserRequest, res: Response) => {
    const owner = getCartOwner(req);
    const cart = await findCart(owner);
    const response = mapCartResponse(cart);
    res.json(response);
  })
);

// POST /cart/items - Add item to cart (auth optional, session fallback)
cartRouter.post(
  '/items',
  asyncHandler(async (req: UserRequest, res: Response) => {
    const { productId, quantity }: CartItemPayload = req.body || {};

    if (!productId || typeof productId !== 'string') {
      res.status(400).json({ message: 'productId is required' });
      return;
    }

    const product = await loadProductForCart(productId);
    if (!product) {
      res.status(404).json({ message: 'Product not found or unavailable' });
      return;
    }

    const owner = getCartOwner(req);
    const cart = await findOrCreateCart(owner);

    const qtyToAdd = ensurePositiveQuantity(quantity);
    const existingItem = cart.items.find((item) => item.productId.toString() === productId);

    if (existingItem) {
      existingItem.quantity += qtyToAdd;
    } else {
      cart.items.push({
        productId: product._id,
        quantity: qtyToAdd,
        price: product.price,
        name: product.name,
        image: product.image,
      });
    }

    await cart.save();
    res.status(201).json(mapCartResponse(cart));
  })
);

// PATCH /cart/items/:productId - Update quantity of a cart item
cartRouter.patch(
  '/items/:productId',
  asyncHandler(async (req: UserRequest, res: Response) => {
    const { productId } = req.params;
    const { quantity }: UpdateCartItemPayload = req.body || {};

    if (!productId || !validateObjectId(productId)) {
      res.status(400).json({ message: 'Invalid productId' });
      return;
    }

    const owner = getCartOwner(req);
    const cart = await findCart(owner);

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const item = cart.items.find((i) => i.productId.toString() === productId);
    if (!item) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    const normalizedQty = ensurePositiveQuantity(quantity);
    item.quantity = normalizedQty;

    await cart.save();
    res.json(mapCartResponse(cart));
  })
);

// DELETE /cart/items/:productId - Remove a single item from cart
cartRouter.delete(
  '/items/:productId',
  asyncHandler(async (req: UserRequest, res: Response) => {
    const { productId } = req.params;

    if (!productId || !validateObjectId(productId)) {
      res.status(400).json({ message: 'Invalid productId' });
      return;
    }

    const owner = getCartOwner(req);
    const cart = await findCart(owner);

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    const initialLength = cart.items.length;
    cart.items = cart.items.filter((item) => item.productId.toString() !== productId);

    if (cart.items.length === initialLength) {
      res.status(404).json({ message: 'Item not found in cart' });
      return;
    }

    await cart.save();
    res.status(204).send();
  })
);

// DELETE /cart - Clear entire cart
cartRouter.delete(
  '/',
  asyncHandler(async (req: UserRequest, res: Response) => {
    const owner = getCartOwner(req);
    const cart = await findCart(owner);

    if (!cart) {
      res.status(404).json({ message: 'Cart not found' });
      return;
    }

    cart.items = [];
    await cart.save();

    res.status(204).send();
  })
);

// Optional: route that requires authentication explicitly
cartRouter.use('/me', authMiddleware);

// GET /cart/me - Get cart for authenticated user only
cartRouter.get(
  '/me',
  authMiddleware,
  asyncHandler(async (req: UserRequest, res: Response) => {
    if (!req.user?.id) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    const cart = await findCart({ userId: req.user.id });
    const response = mapCartResponse(cart);
    res.json(response);
  })
);

export default cartRouter;