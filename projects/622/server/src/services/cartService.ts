import { PrismaClient, Cart as PrismaCart, CartItem as PrismaCartItem, Product as PrismaProduct } from '@prisma/client';
import createHttpError from 'http-errors';

const prisma = new PrismaClient();

export interface CartItemDTO {
  id: string;
  productId: string;
  productName: string;
  productDescription: string | null;
  productImageUrl: string | null;
  unitPrice: number;
  quantity: number;
  lineSubtotal: number;
  lineDiscountTotal: number;
  lineTotal: number;
  currency: string;
  maxAvailableQuantity: number;
}

export interface CartDTO {
  id: string;
  userId: string | null;
  sessionId: string | null;
  items: CartItemDTO[];
  itemsCount: number;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
  updatedAt: Date;
  createdAt: Date;
}

export interface AddToCartPayload {
  userId?: string | null;
  sessionId?: string | null;
  productId: string;
  quantity?: number;
}

export interface UpdateCartItemPayload {
  userId?: string | null;
  sessionId?: string | null;
  itemId: string;
  quantity: number;
}

export interface RemoveCartItemPayload {
  userId?: string | null;
  sessionId?: string | null;
  itemId: string;
}

export interface ClearCartPayload {
  userId?: string | null;
  sessionId?: string | null;
}

export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  grandTotal: number;
  currency: string;
}

type CartOwnerWhere = { userId?: string | null; sessionId?: string | null };

const DEFAULT_CURRENCY = 'USD';

function assertCartOwner(payload: CartOwnerWhere): void {
  if (!payload.userId && !payload.sessionId) {
    throw createHttpError(400, 'Either userId or sessionId must be provided');
  }
}

function normalizeOwner(payload: CartOwnerWhere): { userId: string | null; sessionId: string | null } {
  return {
    userId: payload.userId ?? null,
    sessionId: payload.sessionId ?? null,
  };
}

function calculateItemTotals(
  unitPrice: number,
  quantity: number,
  discountPerUnit: number = 0,
  taxRate: number = 0
): { lineSubtotal: number; lineDiscountTotal: number; lineTaxTotal: number; lineTotal: number } {
  const rounded = (val: number) => Math.round(val * 100) / 100;
  const lineSubtotal = rounded(unitPrice * quantity);
  const lineDiscountTotal = rounded(discountPerUnit * quantity);
  const taxableBase = Math.max(0, lineSubtotal - lineDiscountTotal);
  const lineTaxTotal = rounded(taxableBase * taxRate);
  const lineTotal = rounded(taxableBase + lineTaxTotal);
  return { lineSubtotal, lineDiscountTotal, lineTaxTotal, lineTotal };
}

function calculateCartTotals(items: CartItemDTO[], taxRate: number = 0): CartTotals {
  const rounded = (val: number) => Math.round(val * 100) / 100;
  let subtotal = 0;
  let discountTotal = 0;
  let taxTotal = 0;
  let grandTotal = 0;

  for (const item of items) {
    subtotal += item.lineSubtotal;
    discountTotal += item.lineDiscountTotal;
    const taxableBase = Math.max(0, item.lineSubtotal - item.lineDiscountTotal);
    const lineTax = rounded(taxableBase * taxRate);
    taxTotal += lineTax;
    grandTotal += item.lineTotal;
  }

  return {
    subtotal: rounded(subtotal),
    discountTotal: rounded(discountTotal),
    taxTotal: rounded(taxTotal),
    grandTotal: rounded(grandTotal),
    currency: items[0]?.currency || DEFAULT_CURRENCY,
  };
}

