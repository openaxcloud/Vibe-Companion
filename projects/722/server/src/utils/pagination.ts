import type { ParsedQs } from 'qs';

export type SortDirection = 'asc' | 'desc';

export interface PaginationQueryInput {
  page?: number | string | null;
  limit?: number | string | null;
  sortBy?: string | null;
  sortOrder?: SortDirection | string | null;
}

export interface SanitizedPaginationParams {
  page: number;
  limit: number;
  offset: number;
  sortBy: string | null;
  sortOrder: SortDirection;
}

export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResultMeta<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface PaginationOptions {
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
  allowedSortFields?: string[];
  defaultSortBy?: string | null;
  defaultSortOrder?: SortDirection;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const DEFAULT_SORT_ORDER: SortDirection = 'asc';

const isNumericLike = (value: unknown): value is string | number =>
  (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) ||
  typeof value === 'number';

const toPositiveInteger = (value: unknown, fallback: number): number => {
  if (!isNumericLike(value)) {
    return fallback;
  }
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallback;
  }
  const intVal = Math.floor(num);
  if (intVal <= 0) {
    return fallback;
  }
  return intVal;
};

const normalizeSortOrder = (value: unknown, fallback: SortDirection = DEFAULT_SORT_ORDER): SortDirection => {
  if (typeof value !== 'string') return fallback;
  const lower = value.toLowerCase();
  if (lower === 'asc' || lower === 'ascending' || lower === '1' || lower === '+1') return 'asc';
  if (lower === 'desc' || lower === 'descending' || lower === '-1') return 'desc';
  return fallback;
};

const sanitizeSortBy = (sortBy: string | null | undefined, allowedFields?: string[] | null): string | null => {
  if (!sortBy || typeof sortBy !== 'string') return null;
  const trimmed = sortBy.trim();
  if (!trimmed) return null;
  if (!allowedFields || allowedFields.length === 0) return trimmed;
  return allowedFields.includes(trimmed) ? trimmed : null;
};

export const sanitizePaginationParams = (
  raw: PaginationQueryInput | ParsedQs | undefined,
  options: PaginationOptions = {}
): SanitizedPaginationParams => {
  const {
    defaultPage = DEFAULT_PAGE,
    defaultLimit = DEFAULT_LIMIT,
    maxLimit = MAX_LIMIT,
    allowedSortFields,
    defaultSortBy = null,
    defaultSortOrder = DEFAULT_SORT_ORDER,
  } = options;

  const page = toPositiveInteger(raw?.page, defaultPage);
  const limit = Math.min(toPositiveInteger(raw?.limit, defaultLimit), maxLimit);

  const sortByFromInput = typeof raw?.sortBy === 'string' ? raw.sortBy : null;
  const sortBy = sanitizeSortBy(sortByFromInput ?? defaultSortBy, allowedSortFields);

  const sortOrder =
    normalizeSortOrder(raw?.sortOrder, defaultSortOrder) ||
    defaultSortOrder;

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
    sortBy,
    sortOrder,
  };
};

export const buildPaginationMeta = (
  totalItems: number,
  page: number,
  limit: number
): PaginationMeta => {
  const safeTotal = Number.isFinite(totalItems) && totalItems >= 0 ? Math.floor(totalItems) : 0;
  const safeLimit = limit > 0 ? limit : DEFAULT_LIMIT;
  const safePage = page > 0 ? page : DEFAULT_PAGE;

  const totalPages = safeTotal === 0 ? 0 : Math.ceil(safeTotal / safeLimit);
  const currentPage = totalPages === 0 ? 0 : Math.min(safePage, totalPages);

  const startIndex = (currentPage - 1) * safeLimit;
  const remaining = safeTotal - startIndex;
  const itemCount = currentPage === 0 ? 0 : Math.max(0, Math.min(safeLimit, remaining));

  return {
    totalItems: safeTotal,
    itemCount,
    itemsPerPage: safeLimit,
    totalPages,
    currentPage,
    hasNextPage: currentPage < totalPages,
    hasPrevPage: currentPage > 1 && totalPages > 0,
  };
};

export const paginateArray = <T>(
  data: T[],
  rawQuery: PaginationQueryInput | ParsedQs | undefined,
  options: PaginationOptions = {}
): PaginatedResultMeta<T> => {
  const params = sanitizePaginationParams(rawQuery, options);
  const { page, limit } = params;

  const safeData = Array.isArray(data) ? data : [];
  const totalItems = safeData.length;
  const meta = buildPaginationMeta(totalItems, page, limit);

  if (meta.currentPage === 0) {
    return { data: [], meta };
  }

  const start = (meta.currentPage - 1) * meta.itemsPerPage;
  const end = start + meta.itemsPerPage;
  const pageItems = safeData.slice(start, end);

  return {
    data: pageItems,
    meta,
  };
};

export const buildSortObject = (
  sortBy: string | null,
  sortOrder: SortDirection
): Record<string, 1 | -1> | undefined => {
  if (!sortBy) return undefined;
  return {
    [sortBy]: sortOrder === 'asc' ? 1 : -1,
  };
};

export const parseAndSanitizePagination = (
  raw: PaginationQueryInput | ParsedQs | undefined,
  options: PaginationOptions = {}
): {
  params: SanitizedPaginationParams;
  metaFromTotal: (totalItems: number) => PaginationMeta;
  sort: Record<string, 1 | -1> | undefined;
} => {
  const params = sanitizePaginationParams(raw, options);
  const metaFromTotal = (totalItems: number) => buildPaginationMeta(totalItems, params.page, params.limit);
  const sort = buildSortObject(params.sortBy, params.sortOrder);
  return { params, metaFromTotal, sort };
};