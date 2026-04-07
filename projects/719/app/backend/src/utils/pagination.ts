import type { ParsedUrlQuery } from 'querystring';

export type SortOrder = 'asc' | 'desc';

export interface PaginationParams {
  limit: number;
  offset: number;
  sort?: string;
  order: SortOrder;
}

export interface PaginationConfig {
  /**
   * Default page size when not provided or invalid.
   * @default 20
   */
  defaultLimit?: number;
  /**
   * Maximum page size allowed.
   * @default 100
   */
  maxLimit?: number;
  /**
   * Default sort field when not provided.
   */
  defaultSort?: string;
  /**
   * Default sort order when not provided or invalid.
   * @default 'asc'
   */
  defaultOrder?: SortOrder;
  /**
   * Optional whitelist of allowed sort fields.
   * If provided, any sort not in this list will be ignored
   * and defaultSort (if provided) will be used instead.
   */
  allowedSortFields?: string[];
  /**
   * Optional mapping from external sort keys to internal field names.
   * e.g. { created: 'created_at' }
   */
  sortFieldMap?: Record<string, string>;
}

export interface RawPaginationQuery {
  limit?: string | string[] | null;
  offset?: string | string[] | null;
  page?: string | string[] | null;
  sort?: string | string[] | null;
  order?: string | string[] | null;
}

/**
 * Safely normalizes a query value to a single string.
 */
const normalizeQueryValue = (
  value: string | string[] | number | number[] | null | undefined
): string | undefined => {
  if (value === null || typeof value === 'undefined') return undefined;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === 'number' ? String(first) : first;
  }
  return typeof value === 'number' ? String(value) : value;
};

/**
 * Parses an integer from query params with fallback.
 */
const parsePositiveInt = (
  value: string | undefined,
  fallback: number
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 0) return fallback;
  return parsed;
};

/**
 * Normalizes sort order string.
 */
const normalizeOrder = (order: string | undefined, fallback: SortOrder): SortOrder => {
  if (!order) return fallback;
  const lowered = order.toLowerCase();
  if (lowered === 'asc' || lowered === 'ascending') return 'asc';
  if (lowered === 'desc' || lowered === 'descending') return 'desc';
  return fallback;
};

/**
 * Applies field whitelist and mapping to sort field.
 */
const normalizeSortField = (
  rawSort: string | undefined,
  config: PaginationConfig
): string | undefined => {
  const { allowedSortFields, sortFieldMap, defaultSort } = config;

  if (!rawSort) return defaultSort;

  const mapped = sortFieldMap?.[rawSort] ?? rawSort;

  if (allowedSortFields && allowedSortFields.length > 0) {
    if (!allowedSortFields.includes(mapped)) {
      return defaultSort;
    }
  }

  return mapped;
};

export const DEFAULT_PAGINATION_CONFIG: Required<
  Pick<PaginationConfig, 'defaultLimit' | 'maxLimit' | 'defaultOrder'>
> = {
  defaultLimit: 20,
  maxLimit: 100,
  defaultOrder: 'asc',
};

/**
 * Parses pagination and sorting parameters from query objects.
 *
 * Supported params:
 * - limit: number (page size)
 * - offset: number (starting index)
 * - page: number (1-based page index, used to calculate offset if offset not provided)
 * - sort: string (field name)
 * - order: 'asc' | 'desc' (case-insensitive, also supports 'ascending'/'descending')
 */
export function parsePaginationQuery(
  query: ParsedUrlQuery | URLSearchParams | RawPaginationQuery,
  config: PaginationConfig = {}
): PaginationParams {
  const mergedConfig: PaginationConfig = {
    defaultLimit: config.defaultLimit ?? DEFAULT_PAGINATION_CONFIG.defaultLimit,
    maxLimit: config.maxLimit ?? DEFAULT_PAGINATION_CONFIG.maxLimit,
    defaultOrder: config.defaultOrder ?? DEFAULT_PAGINATION_CONFIG.defaultOrder,
    defaultSort: config.defaultSort,
    allowedSortFields: config.allowedSortFields,
    sortFieldMap: config.sortFieldMap,
  };

  const get = (key: keyof RawPaginationQuery): string | undefined => {
    if (query instanceof URLSearchParams) {
      return query.get(key as string) ?? undefined;
    }
    const value = (query as ParsedUrlQuery)[key as string] ?? (query as RawPaginationQuery)[key];
    return normalizeQueryValue(value as string | string[] | undefined | null);
  };

  const rawLimit = get('limit');
  const rawOffset = get('offset');
  const rawPage = get('page');
  const rawSort = get('sort');
  const rawOrder = get('order');

  let limit = parsePositiveInt(rawLimit, mergedConfig.defaultLimit!);
  if (limit > mergedConfig.maxLimit!) {
    limit = mergedConfig.maxLimit!;
  }

  let offset: number;
  if (rawOffset !== undefined) {
    offset = parsePositiveInt(rawOffset, 0);
  } else if (rawPage !== undefined) {
    const page = parsePositiveInt(rawPage, 1);
    offset = page > 0 ? (page - 1) * limit : 0;
  } else {
    offset = 0;
  }

  const sort = normalizeSortField(rawSort, mergedConfig);
  const order = normalizeOrder(rawOrder, mergedConfig.defaultOrder!);

  return {
    limit,
    offset,
    sort: sort || undefined,
    order,
  };
}

/**
 * Helper to calculate pagination metadata for responses.
 */
export interface PaginationMetaInput {
  totalItems: number;
  limit: number;
  offset: number;
}

export interface PaginationMeta {
  totalItems: number;
  limit: number;
  offset: number;
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export function buildPaginationMeta(
  input: PaginationMetaInput
): PaginationMeta {
  const { totalItems, limit, offset } = input;

  const safeLimit = limit > 0 ? limit : DEFAULT_PAGINATION_CONFIG.defaultLimit;
  const safeOffset = offset >= 0 ? offset : 0;

  const page = Math.floor(safeOffset / safeLimit) + 1;
  const totalPages =
    totalItems <= 0 ? 0 : Math.max(1, Math.ceil(totalItems / safeLimit));

  const hasNextPage = safeOffset + safeLimit < totalItems;
  const hasPrevPage = safeOffset > 0;

  return {
    totalItems,
    limit: safeLimit,
    offset: safeOffset,
    page,
    totalPages,
    hasNextPage,
    hasPrevPage,
  };
}