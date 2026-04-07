export interface PaginationParams {
  page?: unknown;
  pageSize?: unknown;
}

export interface PaginationOptions {
  defaultPage?: number;
  defaultPageSize?: number;
  maxPageSize?: number;
  minPageSize?: number;
}

export interface PaginationResult {
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
  totalItems?: number;
  totalPages?: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

export function parsePositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined) return null;

  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
      ? Number.parseInt(value, 10)
      : NaN;

  if (!Number.isFinite(num) || Number.isNaN(num)) return null;
  if (!Number.isInteger(num)) return null;
  if (num <= 0) return null;

  return num;
}

export function getPagination(
  params: PaginationParams = {},
  options: PaginationOptions = {}
): PaginationResult {
  const {
    defaultPage = DEFAULT_PAGE,
    defaultPageSize = DEFAULT_PAGE_SIZE,
    maxPageSize = MAX_PAGE_SIZE,
    minPageSize = MIN_PAGE_SIZE,
  } = options;

  const rawPage = parsePositiveInteger(params.page);
  const rawPageSize = parsePositiveInteger(params.pageSize);

  let page = rawPage ?? defaultPage;
  let pageSize = rawPageSize ?? defaultPageSize;

  if (page < 1) page = 1;

  if (pageSize < minPageSize) {
    pageSize = minPageSize;
  } else if (pageSize > maxPageSize) {
    pageSize = maxPageSize;
  }

  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    limit,
    offset,
  };
}

export function attachTotalToPagination(
  pagination: PaginationResult,
  totalItems: number
): PaginationResult {
  const safeTotalItems =
    Number.isFinite(totalItems) && totalItems >= 0
      ? Math.floor(totalItems)
      : 0;

  const totalPages =
    safeTotalItems === 0 ? 0 : Math.max(1, Math.ceil(safeTotalItems / pagination.pageSize));

  return {
    ...pagination,
    totalItems: safeTotalItems,
    totalPages,
  };
}

export function normalizePaginationParams(
  page: unknown,
  pageSize: unknown,
  options?: PaginationOptions
): PaginationResult {
  return getPagination({ page, pageSize }, options);
}