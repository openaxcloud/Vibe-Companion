import { PrismaClient, Product, Category, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type SortDirection = 'asc' | 'desc';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface ProductFilterParams extends PaginationParams {
  search?: string;
  categoryIds?: string[];
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'name' | 'price' | 'createdAt' | 'updatedAt';
  sortDirection?: SortDirection;
  includeInactive?: boolean;
}

export interface ProductCreateInput {
  name: string;
  description?: string | null;
  price: number;
  categoryId: string;
  imageUrl?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface ProductUpdateInput {
  name?: string;
  description?: string | null;
  price?: number;
  categoryId?: string;
  imageUrl?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface CategoryCreateInput {
  name: string;
  description?: string | null;
  parentCategoryId?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface CategoryUpdateInput {
  name?: string;
  description?: string | null;
  parentCategoryId?: string | null;
  isActive?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductWithCategory extends Product {
  category: Category | null;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function validatePagination(params?: PaginationParams): { page: number; pageSize: number } {
  const page = params?.page && params.page > 0 ? params.page : DEFAULT_PAGE;
  let pageSize =
    params?.pageSize && params.pageSize > 0
      ? Math.min(params.pageSize, MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  return { page, pageSize };
}

function buildProductWhereClause(filters: ProductFilterParams): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};

  if (!filters.includeInactive) {
    where.isActive = true;
  }

  if (filters.search) {
    const search = filters.search.trim();
    if (search.length > 0) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
  }

  if (filters.categoryIds && filters.categoryIds.length > 0) {
    where.categoryId = {
      in: filters.categoryIds,
    };
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

  return where;
}

function buildProductOrderBy(
  sortBy?: ProductFilterParams['sortBy'],
  sortDirection?: SortDirection
): Prisma.ProductOrderByWithRelationInput {
  const direction: SortDirection = sortDirection || 'asc';

  switch (sortBy) {
    case 'price':
      return { price: direction };
    case 'createdAt':
      return { createdAt: direction };
    case 'updatedAt':
      return { updatedAt: direction };
    case 'name':
    default:
      return { name: direction };
  }
}

export class ProductService {
  async createProduct(data: ProductCreateInput): Promise<Product> {
    return prisma.product.create({
      data: {
        name: data.name.trim(),
        description: data.description ?? null,
        price: data.price,
        category: {
          connect: {
            id: data.categoryId,
          },
        },
        imageUrl: data.imageUrl ?? null,
        isActive: data.isActive ?? true,
        metadata: data.metadata ?? null,
      },
    });
  }

  async getProductById(id: string): Promise<ProductWithCategory | null> {
    if (!id) {
      throw new Error('Product id is required');
    }

    return prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async updateProduct(id: string, data: ProductUpdateInput): Promise<Product> {
    if (!id) {
      throw new Error('Product id is required');
    }

    const updateData: Prisma.ProductUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.price !== undefined) {
      updateData.price = data.price;
    }
    if (data.categoryId !== undefined) {
      updateData.category = {
        connect: {
          id: data.categoryId,
        },
      };
    }
    if (data.imageUrl !== undefined) {
      updateData.imageUrl = data.imageUrl;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }

    return prisma.product.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteProduct(id: string, softDelete = true): Promise<Product> {
    if (!id) {
      throw new Error('Product id is required');
    }

    if (softDelete) {
      return prisma.product.update({
        where: { id },
        data: { isActive: false },
      });
    }

    return prisma.product.delete({
      where: { id },
    });
  }

  async listProducts(filters: ProductFilterParams = {}): Promise<PaginatedResult<ProductWithCategory>> {
    const { page, pageSize } = validatePagination(filters);

    const where = buildProductWhereClause(filters);
    const orderBy = buildProductOrderBy(filters.sortBy, filters.sortDirection);

    const [total, data] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          category: true,
        },
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

  async searchProducts(
    search: string,
    filters: Omit<ProductFilterParams, 'search'> = {}
  ): Promise<PaginatedResult<ProductWithCategory>> {
    const params: ProductFilterParams = {
      ...filters,
      search,
    };

    return this.listProducts(params);
  }

  async updateProductImageUrl(id: string, imageUrl: string | null): Promise<Product> {
    if (!id) {
      throw new Error('Product id is required');
    }

    return prisma.product.update({
      where: { id },
      data: {
        imageUrl,
      },
    });
  }

  async createCategory(data: CategoryCreateInput): Promise<Category> {
    const categoryData: Prisma.CategoryCreateInput = {
      name: data.name.trim(),
      description: data.description ?? null,
      isActive: data.isActive ?? true,
      metadata: data.metadata ?? null,
    };

    if (data.parentCategoryId) {
      categoryData.parentCategory = {
        connect: {
          id: data.parentCategoryId,
        },
      };
    }

    return prisma.category.create({
      data: categoryData,
    });
  }

  async getCategoryById(id: string): Promise<Category | null> {
    if (!id) {
      throw new Error('Category id is required');
    }

    return prisma.category.findUnique({
      where: { id },
    });
  }

  async updateCategory(id: string, data: CategoryUpdateInput): Promise<Category> {
    if (!id) {
      throw new Error('Category id is required');
    }

    const updateData: Prisma.CategoryUpdateInput = {};

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description;
    }
    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
    }
    if (data.metadata !== undefined) {
      updateData.metadata = data.metadata;
    }

    if (data.parentCategoryId !== undefined) {
      if (data.parentCategoryId === null) {
        updateData.parentCategory = {
          disconnect: true,
        };
      } else {
        updateData.parentCategory = {
          connect: {
            id: data.parentCategoryId,
          },
        };
      }
    }

    return prisma.category.update({
      where: { id },
      data: updateData,
    });
  }

  async deleteCategory(id: string, softDelete = true): Promise<Category