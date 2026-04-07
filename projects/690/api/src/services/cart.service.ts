import { PrismaClient, CartStatus, Prisma } from '@prisma/client';
import { NotFoundError } from '../errors/not-found.error';
import { ValidationError } from '../errors/validation.error';
import { ConflictError } from '../errors/conflict.error';
import { Logger } from '../utils/logger';

const prisma = new PrismaClient();
const logger = new Logger('CartService');

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CartItemUpdateInput {
  quantity: number;
}

export interface CartSummaryItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  availableInventory: number;
  isAvailable: boolean;
}

export interface CartSummary {
  userId: string;
  items: CartSummaryItem[];
  subtotal: number;
  currency: string;
  isInventoryValid: boolean;
}

export class CartService {
  public async getOrCreateActiveCart(userId: string) {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const existing = await prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (existing) {
      return existing;
    }

    const created = await prisma.cart.create({
      data: {
        userId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    return created;
  }

  public async getActiveCart(userId: string) {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const cart = await prisma.cart.findFirst({
      where: {
        userId,
        status: CartStatus.ACTIVE,
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      throw new NotFoundError('Active cart not found');
    }

    return cart;
  }

  public async addItem(userId: string, input: CartItemInput) {
    this.validateCartItemInput(input);

    const product = await prisma.product.findUnique({
      where: { id: input.productId },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    if (!product.isActive) {
      throw new ConflictError('Product is not available');
    }

    if (product.inventory < input.quantity) {
      throw new ConflictError('Insufficient inventory for requested quantity');
    }

    return prisma.$transaction(async (tx) => {
      let cart = await tx.cart.findFirst({
        where: {
          userId,
          status: CartStatus.ACTIVE,
        },
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: {
            userId,
            status: CartStatus.ACTIVE,
          },
        });
      }

      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId: input.productId,
        },
      });

      const newQuantity = existingItem
        ? existingItem.quantity + input.quantity
        : input.quantity;

      if (newQuantity > product.inventory) {
        throw new ConflictError('Insufficient inventory for requested quantity');
      }

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            unitPrice: product.price,
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: input.productId,
            quantity: input.quantity,
            unitPrice: product.price,
          },
        });
      }

      const updatedCart = await tx.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!updatedCart) {
        throw new NotFoundError('Cart not found after update');
      }

      return updatedCart;
    });
  }

  public async updateItemQuantity(
    userId: string,
    productId: string,
    input: CartItemUpdateInput,
  ) {
    if (!productId) {
      throw new ValidationError('Product ID is required');
    }
    this.validateCartItemUpdateInput(input);

    return prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: {
          userId,
          status: CartStatus.ACTIVE,
        },
      });

      if (!cart) {
        throw new NotFoundError('Active cart not found');
      }

      const cartItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId,
        },
        include: {
          product: true,
        },
      });

      if (!cartItem) {
        throw new NotFoundError('Cart item not found');
      }

      if (input.quantity === 0) {
        await tx.cartItem.delete({
          where: { id: cartItem.id },
        });
      } else {
        const product = cartItem.product;
        if (!product || !product.isActive) {
          throw new ConflictError('Product is not available');
        }

        if (product.inventory < input.quantity) {
          throw new ConflictError('Insufficient inventory for requested quantity');
        }

        await tx.cartItem.update({
          where: { id: cartItem.id },
          data: {
            quantity: input.quantity,
            unitPrice: product.price,
          },
        });
      }

      const updatedCart = await tx.cart.findUnique({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      if (!updatedCart) {
        throw new NotFoundError('Cart not found after update');
      }

      return updatedCart;
    });
  }

  public async removeItem(userId: string, productId: string) {
    if (!productId) {
      throw new ValidationError('Product ID is required');
    }

    return prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: {
          userId,
          status: CartStatus.ACTIVE,
        },
      });

      if (!cart) {
        throw new NotFoundError('Active cart not found');
      }

      const cartItem = await tx.cartItem.findFirst({
        where: {
          cartId: cart.id,
          productId,
        },
      });

      if (!cartItem) {
        throw new NotFoundError('Cart item not found');
      }

      await tx.cartItem.delete({
        where: { id: cartItem.id },
      });

      const remainingItems = await tx.cartItem.findMany({
        where: { cartId: cart.id },
      });

      let updatedCart;
      if (remainingItems.length === 0) {
        updatedCart = await tx.cart.update({
          where: { id: cart.id },
          data: {
            status: CartStatus.EMPTY,
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });
      } else {
        updatedCart = await tx.cart.findUnique({
          where: { id: cart.id },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });
      }

      if (!updatedCart) {
        throw new NotFoundError('Cart not found after item removal');
      }

      return updatedCart;
    });
  }

  public async clearCart(userId: string) {
    return prisma.$transaction(async (tx) => {
      const cart = await tx.cart.findFirst({
        where: {
          userId,
          status: CartStatus.ACTIVE,
        },
      });

      if (!cart) {
        return null;
      }

      await tx.cartItem.deleteMany({
        where: {
          cartId: cart.id,
        },
      });

      const updatedCart = await tx.cart.update({
        where: { id: cart.id },
        data: {
          status: CartStatus.EMPTY,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return updatedCart;
    });
  }

  public async getCartSummary(userId: string): Promise<CartSummary> {
    const cart = await prisma.cart.findFirst({
      where: {
        userId,
        status: {
          in: [CartStatus.ACTIVE, CartStatus.EMPTY],
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      return {
        userId,
        items: [],
        subtotal: 0,
        currency: 'USD',
        isInventoryValid: true,
      };
    }

    const items: CartSummaryItem[] = cart.items.map((item) => {
      const product = item.product;
      const availableInventory = product ? product.inventory : 0;
      const isAvailable =
        !!product && product.isActive && availableInventory >= item.quantity;

      return {
        productId: item.productId,
        name: product?.name ?? 'Unknown',