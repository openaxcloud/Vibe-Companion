import { Prisma, Cart, CartItem } from '@prisma/client';
import { prisma } from '../prismaClient';
import { NotFoundError } from '../errors/NotFoundError';
import { ValidationError } from '../errors/ValidationError';

export interface AddToCartInput {
  userId: string;
  productId: string;
  quantity: number;
}

export interface UpdateCartItemInput {
  userId: string;
  cartItemId: string;
  quantity: number;
}

export interface RemoveCartItemInput {
  userId: string;
  cartItemId: string;
}

export interface ClearCartInput {
  userId: string;
}

export interface CartWithItems extends Cart {
  items: (CartItem & {
    product: {
      id: string;
      name: string;
      price: Prisma.Decimal;
      stock: number;
      isActive: boolean;
    };
  })[];
}

export class CartService {
  public async getOrCreateCart(userId: string): Promise<CartWithItems> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const cart = await prisma.$transaction(async (tx) => {
      let existingCart = await tx.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!existingCart) {
        existingCart = await tx.cart.create({
          data: {
            userId,
          },
          include: {
            items: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    stock: true,
                    isActive: true,
                  },
                },
              },
            },
          },
        });
      }

      return existingCart;
    });

    return cart as CartWithItems;
  }

  public async getCart(userId: string): Promise<CartWithItems | null> {
    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const cart = await prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                stock: true,
                isActive: true,
              },
            },
          },
        },
      },
    });

    return cart as CartWithItems | null;
  }

  public async addToCart(input: AddToCartInput): Promise<CartWithItems> {
    const { userId, productId, quantity } = input;

    if (!userId || !productId) {
      throw new ValidationError('User ID and Product ID are required');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive integer');
    }

    const cart = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id: productId },
        select: {
          id: true,
          name: true,
          price: true,
          stock: true,
          isActive: true,
        },
      });

      if (!product || !product.isActive) {
        throw new NotFoundError('Product not found or is inactive');
      }

      if (product.stock < quantity) {
        throw new ValidationError('Requested quantity exceeds available stock');
      }

      let existingCart = await tx.cart.findUnique({
        where: { userId },
      });

      if (!existingCart) {
        existingCart = await tx.cart.create({
          data: {
            userId,
          },
        });
      }

      const existingItem = await tx.cartItem.findFirst({
        where: {
          cartId: existingCart.id,
          productId: product.id,
        },
      });

      const newQuantity = existingItem ? existingItem.quantity + quantity : quantity;

      if (newQuantity > product.stock) {
        throw new ValidationError('Total quantity in cart exceeds available stock');
      }

      const unitPrice = product.price;

      if (existingItem) {
        await tx.cartItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: newQuantity,
            unitPrice,
          },
        });
      } else {
        await tx.cartItem.create({
          data: {
            cartId: existingCart.id,
            productId: product.id,
            quantity,
            unitPrice,
          },
        });
      }

      const updatedCart = await tx.cart.findUnique({
        where: { id: existingCart.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!updatedCart) {
        throw new NotFoundError('Cart not found after update');
      }

      return updatedCart;
    });

    return cart as CartWithItems;
  }

  public async updateCartItem(input: UpdateCartItemInput): Promise<CartWithItems> {
    const { userId, cartItemId, quantity } = input;

    if (!userId || !cartItemId) {
      throw new ValidationError('User ID and Cart Item ID are required');
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new ValidationError('Quantity must be a positive integer');
    }

    const cart = await prisma.$transaction(async (tx) => {
      const cartRecord = await tx.cart.findUnique({
        where: { userId },
      });

      if (!cartRecord) {
        throw new NotFoundError('Cart not found');
      }

      const cartItem = await tx.cartItem.findUnique({
        where: { id: cartItemId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              stock: true,
              isActive: true,
            },
          },
        },
      });

      if (!cartItem || cartItem.cartId !== cartRecord.id) {
        throw new NotFoundError('Cart item not found for this user');
      }

      if (!cartItem.product || !cartItem.product.isActive) {
        throw new ValidationError('Associated product is not available');
      }

      if (cartItem.product.stock < quantity) {
        throw new ValidationError('Requested quantity exceeds available stock');
      }

      const unitPrice = cartItem.product.price;

      await tx.cartItem.update({
        where: { id: cartItem.id },
        data: {
          quantity,
          unitPrice,
        },
      });

      const updatedCart = await tx.cart.findUnique({
        where: { id: cartRecord.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!updatedCart) {
        throw new NotFoundError('Cart not found after update');
      }

      return updatedCart;
    });

    return cart as CartWithItems;
  }

  public async removeCartItem(input: RemoveCartItemInput): Promise<CartWithItems> {
    const { userId, cartItemId } = input;

    if (!userId || !cartItemId) {
      throw new ValidationError('User ID and Cart Item ID are required');
    }

    const cart = await prisma.$transaction(async (tx) => {
      const cartRecord = await tx.cart.findUnique({
        where: { userId },
      });

      if (!cartRecord) {
        throw new NotFoundError('Cart not found');
      }

      const cartItem = await tx.cartItem.findUnique({
        where: { id: cartItemId },
      });

      if (!cartItem || cartItem.cartId !== cartRecord.id) {
        throw new NotFoundError('Cart item not found for this user');
      }

      await tx.cartItem.delete({
        where: { id: cartItemId },
      });

      const updatedCart = await tx.cart.findUnique({
        where: { id: cartRecord.id },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  stock: true,
                  isActive: true,
                },
              },
            },
          },
        },
      });

      if (!updatedCart) {
        throw new NotFoundError('Cart not found after update');
      }

      return updatedCart;
    });

    return cart as CartWithItems;
  }

  public async clearCart(input: ClearCartInput): Promise<CartWithItems> {
    const { userId } = input;

    if (!userId) {
      throw new ValidationError('User ID is required');
    }

    const cart = await prisma.$transaction(async (tx) => {
      const cartRecord = await tx.cart.findUnique({
        where: { userId },
      });

      if (!cartRecord) {
        throw new NotFoundError('Cart not found');
      }

      await tx.cartItem.deleteMany({
        where: { cartId: cartRecord.id },
      });

      const clearedCart