import { PrismaClient, Prisma, Product, ProductStockStatus } from '@prisma/client';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { buildPaginationParams, PaginationParams, PaginatedResult } from '../utils/pagination';
import { buildProductWhereInput, ProductFilterInput } from '../utils/productFilters';
import { buildProductOrderByInput, ProductSortInput } from '../utils/productSort';

const prisma = new PrismaClient();

export type ProductSearchInput = {
  query?: string;
  filters?: ProductFilterInput;
  sort?: ProductSortInput;
  page?: number;
  pageSize?: number;
};

export type ProductWithRelations = Product & {
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  brand?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  variants?: {
    id: string;
    sku: string;
    price: Prisma.Decimal;
    stock: number;
    attributes: Record<string, string>;
  }[];
};

export type ProductSearchResult = PaginatedResult<ProductWithRelations>;

export type StockCheckItem = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

export type StockCheckResult = {
  productId: string;
  variantId?: string | null;
  requested: number;
  available: number;
  status: ProductStockStatus | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';
};

export class ProductService {
  async searchProducts(input: ProductSearchInput = {}): Promise<ProductSearchResult> {
    const { query, filters, sort, page = 1, pageSize = 20 } = input;

    if (page < 1 || pageSize < 1 || pageSize > 100) {
      throw new BadRequestError('Invalid pagination parameters');
    }

    const pagination: PaginationParams = buildPaginationParams(page, pageSize);

    const where = buildProductWhereInput({
      query,
      filters,
    });

    const orderBy = buildProductOrderByInput(sort);

    const [total, items] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: pagination.skip,
        take: pagination.take,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          brand: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          variants: {
            select: {
              id: true,
              sku: true,
              price: true,
              stock: true,
              attributes: true,
            },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
      hasNextPage: page * pageSize < total,
      hasPreviousPage: page > 1,
    };
  }

  async getProductById(id: string): Promise<ProductWithRelations> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            stock: true,
            attributes: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  async getProductBySlug(slug: string): Promise<ProductWithRelations> {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        brand: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            price: true,
            stock: true,
            attributes: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundError('Product not found');
    }

    return product;
  }

  async checkStock(items: StockCheckItem[]): Promise<StockCheckResult[]> {
    if (!items.length) {
      return [];
    }

    const productIds = Array.from(new Set(items.map((i) => i.productId)));
    const variantIds = Array.from(
      new Set(
        items
          .map((i) => i.variantId)
          .filter((id): id is string => Boolean(id))
      )
    );

    const [products, variants] = await Promise.all([
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          stock: true,
          stockStatus: true,
        },
      }),
      variantIds.length
        ? prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: {
              id: true,
              productId: true,
              stock: true,
            },
          })
        : Promise.resolve([] as { id: string; productId: string; stock: number }[]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    const results: StockCheckResult[] = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        results.push({
          productId: item.productId,
          variantId: item.variantId ?? undefined,
          requested: item.quantity,
          available: 0,
          status: 'OUT_OF_STOCK',
        });
        continue;
      }

      if (item.variantId) {
        const variant = variantMap.get(item.variantId);
        if (!variant || variant.productId !== product.id) {
          results.push({
            productId: item.productId,
            variantId: item.variantId,
            requested: item.quantity,
            available: 0,
            status: 'OUT_OF_STOCK',
          });
          continue;
        }

        const available = variant.stock;
        const status =
          available <= 0
            ? 'OUT_OF_STOCK'
            : available >= item.quantity
            ? product.stockStatus
            : 'INSUFFICIENT_STOCK';

        results.push({
          productId: item.productId,
          variantId: item.variantId,
          requested: item.quantity,
          available,
          status,
        });
      } else {
        const available = product.stock;
        const status =
          available <= 0
            ? 'OUT_OF_STOCK'
            : available >= item.quantity
            ? product.stockStatus
            : 'INSUFFICIENT_STOCK';

        results.push({
          productId: item.productId,
          requested: item.quantity,
          available,
          status,
        });
      }
    }

    return results;
  }

  async ensureStockAvailability(items: StockCheckItem[]): Promise<void> {
    const stockResults = await this.checkStock(items);

    const insufficient = stockResults.filter(
      (r) => r.status === 'OUT_OF_STOCK' || r.status === 'INSUFFICIENT_STOCK'
    );

    if (insufficient.length > 0) {
      const details = insufficient
        .map(
          (r) =>
            `Product undefinedundefined)` : ''}: requested undefined, available undefined`
        )
        .join('; ');

      throw new BadRequestError(`Insufficient stock for one or more items: undefined`);
    }
  }

  async decrementStock(items: StockCheckItem[], tx?: Prisma.TransactionClient): Promise<void> {
    const client: Prisma.TransactionClient = tx ?? prisma;

    await this.ensureStockAvailability(items);

    const groupedByProduct = new Map<string, StockCheckItem[]>();
    for (const item of items) {
      const group = groupedByProduct.get(item.productId) ?? [];
      group.push(item);
      groupedByProduct.set(item.productId, group);
    }

    const operations: Promise<unknown>[] = [];

    for (const [productId, productItems] of groupedByProduct.entries()) {
      const totalQuantityForProduct = productItems.reduce(
        (sum, item) => sum + (item.variantId ? 0 : item.quantity),
        0
      );

      if (totalQuantityForProduct > 0) {
        operations.push(
          client.product.update({
            where: { id: productId },
            data: {
              stock: {
                decrement: totalQuantityForProduct,
              },
            },
          })
        );
      }

      const variantItems = productItems.filter((i) => i.variantId);
      for (const item of variantItems) {
        if (!item.variantId) continue;

        operations.push(
          client.productVariant.update({
            where: { id: item.variantId },
            data: {
              stock: {
                decrement: item.quantity