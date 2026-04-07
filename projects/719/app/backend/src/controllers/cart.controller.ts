import { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { CartService } from "../services/cart.service";
import { ProductService } from "../services/product.service";
import { InventoryService } from "../services/inventory.service";
import { BadRequestError, NotFoundError } from "../errors/httpErrors";
import { logger } from "../utils/logger";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
  sessionID: string;
}

export class CartController {
  private readonly cartService: CartService;
  private readonly productService: ProductService;
  private readonly inventoryService: InventoryService;

  constructor(
    cartService: CartService,
    productService: ProductService,
    inventoryService: InventoryService
  ) {
    this.cartService = cartService;
    this.productService = productService;
    this.inventoryService = inventoryService;

    this.getCurrentCart = this.getCurrentCart.bind(this);
    this.addItem = this.addItem.bind(this);
    this.updateItem = this.updateItem.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.clearCart = this.clearCart.bind(this);
    this.mergeCartsOnLogin = this.mergeCartsOnLogin.bind(this);
  }

  private getUserAndSession(req: AuthenticatedRequest): {
    userId?: Types.ObjectId;
    sessionId: string;
  } {
    const sessionId = req.sessionID;
    if (!sessionId) {
      throw new BadRequestError("Session not initialized");
    }

    const userId = req.user?.id ? new Types.ObjectId(req.user.id) : undefined;

    return { userId, sessionId };
  }

  public async getCurrentCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId, sessionId } = this.getUserAndSession(req);
      const cart = await this.cartService.getOrCreateCart({
        userId,
        sessionId,
      });

      res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  public async addItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { productId, quantity, variantId } = req.body;

      if (!productId || typeof quantity !== "number" || quantity <= 0) {
        throw new BadRequestError("Invalid product or quantity");
      }

      const { userId, sessionId } = this.getUserAndSession(req);

      const product = await this.productService.getById(productId);
      if (!product) {
        throw new NotFoundError("Product not found");
      }

      const isInStock = await this.inventoryService.checkStock({
        productId,
        variantId,
        quantity,
      });

      if (!isInStock) {
        throw new BadRequestError("Insufficient stock");
      }

      const cart = await this.cartService.addItem({
        userId,
        sessionId,
        productId,
        quantity,
        variantId,
      });

      res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  public async updateItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { productId, quantity, variantId } = req.body;

      if (!productId || typeof quantity !== "number" || quantity < 0) {
        throw new BadRequestError("Invalid product or quantity");
      }

      const { userId, sessionId } = this.getUserAndSession(req);

      if (quantity === 0) {
        const cartAfterRemove = await this.cartService.removeItem({
          userId,
          sessionId,
          productId,
          variantId,
        });

        res.status(200).json({
          success: true,
          data: cartAfterRemove,
        });
        return;
      }

      const product = await this.productService.getById(productId);
      if (!product) {
        throw new NotFoundError("Product not found");
      }

      const isInStock = await this.inventoryService.checkStock({
        productId,
        variantId,
        quantity,
      });

      if (!isInStock) {
        throw new BadRequestError("Insufficient stock");
      }

      const cart = await this.cartService.updateItem({
        userId,
        sessionId,
        productId,
        quantity,
        variantId,
      });

      res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  public async removeItem(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { productId, variantId } = req.body;

      if (!productId) {
        throw new BadRequestError("Product ID is required");
      }

      const { userId, sessionId } = this.getUserAndSession(req);

      const cart = await this.cartService.removeItem({
        userId,
        sessionId,
        productId,
        variantId,
      });

      res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  public async clearCart(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { userId, sessionId } = this.getUserAndSession(req);

      const cart = await this.cartService.clearCart({
        userId,
        sessionId,
      });

      res.status(200).json({
        success: true,
        data: cart,
      });
    } catch (error) {
      next(error);
    }
  }

  public async mergeCartsOnLogin(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        throw new BadRequestError("User must be authenticated");
      }

      const userId = new Types.ObjectId(req.user.id);
      const { sessionId } = this.getUserAndSession(req);

      const mergedCart = await this.cartService.mergeCartsOnLogin({
        userId,
        sessionId,
        stockCheckFn: async (item) => {
          const isInStock = await this.inventoryService.checkStock({
            productId: item.productId.toString(),
            variantId: item.variantId?.toString(),
            quantity: item.quantity,
          });
          return isInStock;
        },
      });

      logger.info("Carts merged on login", {
        userId: userId.toHexString(),
        sessionId,
        cartId: mergedCart._id.toHexString(),
      });

      res.status(200).json({
        success: true,
        data: mergedCart,
      });
    } catch (error) {
      next(error);
    }
  }
}

export const cartController = new CartController(
  new CartService(),
  new ProductService(),
  new InventoryService()
);