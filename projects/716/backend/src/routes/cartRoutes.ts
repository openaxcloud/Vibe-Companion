import { Router, Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { body, param, validationResult } from "express-validator";

const router = Router();
const prisma = new PrismaClient();

interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    [key: string]: any;
  };
}

const authenticate =
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

const handleValidation =
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res
        .status(400)
        .json({ error: "Validation failed", details: errors.array() });
    }
    next();
  };

const getOrCreateCart = async (userId: string) => {
  let cart = await prisma.cart.findFirst({
    where: { userId },
    include: { items: true },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId,
      },
      include: { items: true },
    });
  }

  return cart;
};

const attachCartRelations = async (cartId: string) => {
  return prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: true,
        },
      },
    },
  });
};

router.get(
  "/",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;

      const cart = await getOrCreateCart(userId);
      const fullCart = await attachCartRelations(cart.id);

      return res.status(200).json(fullCart);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error fetching cart:", error);
      return res.status(500).json({ error: "Failed to fetch cart" });
    }
  }
);

router.post(
  "/items",
  authenticate,
  body("productId").isString().notEmpty(),
  body("quantity").isInt({ min: 1 }),
  handleValidation,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { productId, quantity } = req.body as {
        productId: string;
        quantity: number;
      };

      const cart = await getOrCreateCart(userId);

      const product = await prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const existingItem = await prisma.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId,
        },
      });

      if (existingItem) {
        await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: existingItem.quantity + quantity,
          },
        });
      } else {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
          },
        });
      }

      const updatedCart = await attachCartRelations(cart.id);

      return res.status(200).json(updatedCart);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error adding item to cart:", error);
      return res.status(500).json({ error: "Failed to add item to cart" });
    }
  }
);

router.put(
  "/items/:itemId",
  authenticate,
  param("itemId").isString().notEmpty(),
  body("quantity").isInt({ min: 0 }),
  handleValidation,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { itemId } = req.params as { itemId: string };
      const { quantity } = req.body as { quantity: number };

      const cart = await getOrCreateCart(userId);

      const cartItem = await prisma.cartItem.findUnique({
        where: { id: itemId },
      });

      if (!cartItem || cartItem.cartId !== cart.id) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      if (quantity === 0) {
        await prisma.cartItem.delete({
          where: { id: itemId },
        });
      } else {
        await prisma.cartItem.update({
          where: { id: itemId },
          data: { quantity },
        });
      }

      const updatedCart = await attachCartRelations(cart.id);

      return res.status(200).json(updatedCart);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error updating cart item:", error);
      return res.status(500).json({ error: "Failed to update cart item" });
    }
  }
);

router.delete(
  "/items/:itemId",
  authenticate,
  param("itemId").isString().notEmpty(),
  handleValidation,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { itemId } = req.params as { itemId: string };

      const cart = await getOrCreateCart(userId);

      const cartItem = await prisma.cartItem.findUnique({
        where: { id: itemId },
      });

      if (!cartItem || cartItem.cartId !== cart.id) {
        return res.status(404).json({ error: "Cart item not found" });
      }

      await prisma.cartItem.delete({
        where: { id: itemId },
      });

      const updatedCart = await attachCartRelations(cart.id);

      return res.status(200).json(updatedCart);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error removing cart item:", error);
      return res.status(500).json({ error: "Failed to remove cart item" });
    }
  }
);

router.delete(
  "/items",
  authenticate,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const cart = await getOrCreateCart(userId);

      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });

      const updatedCart = await attachCartRelations(cart.id);

      return res.status(200).json(updatedCart);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("Error clearing cart:", error);
      return res.status(500).json({ error: "Failed to clear cart" });
    }
  }
);

export default router;