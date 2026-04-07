import { Prisma, Product, Category, PrismaClient } from '@prisma/client';
import slugify from 'slugify';

const prisma = new PrismaClient();

export type ProductSortField = 'createdAt' | 'updatedAt' | 'price' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface ProductFilter {
  search?: string;
  categoryIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  isActive?: boolean;
  inStockOnly?: boolean;
  minStock?: number;
  maxStock?: number;
  includeDeleted?: boolean;
  createdFrom?: Date;
  createdTo?: Date;
}

export interface ProductSearchOptions {
  filter?: ProductFilter;
  page?: number;
  pageSize?: number;
  sortBy?: ProductSortField;
  sortOrder?: SortOrder;
}

export interface ProductSearchResult {
  data: ProductWithRelations[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductCreateInput {
  name: string;
  description?: string | null;
  price: number;
  sku?: string | null;
  categoryIds?: string[];
  stock?: number;
  isActive?: boolean;
  slug?: string;
  metadata?: Record<string, unknown>;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string | null;
  price?: number;
  sku?: string | null;
  categoryIds?: string[];
  stock?: number;
  isActive?: boolean;
  slug?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface InventoryAdjustmentResult {
  productId: string;
  previousStock: number;
  newStock: number;
}

export interface ProductWithRelations extends Product {
  categories: Category[];
}

const MIN_STOCK = 0;

const buildProductWhereClause = (filter?: ProductFilter): Prisma.ProductWhereInput => {
  const where: Prisma.ProductWhereInput = {};

  if (!filter) return where;

  if (!filter.includeDeleted) {
    where.deletedAt = null;
  }

  if (filter.search) {
    const search = filter.search.trim();
    if (search.length > 0) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  if (filter.categoryIds && filter.categoryIds.length > 0) {
    where.categories = {
      some: {
        id: { in: filter.categoryIds },
      },
    };
  }

  if (typeof filter.isActive === 'boolean') {
    where.isActive = filter.isActive;
  }

  if (typeof filter.minPrice === 'number' || typeof filter.maxPrice === 'number') {
    where.price = {};
    if (typeof filter.minPrice === 'number') {
      where.price.gte = filter.minPrice;
    }
    if (typeof filter.maxPrice === 'number') {
      where.price.lte = filter.maxPrice;
    }
  }

  if (typeof filter.minStock === 'number' || typeof filter.maxStock === 'number') {
    where.stock = {};
    if (typeof filter.minStock === 'number') {
      where.stock.gte = filter.minStock;
    }
    if (typeof filter.maxStock === 'number') {
      where.stock.lte = filter.maxStock;
    }
  }

  if (filter.inStockOnly) {
    where.stock = { ...(where.stock || {}), gt: 0 };
  }

  if (filter.createdFrom || filter.createdTo) {
    where.createdAt = {};
    if (filter.createdFrom) {
      where.createdAt.gte = filter.createdFrom;
    }
    if (filter.createdTo) {
      where.createdAt.lte = filter.createdTo;
    }
  }

  return where;
};

const buildProductOrderByClause = (sortBy?: ProductSortField, sortOrder: SortOrder = 'desc'): Prisma.ProductOrderByWithRelationInput => {
  const field = sortBy || 'createdAt';
  return { [field]: sortOrder };
};

const generateSlugBase = (name: string): string => {
  return slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });
};

const generateUniqueSlug = async (name: string, excludeProductId?: string): Promise<string> => {
  const baseSlug = generateSlugBase(name);

  const where: Prisma.ProductWhereInput = {
    slug: {
      startsWith: baseSlug,
    },
  };

  if (excludeProductId) {
    where.id = { not: excludeProductId };
  }

  const existing = await prisma.product.findMany({
    where,
    select: { slug: true },
  });

  if (existing.length === 0) {
    return baseSlug;
  }

  const existingSlugs = new Set(existing.map(e => e.slug));
  let suffix = 1;
  let candidate = baseSlug;

  while (existingSlugs.has(candidate)) {
    candidate = `undefined-undefined`;
    suffix += 1;
  }

  return candidate;
};

const validateStock = (stock: number | undefined | null): number => {
  if (stock == null || Number.isNaN(stock)) return MIN_STOCK;
  return Math.max(MIN_STOCK, Math.floor(stock));
};

const ensureCategoriesExist = async (categoryIds: string[]): Promise<void> => {
  if (!categoryIds.length) return;
  const categories = await prisma.category.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true },
  });
  const foundIds = new Set(categories.map(c => c.id));
  const missing = categoryIds.filter(id => !foundIds.has(id));
  if (missing.length) {
    throw new Error(`One or more categories do not exist: undefined`);
  }
};

export const productService = {
  async searchProducts(options: ProductSearchOptions = {}): Promise<ProductSearchResult> {
    const {
      filter,
      page = 1,
      pageSize = 20,
      sortBy,
      sortOrder = 'desc',
    } = options;

    const where = buildProductWhereClause(filter);
    const orderBy = buildProductOrderByClause(sortBy, sortOrder);

    const currentPage = Math.max(1, page);
    const currentPageSize = Math.max(1, Math.min(100, pageSize));

    const [total, data] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (currentPage - 1) * currentPageSize,
        take: currentPageSize,
        include: { categories: true },
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / currentPageSize));

    return {
      data,
      total,
      page: currentPage,
      pageSize: currentPageSize,
      totalPages,
    };
  },

  async getProductById(id: string, options?: { includeDeleted?: boolean }): Promise<ProductWithRelations | null> {
    const where: Prisma.ProductWhereUniqueInput = { id };
    const product = await prisma.product.findUnique({
      where,
      include: { categories: true },
    });

    if (!product) return null;

    if (!options?.includeDeleted && product.deletedAt) {
      return null;
    }

    return product;
  },

  async getProductBySlug(slug: string, options?: { includeDeleted?: boolean }): Promise<ProductWithRelations | null> {
    const product = await prisma.product.findFirst({
      where: {
        slug,
        ...(options?.includeDeleted ? {} : { deletedAt: null }),
      },
      include: { categories: true },
    });
    return product;
  },

  async createProduct(input: ProductCreateInput): Promise<ProductWithRelations> {
    const {
      name,
      description = null,
      price,
      sku = null,
      categoryIds = [],
      stock,
      isActive = true,
      slug,
      metadata,
    } = input;

    if (!name || !name.trim()) {
      throw new Error('Product name is required');
    }

    if (price == null || Number.isNaN(price) || price < 0) {
      throw new Error('Product price must be a non-negative number');
    }

    const normalizedStock = validateStock(stock);

    if (categoryIds.length) {
      await ensureCategoriesExist(categoryIds);
    }

    const finalSlug = slug ? generateSlugBase(slug) : await generateUniqueSlug(name);

    const created = await prisma.product.create({
      data: {
        name: name.trim(),
        description,
        price,
        sku,
        slug: finalSlug,
        stock: normalizedStock,
        isActive,
        metadata: metadata ?? Prisma.JsonNull,
        categories: categoryIds.length
          ? {
              connect: categoryIds.map(id => ({ id })),
            }
          : undefined,
      },
      include: { categories: true },
    });

    if (!slug) {
      const uniqueSlug = await generateUniqueSlug(name, created.id);
      if (uniqueSlug !== finalSlug) {
        const updated = await prisma.product.update({
          where: { id: created.id },
          data: { slug: uniqueSlug