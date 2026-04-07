import { Prisma, Product, PrismaClient } from '@prisma/client';
import createHttpError from 'http-errors';

const prisma = new PrismaClient();

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  isActive?: boolean;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface SortOptions {
  sortBy?: 'createdAt' | 'price' | 'name';
  sortOrder?: 'asc' | 'desc';
}

export interface ProductListQuery extends ProductFilters, PaginationOptions, SortOptions {}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  stock: number;
  sku?: string | null;
  imageUrls?: string[];
  isActive?: boolean;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  price?: number;
  categoryId?: string;
  stock?: number;
  sku?: string | null;
  imageUrls?: string[];
  isActive?: boolean;
}

export interface ProductWithRelations extends Product {
  category?: {
    id: string;
    name: string;
  } | null;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_IMAGE_PLACEHOLDER = 'https://example.com/images/product-placeholder.png';

const buildProductWhere = (filters: ProductFilters): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
      { sku: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.price = {};
    if (filters.minPrice !== undefined) {
      where.price.gte = filters.minPrice;
    }
    if (filters.maxPrice !== undefined) {
      where.price.lte = filters.maxPrice;
    }
  }

  if (filters.inStock !== undefined) {
    where.stock = filters.inStock ? { gt: 0 } : 0;
  }

  if (filters.isActive !== undefined) {
    where.isActive = filters.isActive;
  } else {
    where.isActive = true;
  }

  return where;
};

const buildProductOrderBy = (sort: SortOptions): Prisma.ProductOrderByWithRelationInput => {
  const { sortBy, sortOrder } = sort;
  const order: Prisma.ProductOrderByWithRelationInput = {};

  if (!sortBy) {
    order.createdAt = 'desc';
    return order;
  }

  const direction: Prisma.SortOrder = sortOrder === 'asc' ? 'asc' : 'desc';

  if (sortBy === 'name') {
    order.name = direction;
  } else if (sortBy === 'price') {
    order.price = direction;
  } else {
    order.createdAt = direction;
  }

  return order;
};

const normalizeImageUrls = (imageUrls?: string[] | null): string[] => {
  if (!imageUrls || imageUrls.length === 0) {
    return [DEFAULT_IMAGE_PLACEHOLDER];
  }
  return imageUrls.map((url) => url || DEFAULT_IMAGE_PLACEHOLDER);
};

export const productService = {
  async listProducts(query: ProductListQuery = {}): Promise<{
    data: ProductWithRelations[];
    total: number;
    page: number;
    limit: number;
  }> {
    const {
      page = DEFAULT_PAGE,
      limit = DEFAULT_LIMIT,
      sortBy,
      sortOrder,
      ...filters
    } = query;

    const where = buildProductWhere(filters);
    const orderBy = buildProductOrderBy({ sortBy, sortOrder });

    const skip = (page - 1) * limit;
    const take = limit;

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        take,
        skip,
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      }),
    ]);

    const normalized = products.map((p) => ({
      ...p,
      imageUrls: normalizeImageUrls(p.imageUrls as string[] | null),
    })) as ProductWithRelations[];

    return {
      data: normalized,
      total,
      page,
      limit,
    };
  },

  async getProductById(id: string): Promise<ProductWithRelations> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!product) {
      throw createHttpError(404, 'Product not found');
    }

    return {
      ...product,
      imageUrls: normalizeImageUrls(product.imageUrls as string[] | null),
    } as ProductWithRelations;
  },

  async createProduct(input: CreateProductInput): Promise<ProductWithRelations> {
    const data: Prisma.ProductCreateInput = {
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      stock: input.stock,
      sku: input.sku ?? null,
      isActive: input.isActive ?? true,
      imageUrls: normalizeImageUrls(input.imageUrls),
      category: {
        connect: {
          id: input.categoryId,
        },
      },
    };

    const created = await prisma.product.create({
      data,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return created as ProductWithRelations;
  },

  async updateProductAsAdmin(
    id: string,
    input: UpdateProductInput
  ): Promise<ProductWithRelations> {
    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createHttpError(404, 'Product not found');
    }

    if (input.stock !== undefined && input.stock < 0) {
      throw createHttpError(400, 'Stock cannot be negative');
    }

    const data: Prisma.ProductUpdateInput = {};

    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.price !== undefined) {
      if (input.price < 0) {
        throw createHttpError(400, 'Price cannot be negative');
      }
      data.price = input.price;
    }
    if (input.stock !== undefined) data.stock = input.stock;
    if (input.sku !== undefined) data.sku = input.sku;
    if (input.isActive !== undefined) data.isActive = input.isActive;
    if (input.imageUrls !== undefined) {
      data.imageUrls = normalizeImageUrls(input.imageUrls);
    }
    if (input.categoryId !== undefined) {
      data.category = {
        connect: {
          id: input.categoryId,
        },
      };
    }

    const updated = await prisma.product.update({
      where: { id },
      data,
      include: {
        category: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return updated as ProductWithRelations;
  },

  async updateProductStock(
    id: string,
    delta: number
  ): Promise<ProductWithRelations> {
    if (!Number.isFinite(delta) || delta === 0) {
      throw createHttpError(400, 'Stock delta must be a non-zero number');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({
        where: { id },
        select: {
          id: true,
          stock: true,
        },
      });

      if (!product) {
        throw createHttpError(404, 'Product not found');
      }

      const newStock = product.stock + delta;

      if (newStock < 0) {
        throw createHttpError(400, 'Insufficient stock for this operation');
      }

      return tx.product.update({
        where: { id },
        data: {
          stock: newStock,
        },
        include: {
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });
    });

    return {
      ...updated,
      imageUrls: normalizeImageUrls(updated.imageUrls as string[] | null),
    } as ProductWithRelations;
  },

  async deleteProduct(id: string): Promise<void> {
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw createHttpError(404, 'Product not found');
    }

    await prisma.product.delete({
      where: { id },
    });
  },
};

export default productService;