function mapCartToDTO(cart: PrismaCart & { items: (PrismaCartItem & { product: PrismaProduct })[] }): CartDTO {
  const items: CartItemDTO[] = cart.items.map((item) => {
    const product = item.product;
    const {
      lineSubtotal,
      lineDiscountTotal,
      lineTaxTotal,
      lineTotal,
    } = calculateItemTotals(
      product.price,
      item.quantity,
      0,
      0
    );

    return {
      id: item.id,
      productId: product.id,
      productName: product.name,
      productDescription: product.description ?? null,
      productImageUrl: product.imageUrl ?? null,
      unitPrice: product.price,
      quantity: item.quantity,
      lineSubtotal,
      lineDiscountTotal,
      lineTotal,
      currency: product.currency || DEFAULT_CURRENCY,
      maxAvailableQuantity: product.stock,
    };
  });

  const totals = calculateCartTotals(items, 0);

  return {
    id: cart.id,
    userId: cart.userId,
    sessionId: cart.sessionId,
    items,
    itemsCount: items.reduce((acc, i) => acc + i.quantity, 0),
    subtotal: totals.subtotal,
    discountTotal: totals.discountTotal,
    taxTotal: totals.taxTotal,
    grandTotal: totals.grandTotal,
    currency: totals.currency,
    updatedAt: cart.updatedAt,
    createdAt: cart.createdAt,
  };
}

async function findOrCreateCart(owner: CartOwnerWhere): Promise<PrismaCart> {
  assertCartOwner(owner);
  const { userId, sessionId } = normalizeOwner(owner);

  let cart = await prisma.cart.findFirst({
    where: { userId: userId ?? undefined, sessionId: sessionId ?? undefined },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: {
        userId,
        sessionId,
        currency: DEFAULT_CURRENCY,
      },
    });
  }

  return cart;
}

async function getCartWithItems(owner: CartOwnerWhere): Promise<PrismaCart & { items: (PrismaCartItem & { product: PrismaProduct })[] }> {
  assertCartOwner(owner);
  const { userId, sessionId } = normalizeOwner(owner);

  const cart = await prisma.cart.findFirst({
    where: { userId: userId ?? undefined, sessionId: sessionId ?? undefined },
    include: { items: { include: { product: true } } },
  });

  if (!cart) {
    const newCart = await prisma.cart.create({
      data: {
        userId,
        sessionId,
        currency: DEFAULT_CURRENCY,
      },
      include: {
        items: { include: { product: true } },
      },
    });
    return newCart;
  }

  return cart;
}

async function validateProductAvailability(productId: string, desiredQuantity: number): Promise<PrismaProduct> {
  if (desiredQuantity <= 0) {
    throw createHttpError(400, 'Quantity must be greater than zero');
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product) {
    throw createHttpError(404, 'Product not found');
  }

  if (!product.isActive) {
    throw createHttpError(400, 'Product is not available for purchase');
  }

  if (product.stock < desiredQuantity) {
    throw createHttpError(400, `Only undefined units available for this product`);
  }

  return product;
}

export async function getCart(owner: CartOwnerWhere): Promise<CartDTO> {
  const cart = await getCartWithItems(owner);
  return mapCartToDTO(cart);
}

export async function addToCart(payload: AddToCartPayload): Promise<CartDTO> {
  const { userId, sessionId, productId } = payload;
  const quantity = payload.quantity && payload.quantity > 0 ? payload.quantity : 1;

  const cart = await findOrCreateCart({ userId: userId ?? null, sessionId: sessionId ?? null });

  const existingItem = await prisma.cartItem.findFirst({
    where: {
      cartId: cart.id,
      productId,
    },
    include: { product: true },
  });

  let newQuantity = quantity;

  if (existingItem) {
    newQuantity = existingItem.quantity + quantity;
  }

  const product = await validateProductAvailability(productId, newQuantity);

  const upsertedItem = await prisma.cartItem.upsert({
    where: {
      cartId_productId: {
        cartId: cart.id,
        productId,
      },
    },
    update: {
      quantity: newQuantity,
    },
    create: {
      cartId: cart.id,
      productId,
      quantity,
    },
  });

  const fullCart = await prisma.cart.findUniqueOrThrow({
    where: { id: cart.id },
    include: {
      items: {
        include: { product: true },
      },
    },
  });

  return mapCartToDTO(fullCart);
}

export async function updateCartItem(payload: UpdateCartItemPayload): Promise<CartDTO> {
  const { userId, sessionId, itemId, quantity } = payload;
  if (quantity < 0) {
    throw createHttpError(400, 'Quantity cannot be negative