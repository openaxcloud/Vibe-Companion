import { ParsedQs } from 'qs';

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationQuery {
  page?: string | string[];
  limit?: string | string[];
  [key: string]: unknown;
}

export interface PrismaPagination {
  skip: number;
  take: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseNumber = (value: unknown): number | null => {
  if (value === undefined || value === null) return null;

  let str: string;
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    str = String(value[0]);
  } else {
    str = String(value);
  }

  const num = Number(str);
  if (!Number.isFinite(num)) return null;
  if (!Number.isInteger(num)) return null;
  return num;
};

export const parsePaginationParams = (
  query: PaginationQuery | ParsedQs,
  options?: PaginationOptions
): PaginationParams => {
  const defaultPage = options?.defaultPage ?? DEFAULT_PAGE;
  const defaultLimit = options?.defaultLimit ?? DEFAULT_LIMIT;
  const maxLimit = options?.maxLimit ?? MAX_LIMIT;

  const rawPage = 'page' in query ? (query as PaginationQuery).page : undefined;
  const rawLimit = 'limit' in query ? (query as PaginationQuery).limit : undefined;

  let page = parseNumber(rawPage) ?? defaultPage;
  let limit = parseNumber(rawLimit) ?? defaultLimit;

  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > maxLimit) limit = maxLimit;

  return { page, limit };
};

export const getPrismaPagination = (
  params: PaginationParams
): PrismaPagination => {
  const page = params.page < 1 ? 1 : params.page;
  const limit = params.limit < 1 ? 1 : params.limit;

  const skip = (page - 1) * limit;
  const take = limit;

  return { skip, take };
};

export const buildPaginationMeta = (
  totalItems: number,
  params: PaginationParams
): PaginationMeta => {
  const sanitizedTotal = totalItems < 0 || !Number.isFinite(totalItems) ? 0 : Math.floor(totalItems);
  const page = params.page < 1 ? 1 : params.page;
  const limit = params.limit < 1 ? 1 : params.limit;

  const totalPages = sanitizedTotal === 0 ? 0 : Math.max(1, Math.ceil(sanitizedTotal / limit));
  const currentPage = totalPages === 0 ? 1 : Math.min(page, totalPages);

  return {
    page: currentPage,
    limit,
    totalItems: sanitizedTotal,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1 && totalPages > 0,
  };
};

export const paginateArray = <T>(
  items: T[],
  params: PaginationParams
): PaginatedResult<T> => {
  const meta = buildPaginationMeta(items.length, params);

  if (items.length === 0) {
    return {
      data: [],
      meta,
    };
  }

  const start = (meta.page - 1) * meta.limit;
  const end = start + meta.limit;

  return {
    data: items.slice(start, end),
    meta,
  };
};