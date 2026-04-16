import { Request, Response, NextFunction } from 'express';
// In a real application, cart logic might involve a database model
// for persistent carts or more complex session management.

// Placeholder for cart storage (in-memory for this example)
interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

let userCarts: { [userId: string]: CartItem[] } = {};

export const getCart = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user; // From protect middleware
  try {
    const cart = userCarts[userId] || [];
    res.status(200).json(cart);
  } catch (error: any) {
    next(error);
  }
};

export const addItem = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user;
  const { productId, name, price, quantity } = req.body;

  if (!productId || !name || !price || !quantity) {
    return res.status(400).json({ message: 'Missing required cart item fields' });
  }

  if (!userCarts[userId]) {
    userCarts[userId] = [];
  }

  const existingItemIndex = userCarts[userId].findIndex(item => item.productId === productId);

  if (existingItemIndex > -1) {
    userCarts[userId][existingItemIndex].quantity += quantity;
  } else {
    userCarts[userId].push({ productId, name, price, quantity });
  }

  res.status(200).json(userCarts[userId]);
};

export const updateItem = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user;
  const { productId } = req.params;
  const { quantity } = req.body;

  if (typeof quantity !== 'number' || quantity < 0) {
    return res.status(400).json({ message: 'Quantity must be a non-negative number' });
  }

  if (!userCarts[userId]) {
    return res.status(404).json({ message: 'Cart not found for user' });
  }

  const existingItemIndex = userCarts[userId].findIndex(item => item.productId === productId);

  if (existingItemIndex === -1) {
    return res.status(404).json({ message: 'Item not found in cart' });
  }

  if (quantity === 0) {
    userCarts[userId].splice(existingItemIndex, 1);
  } else {
    userCarts[userId][existingItemIndex].quantity = quantity;
  }

  res.status(200).json(userCarts[userId]);
};

export const removeItem = async (req: Request, res: Response, next: NextFunction) => {
  const userId = (req as any).user;
  const { productId } = req.params;

  if (!userCarts[userId]) {
    return res.status(404).json({ message: 'Cart not found for user' });
  }

  userCarts[userId] = userCarts[userId].filter(item => item.productId !== productId);

  res.status(200).json(userCarts[userId]);
};
