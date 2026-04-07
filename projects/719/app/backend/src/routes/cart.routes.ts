import { Router, Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";

type CartItem = {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type Cart = {
  userId: string;
  items: CartItem[];
  updatedAt: string;
};

type AddCartItemBody = {
  productId: string;
  name: string;
  price: number;
  quantity?: number;
  imageUrl?: string;
};

type UpdateCartItemBody = {
  quantity: number;
};

type CartStore = Map<string, Cart>;

const cartStore: CartStore = new Map();

const ensureUserId = (req: Request, _res: Response, next: NextFunction): void => {
  // In production, extract from auth middleware / JWT / session
  // For now, use a simple header or default for demonstration
  const headerUserId = req.header("x-user-id");
  const userId = headerUserId && headerUserId.trim().length > 0 ? headerUserId.trim() : "anonymous";

  (req as Request & { userId: string }).userId = userId;
  next();
};

const getOrCreateCart = (userId: string): Cart => {
  const existing = cartStore.get(userId);
  if (existing) {
    return existing;
  }
  const newCart: Cart = {
    userId,
    items: [],
    updatedAt: new Date().toISOString()
  };
  cartStore.set(userId, newCart);
  return newCart;
};

const findCartItemIndex = (cart: Cart, itemId: string): number =>
  cart.items.findIndex((item) => item.id === itemId);

const validateAddItemBody = (body: unknown): AddCartItemBody => {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }

  const b = body as Partial<AddCartItemBody>;

  if (!b.productId || typeof b.productId !== "string") {
    throw new Error("productId is required and must be a string");
  }
  if (!b.name || typeof b.name !== "string") {
    throw new Error("name is required and must be a string");
  }
  if (typeof b.price !== "number" || Number.isNaN(b.price) || b.price < 0) {
    throw new Error("price is required and must be a non-negative number");
  }

  let quantity = typeof b.quantity === "number" ? b.quantity : 1;
  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new Error("quantity must be a positive integer");
  }

  return {
    productId: b.productId,
    name: b.name,
    price: b.price,
    quantity,
    imageUrl: typeof b.imageUrl === "string" ? b.imageUrl : undefined
  };
};

const validateUpdateItemBody = (body: unknown): UpdateCartItemBody => {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid request body");
  }

  const b = body as Partial<UpdateCartItemBody>;

  if (typeof b.quantity !== "number" || !Number.isInteger(b.quantity) || b.quantity <= 0) {
    throw new Error("quantity is required and must be a positive integer");
  }

  return {
    quantity: b.quantity
  };
};

const cartRouter = Router();

cartRouter.use(ensureUserId);

// GET / - Get current cart
cartRouter.get(
  "/",
  (req: Request, res: Response<Cart>, _next: NextFunction): void => {
    const userId = (req as Request & { userId: string }).userId;
    const cart = getOrCreateCart(userId);
    res.status(StatusCodes.OK).json(cart);
  }
);

// POST /items - Add an item to the cart
cartRouter.post(
  "/items",
  (req: Request, res: Response<Cart>, next: NextFunction): void => {
    try {
      const userId = (req as Request & { userId: string }).userId;
      const body = validateAddItemBody(req.body);
      const cart = getOrCreateCart(userId);

      const existingItem = cart.items.find((item) => item.productId === body.productId);

      if (existingItem) {
        existingItem.quantity += body.quantity!;
      } else {
        const newItem: CartItem = {
          id: `undefined-undefined-undefined`,
          productId: body.productId,
          name: body.name,
          price: body.price,
          quantity: body.quantity ?? 1,
          imageUrl: body.imageUrl
        };
        cart.items.push(newItem);
      }

      cart.updatedAt = new Date().toISOString();
      cartStore.set(userId, cart);

      res.status(StatusCodes.CREATED).json(cart);
    } catch (error) {
      next(error);
    }
  }
);

// PATCH /items/:itemId - Update item quantity
cartRouter.patch(
  "/items/:itemId",
  (req: Request, res: Response<Cart>, next: NextFunction): void => {
    try {
      const userId = (req as Request & { userId: string }).userId;
      const { itemId } = req.params;
      if (!itemId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: "itemId is required" } as any);
        return;
      }

      const body = validateUpdateItemBody(req.body);
      const cart = getOrCreateCart(userId);
      const index = findCartItemIndex(cart, itemId);

      if (index === -1) {
        res.status(StatusCodes.NOT_FOUND).json({ message: "Cart item not found" } as any);
        return;
      }

      cart.items[index].quantity = body.quantity;
      cart.updatedAt = new Date().toISOString();
      cartStore.set(userId, cart);

      res.status(StatusCodes.OK).json(cart);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /items/:itemId - Remove item from cart
cartRouter.delete(
  "/items/:itemId",
  (req: Request, res: Response<Cart>, next: NextFunction): void => {
    try {
      const userId = (req as Request & { userId: string }).userId;
      const { itemId } = req.params;
      if (!itemId) {
        res.status(StatusCodes.BAD_REQUEST).json({ message: "itemId is required" } as any);
        return;
      }

      const cart = getOrCreateCart(userId);
      const index = findCartItemIndex(cart, itemId);

      if (index === -1) {
        res.status(StatusCodes.NOT_FOUND).json({ message: "Cart item not found" } as any);
        return;
      }

      cart.items.splice(index, 1);
      cart.updatedAt = new Date().toISOString();
      cartStore.set(userId, cart);

      res.status(StatusCodes.OK).json(cart);
    } catch (error) {
      next(error);
    }
  }
);

// DELETE / - Clear cart
cartRouter.delete(
  "/",
  (req: Request, res: Response<Cart>, _next: NextFunction): void => {
    const userId = (req as Request & { userId: string }).userId;
    const cart: Cart = {
      userId,
      items: [],
      updatedAt: new Date().toISOString()
    };
    cartStore.set(userId, cart);
    res.status(StatusCodes.OK).json(cart);
  }
);

// Basic error handler for this router (optional; main app may have a global handler)
cartRouter.use(
  (
    err: unknown,
    _req: Request,
    res: Response<{ message: string }>,
    _next: NextFunction
  ): void => {
    const message = err instanceof Error ? err.message : "Internal server error";
    const status =
      err instanceof Error && message.toLowerCase().includes("invalid")
        ? StatusCodes.BAD_REQUEST
        : StatusCodes.INTERNAL_SERVER_ERROR;
    res.status(status).json({ message });
  }
);

export default cartRouter;