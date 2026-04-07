import { PrismaClient, Product, Prisma } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { PaginationParams, PaginatedResult } from '../types/pagination';
import { SortDirection } from '../types/sorting';

const prisma = new PrismaClient();

export type ProductAvailability = 'IN_STOCK' | 'OUT_OF_STOCK' | 'DISCONTINUED';

export interface ProductFilters {
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: ProductAvailability;
  isActive?: boolean;
}

export type ProductSortBy = 'price' | 'createdAt' | 'updatedAt' | 'name';

export interface ProductListParams extends PaginationParams {
  filters?: ProductFilters;
  sortBy?: ProductSortBy;
  sortDirection?: SortDirection;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  price: number;
  currency: string;
  inventory: number;
  availability?: ProductAvailability;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  sku?: string | null;
  categoryId?: string | null;
  price?: number;
  currency?: string;
  inventory?: number;
  availability?: ProductAvailability;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ProductWithInventory extends Product {
  // extend if needed
}

const buildWhereClause = (filters?: ProductFilters): Prisma.ProductWhereInput => {
  if (!filters) return {};

  const where: Prisma.ProductWhereInput = {};

  if (filters.search && filters.search.trim().length > 0) {
    const search = filters.search.trim();
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { sku: { contains: search, mode: 'insensitive' } }
    ];
  }

  if (filters.categoryId) {
    where.categoryId = filters.categoryId;
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

  if (filters.availability) {
    where.availability = filters.availability as any;
  }

  if (typeof filters.isActive === 'boolean') {
    where.isActive = filters.isActive;
  }

  return where;
};

const buildOrderByClause = (
  sortBy?: ProductSortBy,
  sortDirection?: SortDirection
): Prisma.ProductOrderByWithRelationInput => {
  const direction: SortDirection = sortDirection === 'asc' || sortDirection === 'desc' ? sortDirection : 'desc';

  switch (sortBy) {
    case 'price':
      return { price: direction };
    case 'name':
      return { name: direction };
    case 'updatedAt':
      return { updatedAt: direction };
    case 'createdAt':
    default:
      return { createdAt: direction };
  }
};

export const productService = {
  async listProducts(params: ProductListParams): Promise<PaginatedResult<ProductWithInventory>> {
    const {
      page = 1,
      pageSize = 20,
      filters,
      sortBy = 'createdAt',
      sortDirection = 'desc'
    } = params;

    if (page < 1 || pageSize < 1) {
      throw new BadRequestError('Page and pageSize must be positive integers');
    }

    const where = buildWhereClause(filters);
    const orderBy = buildOrderByClause(sortBy, sortDirection);

    const [items, totalItems] = await prisma.$transaction([
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.product.count({ where })
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      items,
      page,
      pageSize,
      totalItems,
      totalPages
    };
  },

  async getProductById(id: string): Promise<ProductWithInventory> {
    if (!id) {
      throw new BadRequestError('Product ID is required');
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  },

  async createProduct(input: CreateProductInput): Promise<ProductWithInventory> {
    if (!input.name || typeof input.price !== 'number' || !input.currency) {
      throw new BadRequestError('Name, price, and currency are required');
    }

    if (input.price < 0) {
      throw new BadRequestError('Price must be non-negative');
    }

    if (input.inventory < 0) {
      throw new BadRequestError('Inventory must be non-negative');
    }

    const data: Prisma.ProductCreateInput = {
      name: input.name,
      description: input.description ?? null,
      sku: input.sku ?? null,
      price: input.price,
      currency: input.currency,
      inventory: input.inventory,
      availability: input.availability ?? (input.inventory > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK'),
      isActive: input.isActive ?? true,
      metadata: input.metadata ?? Prisma.JsonNull
    };

    if (input.categoryId) {
      data.category = {
        connect: { id: input.categoryId }
      };
    }

    const product = await prisma.product.create({
      data
    });

    return product;
  },

  async updateProduct(id: string, input: UpdateProductInput): Promise<ProductWithInventory> {
    if (!id) {
      throw new BadRequestError('Product ID is required');
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    const data: Prisma.ProductUpdateInput = {};

    if (typeof input.name === 'string') {
      if (!input.name.trim()) {
        throw new BadRequestError('Name cannot be empty');
      }
      data.name = input.name;
    }

    if ('description' in input) {
      data.description = input.description ?? null;
    }

    if ('sku' in input) {
      data.sku = input.sku ?? null;
    }

    if (typeof input.price === 'number') {
      if (input.price < 0) {
        throw new BadRequestError('Price must be non-negative');
      }
      data.price = input.price;
    }

    if (typeof input.currency === 'string') {
      data.currency = input.currency;
    }

    if (typeof input.inventory === 'number') {
      if (input.inventory < 0) {
        throw new BadRequestError('Inventory must be non-negative');
      }
      data.inventory = input.inventory;

      if (!input.availability) {
        data.availability =
          input.inventory > 0 ? ('IN_STOCK' as any) : ('OUT_OF_STOCK' as any);
      }
    }

    if (input.availability) {
      data.availability = input.availability as any;
    }

    if (typeof input.isActive === 'boolean') {
      data.isActive = input.isActive;
    }

    if ('metadata' in input) {
      data.metadata = input.metadata ?? Prisma.JsonNull;
    }

    if ('categoryId' in input) {
      if (input.categoryId === null) {
        data.category = { disconnect: true };
      } else if (input.categoryId) {
        data.category = { connect: { id: input.categoryId } };
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data
    });

    return updated;
  },

  async deleteProduct(id: string): Promise<void> {
    if (!id) {
      throw new BadRequestError('Product ID is required');
    }

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    await prisma.product.delete({
      where: { id }
    });
  },

  async adjustInventory(
    id: string,
    diff: number,
    options?: { allowNegative?: boolean }
  ): Promise<ProductWithInventory> {
    if (!id) {
      throw new BadRequestError('Product ID is required');
    }
    if (!Number.isFinite(diff) || diff === 0) {
      throw new BadRequestError('Inventory adjustment must be a non-zero finite number');
    }

    const product = await prisma.product.findUnique({
      where: { id }
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    const newInventory = product.inventory + diff;
    if (newInventory < 0 && !options?.allowNegative) {
      throw new BadRequestError('Inventory cannot be negative');
    }

    const availability: