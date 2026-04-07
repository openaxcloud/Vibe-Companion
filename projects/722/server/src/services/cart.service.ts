import { Prisma, PrismaClient } from '@prisma/client';

export type CartItemInput = {
  productId: string;
  quantity: number;
};

export type UpsertCartInput = {
  userId: string;
  items: CartItemInput[];
};

export type RemoveCartItemInput = {
  userId: string;
  productId: string;
};

export type UpdateItemQuantityInput = {
  userId: string;
  productId: string;
  quantity: number;
};

export type CartSummary = {
  id: string;
  userId: string;
  items: {
    id: string;
    productId: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
  }[];
  subtotal: Prisma.Decimal;
  totalQuantity: number;
  createdAt: Date;
  updatedAt: Date;
};

export class InventoryExceededError extends Error {
  public readonly productId: string;
  public readonly requested: number;
  public readonly available: number;

  constructor(productId: string, requested: number, available: number) {
    super(
      `Requested quantity undefined exceeds available inventory undefined for product undefined`
    );
    this.name = 'InventoryExceededError';
    this.productId = productId;
    this.requested = requested;
    this.available = available;
  }
}

export class CartNotFoundError extends Error {
  public readonly userId: string;

  constructor(userId: string) {
    super(`Cart not found for user undefined`);
    this.name = 'CartNotFoundError';
    this.userId = userId;
  }
}

export class CartService {
  private prisma: PrismaClient;

  constructor(prismaClient: PrismaClient) {
    this.prisma = prismaClient;
  }

  public async getCartByUserId(userId: string): Promise<CartSummary | null> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart) {
      return null;
    }

    return this.mapCartToSummary(cart);
  }

  public async clearCart(userId: string): Promise<CartSummary | null> {
    return this.prisma.$transaction(async (tx) => {
      const existingCart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!existingCart) {
        return null;
      }

      await tx.cartItem.deleteMany({
        where: {
          cartId: existingCart.id,
        },
      });

      const updatedCart = await tx.cart.update({
        where: { id: existingCart.id },
        data: {
          subtotal: new Prisma.Decimal(0),
          totalQuantity: 0,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return this.mapCartToSummary(updatedCart);
    });
  }

  public async upsertCart(input: UpsertCartInput): Promise<CartSummary> {
    return this.prisma.$transaction(async (tx) => {
      const { userId, items } = input;

      if (!items || items.length === 0) {
        const existingCart = await tx.cart.findUnique({
          where: { userId },
          include: { items: { include: { product: true } } },
        });

        if (!existingCart) {
          const createdEmptyCart = await tx.cart.create({
            data: {
              userId,
              subtotal: new Prisma.Decimal(0),
              totalQuantity: 0,
            },
            include: {
              items: {
                include: {
                  product: true,
                },
              },
            },
          });

          return this.mapCartToSummary(createdEmptyCart);
        }

        await tx.cartItem.deleteMany({
          where: {
            cartId: existingCart.id,
          },
        });

        const clearedCart = await tx.cart.update({
          where: { id: existingCart.id },
          data: {
            subtotal: new Prisma.Decimal(0),
            totalQuantity: 0,
          },
          include: {
            items: {
              include: {
                product: true,
              },
            },
          },
        });

        return this.mapCartToSummary(clearedCart);
      }

      const productIds = [...new Set(items.map((i) => i.productId))];

      const products = await tx.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      const productMap = new Map(
        products.map((p) => [p.id, p])
      );

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          throw new Error(`Product not found: undefined`);
        }

        if (item.quantity <= 0) {
          continue;
        }

        const available = product.inventoryQuantity ?? 0;
        if (item.quantity > available) {
          throw new InventoryExceededError(
            product.id,
            item.quantity,
            available
          );
        }
      }

      const existingCart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      let cartId: string;

      if (!existingCart) {
        const createdCart = await tx.cart.create({
          data: {
            userId,
            subtotal: new Prisma.Decimal(0),
            totalQuantity: 0,
          },
        });
        cartId = createdCart.id;
      } else {
        cartId = existingCart.id;
      }

      await tx.cartItem.deleteMany({
        where: {
          cartId,
        },
      });

      const cartItemCreates: Prisma.CartItemCreateManyInput[] = [];

      for (const { productId, quantity } of items) {
        if (quantity <= 0) continue;

        const product = productMap.get(productId);
        if (!product) continue;

        const unitPrice = product.price;
        const lineTotal = unitPrice.mul(quantity);

        cartItemCreates.push({
          cartId,
          productId,
          quantity,
          unitPrice,
          lineTotal,
        });
      }

      if (cartItemCreates.length > 0) {
        await tx.cartItem.createMany({
          data: cartItemCreates,
        });
      }

      const cartWithItems = await tx.cart.findUniqueOrThrow({
        where: { id: cartId },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      const { subtotal, totalQuantity } = this.computeCartTotals(cartWithItems);

      const updatedCart = await tx.cart.update({
        where: { id: cartId },
        data: {
          subtotal,
          totalQuantity,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return this.mapCartToSummary(updatedCart);
    });
  }

  public async addOrUpdateItem(
    input: UpdateItemQuantityInput
  ): Promise<CartSummary> {
    return this.prisma.$transaction(async (tx) => {
      const { userId, productId, quantity } = input;

      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error(`Product not found: undefined`);
      }

      const available = product.inventoryQuantity ?? 0;
      if (quantity > available) {
        throw new InventoryExceededError(product.id, quantity, available);
      }

      let cart = await tx.cart.findUnique({
        where: { userId },
        include: { items: true },
      });

      if (!cart) {
        cart = await tx.cart.create({
          data: {
            userId,
            subtotal: new Prisma.Decimal(0),
            totalQuantity: 0,
          },
          include: { items: true },
        });
      }

      const existingItem = cart.items.find(
        (i) => i.productId === productId
      );

      if (quantity <= 0) {
        if (existingItem) {
          await tx.cartItem.delete({
            where: { id: existingItem.id },
          });
        }
      } else if (!existingItem) {
        const unitPrice = product.price;
        const lineTotal = unitPrice.mul(quantity);

        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId,
            quantity,
            unitPrice,
            lineTotal,
          },
        });
      } else {
        const unitPrice = existingItem.unitPrice ?? product.price;
        const lineTotal = unitPrice.mul(quantity);

        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity,
            unitPrice,
            lineTotal,
          },
        });
      }

      const updatedCart = await tx.cart.findUniqueOrThrow({
        where: { id: cart.id },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      const { subtotal, totalQuantity } = this.computeCartTotals(updatedCart);

      const finalCart = await tx.cart.update({
        where: { id: cart.id },
        data: {
          subtotal,
          totalQuantity,
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      return