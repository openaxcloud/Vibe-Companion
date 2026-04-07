import { Prisma } from '@prisma/client';

export type SortDirection = 'asc' | 'desc';

export interface PaginationParams {
  page?: number | string | null;
  pageSize?: number | string | null;
  sort?: string | null;
}

export interface ParsedSortField {
  field: string;
  direction: SortDirection;
}

export interface PaginationOptions {
  maxPageSize?: number;
  defaultPageSize?: number;
  defaultPage?: number;
  allowedSortFields?: string[];
  defaultSort?: string;
}

export interface PaginationQuery {
  skip: number;
  take: number;
  orderBy: Prisma.Enumerable<Prisma.SortOrderInput> | Prisma.Enumerable<Record<string, SortDirection>>;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginationResult<T> {
  data: T[];
  meta: PaginationMeta;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

const SORT_SEPARATOR = ',';
const SORT_DESC_PREFIX = '-';
const SORT_ASC_PREFIX = '+';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const toIntegerOrDefault = (value: unknown, defaultValue: number): number => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : defaultValue;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return defaultValue;
};

const clamp = (value: number, min: number, max: number): number => {
  if (!isFiniteNumber(value)) return min;
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export const parseSortString = (
  sort: string | null | undefined,
  allowedFields?: string[],
  defaultSort?: string
): ParsedSortField[] => {
  const source = sort && sort.trim().length > 0 ? sort : defaultSort;
  if (!source) return [];

  const parts = source.split(SORT_SEPARATOR).map(p => p.trim()).filter(Boolean);
  const result: ParsedSortField[] = [];

  for (const part of parts) {
    if (!part) continue;

    let direction: SortDirection = 'asc';
    let field = part;

    if (field.startsWith(SORT_DESC_PREFIX)) {
      direction = 'desc';
      field = field.slice(1);
    } else if (field.startsWith(SORT_ASC_PREFIX)) {
      direction = 'asc';
      field = field.slice(1);
    }

    field = field.trim();
    if (!field) continue;

    if (allowedFields && allowedFields.length > 0 && !allowedFields.includes(field)) {
      continue;
    }

    result.push({ field, direction });
  }

  return result;
};

export const buildOrderBy = (
  sort: string | null | undefined,
  allowedFields?: string[],
  defaultSort?: string
): Prisma.Enumerable<Record<string, SortDirection>> => {
  const parsed = parseSortString(sort, allowedFields, defaultSort);
  if (!parsed.length) {
    return [];
  }
  return parsed.map(({ field, direction }) => ({ [field]: direction }));
};

export const buildPaginationQuery = (
  params: PaginationParams,
  options: PaginationOptions = {}
): PaginationQuery => {
  const {
    maxPageSize = MAX_PAGE_SIZE,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    defaultPage = DEFAULT_PAGE,
    allowedSortFields,
    defaultSort,
  } = options;

  const rawPage = toIntegerOrDefault(params.page, defaultPage);
  const rawPageSize = toIntegerOrDefault(params.pageSize, defaultPageSize);

  const pageSize = clamp(rawPageSize, 1, maxPageSize);
  const page = rawPage < 1 ? 1 : rawPage;

  const skip = (page - 1) * pageSize;
  const take = pageSize;

  const orderBy = buildOrderBy(params.sort ?? undefined, allowedSortFields, defaultSort);

  return { skip, take, orderBy };
};

export const buildPaginationMeta = (
  totalItems: number,
  page: number,
  pageSize: number
): PaginationMeta => {
  const safeTotal = Number.isFinite(totalItems) && totalItems >= 0 ? Math.floor(totalItems) : 0;
  const safePageSize = clamp(pageSize, 1, MAX_PAGE_SIZE);
  const totalPages = safeTotal === 0 ? 0 : Math.max(1, Math.ceil(safeTotal / safePageSize));
  const safePage = clamp(page, 1, Math.max(totalPages, 1));

  return {
    page: safePage,
    pageSize: safePageSize,
    totalItems: safeTotal,
    totalPages,
    hasNextPage: safePage < totalPages,
    hasPrevPage: safePage > 1 && totalPages > 0,
  };
};

export const paginatePrisma = async <T>(
  modelDelegate: {
    findMany: (args: { skip: number; take: number; orderBy?: Prisma.Enumerable<Record<string, SortDirection>> }) => Promise<T[]>;
    count: (args?: unknown) => Promise<number>;
  },
  params: PaginationParams,
  options: PaginationOptions = {},
  additionalQuery: Omit<
    Parameters<typeof modelDelegate.findMany>[0],
    'skip' | 'take' | 'orderBy'
  > = {}
): Promise<PaginationResult<T>> => {
  const { skip, take, orderBy } = buildPaginationQuery(params, options);

  const [data, totalItems] = await Promise.all([
    modelDelegate.findMany({
      ...(additionalQuery as object),
      skip,
      take,
      orderBy: orderBy.length ? orderBy : undefined,
    }),
    modelDelegate.count(additionalQuery as never),
  ]);

  const page = toIntegerOrDefault(params.page, options.defaultPage ?? DEFAULT_PAGE);
  const pageSize = clamp(
    toIntegerOrDefault(params.pageSize, options.defaultPageSize ?? DEFAULT_PAGE_SIZE),
    1,
    options.maxPageSize ?? MAX_PAGE_SIZE
  );

  const meta = buildPaginationMeta(totalItems, page, pageSize);

  return { data, meta };
};