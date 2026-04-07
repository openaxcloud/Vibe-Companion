import { Prisma, Product, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface ProductFilterOptions {
  search?: string;
  categoryIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  includeInactive?: boolean;
  cursor?: string;
  skip?: number;
  take?: number;
  orderBy?:
    | 'createdAt'
    | 'price'
    | 'name'
    | 'popularity'
    | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface ProductCreateInput {
  name: string;
  description?: string | null;
  price: number;
  sku?: string | null;
  categoryIds?: string[];
  images?: {
    url: string;
    altText?: string | null;
    sortOrder?: number;
  }[];
  inventory: {
    quantity: number;
    allowBackorder?: boolean;
  };
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string | null;
  price?: number;
  sku?: string | null;
  categoryIds?: string[];
  images?: {
    id?: string;
    url: string;
    altText?: string | null;
    sortOrder?: number;
    _delete?: boolean;
  }[];
  inventory?: {
    quantity?: number;
    allowBackorder?: boolean;
  };
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ProductWithRelations extends Product {
  categories: {
    id: string;
    name: string;
    slug: string;
  }[];
  images: {
    id: string;
    url: string;
    altText: string | null;
    sortOrder: number;
  }[];
  inventory: {
    id: string;
    quantity: number;
    allowBackorder: boolean;
  } | null;
}

export interface InventoryDecrementItem {
  productId: string;
  quantity: number;
}

export class InventoryError extends Error {
  public code: string;
  public productId?: string;

  constructor(message: string, code = 'INVENTORY_ERROR', productId?: string) {
    super(message);
    this.name = 'InventoryError';
    this.code = code;
    this.productId = productId;
  }
}

const productInclude = {
  categories: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  images: {
    select: {
      id: true,
      url: true,
      altText: true,
      sortOrder: true,
    },
    orderBy: {
      sortOrder: 'asc' as const,
    },
  },
  inventory: {
    select: {
      id: true,
      quantity: true,
      allowBackorder: true,
    },
  },
} satisfies Prisma.ProductInclude;

function buildProductWhereClause(
  filters: ProductFilterOptions
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (!filters.includeInactive) {
    where.isActive = true;
  }

  if (filters.inStockOnly) {
    where.inventory = {
      OR: [
        {
          quantity: {
            gt: 0,
          },
        },
        {
          allowBackorder: true,
        },
      ],
    };
  }

  if (filters.search) {
    const search = filters.search.trim();
    if (search) {
      where.OR = [
        {
          name: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          sku: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }
  }

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    where.categories = {
      some: {
        id: {
          in: filters.categoryIds,
        },
      },
    };
  }

  if (typeof filters.minPrice === 'number' || typeof filters.maxPrice === 'number') {
    where.price = {};
    if (typeof filters.minPrice === 'number') {
      where.price.gte = filters.minPrice;
    }
    if (typeof filters.maxPrice === 'number') {
      where.price.lte = filters.maxPrice;
    }
  }

  return where;
}

function buildOrderBy(
  orderBy?: ProductFilterOptions['orderBy'],
  direction?: ProductFilterOptions['orderDirection']
): Prisma.ProductOrderByWithRelationInput {
  const dir: Prisma.SortOrder = direction === 'asc' ? 'asc' : 'desc';

  switch (orderBy) {
    case 'price':
      return { price: dir };
    case 'name':
      return { name: dir };
    case 'popularity':
      return { popularityScore: dir };
    case 'updatedAt':
      return { updatedAt: dir };
    case 'createdAt':
    default:
      return { createdAt: dir };
  }
}

export async function getProducts(
  filters: ProductFilterOptions = {}
): Promise<{ items: ProductWithRelations[]; total: number }> {
  const where = buildProductWhereClause(filters);
  const take = filters.take && filters.take > 0 ? Math.min(filters.take, 100) : 20;
  const skip = filters.skip ?? 0;

  const [items, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      include: productInclude,
      take,
      skip,
      ...(filters.cursor
        ? {
            cursor: { id: filters.cursor },
          }
        : {}),
      orderBy: buildOrderBy(filters.orderBy, filters.orderDirection),
    }),
    prisma.product.count({ where }),
  ]);

  return {
    items: items as ProductWithRelations[],
    total,
  };
}

export async function getProductById(
  id: string,
  options?: { includeInactive?: boolean }
): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findFirst({
    where: {
      id,
      ...(options?.includeInactive ? {} : { isActive: true }),
    },
    include: productInclude,
  });

  return product as ProductWithRelations | null;
}

export async function getProductBySlug(
  slug: string,
  options?: { includeInactive?: boolean }
): Promise<ProductWithRelations | null> {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      ...(options?.includeInactive ? {} : { isActive: true }),
    },
    include: productInclude,
  });

  return product as ProductWithRelations | null;
}

export async function createProduct(
  data: ProductCreateInput
): Promise<ProductWithRelations> {
  const {
    categoryIds = [],
    images = [],
    inventory,
    metadata,
    isActive = true,
    ...baseData
  } = data;

  if (!inventory || typeof inventory.quantity !== 'number') {
    throw new Error('Inventory information with quantity is required when creating a product.');
  }

  const created = await prisma.product.create({
    data: {
      ...baseData,
      isActive,
      metadata: metadata ?? Prisma.JsonNull,
      categories: categoryIds.length
        ? {
            connect: categoryIds.map((id) => ({ id })),
          }
        : undefined,
      images: images.length
        ? {
            create: images.map((img, index) => ({
              url: img.url,
              altText: img.altText ?? null,
              sortOrder:
                typeof img.sortOrder === 'number'
                  ? img.sortOrder
                  : index,
            })),
          }
        : undefined,
      inventory: {
        create: {
          quantity: inventory.quantity,
          allowBackorder: inventory.allowBackorder ?? false,
        },
      },
    },
    include: productInclude,
  });

  return created as ProductWithRelations;
}

export async function updateProduct(
  productId: string,
  data: ProductUpdateInput
): Promise<ProductWithRelations> {
  const {
    categoryIds,
    images,
    inventory,
    metadata,
    ...baseData
  } = data;

  const updateData: Prisma.ProductUpdateInput = {
    ...baseData,
  };

  if (metadata !== undefined) {
    updateData.metadata = metadata ?? Prisma.JsonNull;
  }

  if (Array.isArray(categoryIds)) {
    updateData.categories = {
      set: [],
      connect: categoryIds.map((id) => ({ id })),
    };
  }

  if (Array.isArray(images)) {
    const creates: Prisma.ImageCreateWithoutProductInput[] = [];
    const updates: Prisma.ImageUpdateWithWhereUniqueWithoutProductInput[] = [];
    const deletes: Prisma.ImageWhereUniqueInput[] = [];

    images.forEach((img, index) => {
      if (img._delete && img.id) {
        deletes.push({ id: img.id });
      } else if (img.id) {
        updates.push({
          where: { id: img.id },
          data: {
            url: img.url,
            altText: img.altText ?? null,
            sortOrder:
              typeof img.sortOrder === 'number'
                ? img.sortOrder
                : index,
          },
        });
      } else {
        creates.push({
          url: img.url,
          altText: img.altText ?? null,
          sortOrder: