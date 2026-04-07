import { Prisma, Product, Category, PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';

export interface ProductFilters {
  search?: string;
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  isActive?: boolean;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface SortParams {
  sortBy?: 'createdAt' | 'updatedAt' | 'price' | 'name';
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateProductInput {
  name: string;
  description?: string | null;
  price: number;
  categoryId: number;
  sku?: string | null;
  stock: number;
  isActive?: boolean;
  metadata?: Prisma.JsonValue | null;
}

export interface UpdateProductInput {
  name?: string;
  description?: string | null;
  price?: number;
  categoryId?: number;
  sku?: string | null;
  stock?: number;
  isActive?: boolean;
  metadata?: Prisma.JsonValue | null;
}

export interface InventoryAdjustmentResult {
  productId: number;
  previousStock: number;
  newStock: number;
}

export interface CategoryWithCounts extends Category {
  productCount: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function normalizePagination(params?: PaginationParams): Required<PaginationParams> {
  const page = params?.page && params.page > 0 ? params.page : DEFAULT_PAGE;
  let pageSize =
    params?.pageSize && params.pageSize > 0 ? Math.min(params.pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;

  return { page, pageSize };
}

function buildProductWhere(filters?: ProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (!filters) return where;

  if (typeof filters.isActive === 'boolean') {
    where.isActive = filters.isActive;
  }

  if (filters.categoryId !== undefined) {
    where.categoryId = filters.categoryId;
  }

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length > 0) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
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

  if (filters.inStockOnly) {
    where.stock = { gt: 0 };
  }

  return where;
}

function buildOrderBy(sort?: SortParams): Prisma.ProductOrderByWithRelationInput {
  const sortBy = sort?.sortBy ?? 'createdAt';
  const sortDirection = sort?.sortDirection ?? 'desc';

  return {
    [sortBy]: sortDirection,
  } as Prisma.ProductOrderByWithRelationInput;
}

export async function getProductById(
  id: number,
  options?: { includeCategory?: boolean; includeMetadata?: boolean }
): Promise<Product | (Product & { category?: Category | null }) | null> {
  const include: Prisma.ProductInclude = {};

  if (options?.includeCategory) {
    include.category = true;
  }

  // metadata is part of Product model, no special include flag needed, but kept for API completeness
  const product = await prisma.product.findUnique({
    where: { id },
    include: Object.keys(include).length ? include : undefined,
  });

  return product;
}

export async function listProducts(
  filters?: ProductFilters,
  paginationParams?: PaginationParams,
  sortParams?: SortParams
): Promise<PaginatedResult<Product>> {
  const { page, pageSize } = normalizePagination(paginationParams);
  const where = buildProductWhere(filters);
  const orderBy = buildOrderBy(sortParams);

  const [total, data] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const totalPages = Math.ceil(total / pageSize) || 1;

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
  };
}

export async function createProduct(data: CreateProductInput): Promise<Product> {
  const {
    name,
    description,
    price,
    categoryId,
    sku,
    stock,
    isActive = true,
    metadata = null,
  } = data;

  const product = await prisma.product.create({
    data: {
      name,
      description: description ?? null,
      price,
      categoryId,
      sku: sku ?? null,
      stock,
      isActive,
      metadata,
    },
  });

  return product;
}

export async function updateProduct(id: number, data: UpdateProductInput): Promise<Product | null> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return null;
  }

  const updateData: Prisma.ProductUpdateInput = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.price !== undefined) updateData.price = data.price;
  if (data.categoryId !== undefined) updateData.categoryId = data.categoryId;
  if (data.sku !== undefined) updateData.sku = data.sku;
  if (data.stock !== undefined) updateData.stock = data.stock;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.metadata !== undefined) updateData.metadata = data.metadata;

  const updated = await prisma.product.update({
    where: { id },
    data: updateData,
  });

  return updated;
}

export async function deleteProduct(id: number): Promise<boolean> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    return false;
  }

  await prisma.product.delete({ where: { id } });
  return true;
}

export async function listCategoriesWithCounts(): Promise<CategoryWithCounts[]> {
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
  });

  if (categories.length === 0) return [];

  const counts = await prisma.product.groupBy({
    by: ['categoryId'],
    _count: { _all: true },
    where: {
      categoryId: { in: categories.map((c) => c.id) },
    },
  });

  const countMap = new Map<number, number>();
  counts.forEach((c) => {
    countMap.set(c.categoryId, c._count._all);
  });

  return categories.map((category) => ({
    ...category,
    productCount: countMap.get(category.id) ?? 0,
  }));
}

export async function getCategoryById(id: number): Promise<Category | null> {
  return prisma.category.findUnique({ where: { id } });
}

export async function createCategory(data: { name: string; description?: string | null }): Promise<Category> {
  const { name, description } = data;
  return prisma.category.create({
    data: {
      name,
      description: description ?? null,
    },
  });
}

export async function updateCategory(
  id: number,
  data: { name?: string; description?: string | null }
): Promise<Category | null> {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return null;

  const updateData: Prisma.CategoryUpdateInput = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;

  return prisma.category.update({
    where: { id },
    data: updateData,
  });
}

export async function deleteCategory(id: number): Promise<boolean> {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) return false;

  await prisma.category.delete({ where: { id } });
  return true;
}

export async function adjustInventoryAtomic(
  productId: number,
  delta: number,
  tx?: PrismaClient
): Promise<InventoryAdjustmentResult | null> {
  const client = tx ?? prisma;

  const result = await client.$transaction(async (trx) => {
    const product = await trx.product.findUnique({
      where: { id: productId },
      select: { id: true, stock: true },
    });

    if (!product) {
      return null;
    }

    const newStock = product.stock + delta;
    if (newStock < 0) {
      throw new Error('Insufficient stock to apply this inventory adjustment');
    }

    const updated = await trx.product.update({
      where: { id: product