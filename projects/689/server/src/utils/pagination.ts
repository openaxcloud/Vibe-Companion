import { ParsedUrlQuery } from 'querystring';

export type SortDirection = 'asc' | 'desc';

export interface SortField {
  field: string;
  direction: SortDirection;
}

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'
  | 'startsWith'
  | 'endsWith'
  | 'in'
  | 'notIn'
  | 'is'
  | 'isNot';

export interface FilterCondition {
  field: string;
  op: FilterOperator;
  value: unknown;
}

export interface PaginationParams {
  page?: number | string | null;
  pageSize?: number | string | null;
  cursor?: string | null;
  sort?: string | string[] | null;
  filter?: string | string[] | null;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
  cursor?: Record<string, unknown>;
  orderBy: Array<Record<string, SortDirection>>;
  filters: FilterCondition[];
}

export interface PaginationConfig {
  defaultPageSize?: number;
  maxPageSize?: number;
  maxSortFields?: number;
  allowCursorPagination?: boolean;
  cursorField?: string;
}

export const DEFAULT_PAGINATION_CONFIG: Required<PaginationConfig> = {
  defaultPageSize: 20,
  maxPageSize: 100,
  maxSortFields: 5,
  allowCursorPagination: true,
  cursorField: 'id',
};

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (!Number.isNaN(n) && Number.isFinite(n)) return n;
  }
  return undefined;
}

function parsePage(rawPage: unknown): number | undefined {
  const n = toNumber(rawPage);
  if (n === undefined) return undefined;
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

function parsePageSize(
  rawPageSize: unknown,
  defaultPageSize: number,
  maxPageSize: number,
): number {
  const n = toNumber(rawPageSize);
  if (n === undefined || !Number.isInteger(n) || n < 1) {
    return defaultPageSize;
  }
  return Math.min(n, maxPageSize);
}

function parseCursor(
  rawCursor: unknown,
  cursorField: string,
): Record<string, unknown> | undefined {
  if (rawCursor === null || rawCursor === undefined) return undefined;
  if (typeof rawCursor === 'string' && rawCursor.trim() === '') return undefined;

  let cursorValue: unknown;
  if (typeof rawCursor === 'string') {
    try {
      cursorValue = JSON.parse(rawCursor);
    } catch {
      cursorValue = rawCursor;
    }
  } else {
    cursorValue = rawCursor;
  }

  if (cursorValue && typeof cursorValue === 'object' && !Array.isArray(cursorValue)) {
    return cursorValue as Record<string, unknown>;
  }

  return { [cursorField]: cursorValue };
}

function parseSortEntry(entry: string): SortField | null {
  const trimmed = entry.trim();
  if (!trimmed) return null;

  let direction: SortDirection = 'asc';
  let field = trimmed;

  if (trimmed.startsWith('-')) {
    direction = 'desc';
    field = trimmed.slice(1).trim();
  } else if (trimmed.startsWith('+')) {
    direction = 'asc';
    field = trimmed.slice(1).trim();
  }

  if (!field) return null;

  return { field, direction };
}

function parseSort(
  rawSort: unknown,
  maxSortFields: number,
  cursorField: string,
): Array<Record<string, SortDirection>> {
  const entries: string[] = [];

  if (Array.isArray(rawSort)) {
    for (const v of rawSort) {
      if (typeof v === 'string') entries.push(v);
    }
  } else if (typeof rawSort === 'string') {
    const parts = rawSort.split(',').map((s) => s.trim()).filter(Boolean);
    entries.push(...parts);
  }

  const sortFields: SortField[] = [];
  for (const entry of entries) {
    const parsed = parseSortEntry(entry);
    if (parsed) sortFields.push(parsed);
    if (sortFields.length >= maxSortFields) break;
  }

  // Ensure deterministic ordering by cursorField if not explicitly sorted
  if (!sortFields.some((s) => s.field === cursorField)) {
    sortFields.push({ field: cursorField, direction: 'asc' });
  }

  if (!sortFields.length) {
    return [{ [cursorField]: 'asc' }];
  }

  return sortFields.map((s) => ({ [s.field]: s.direction }));
}

function decodeFilterValue(value: string): unknown {
  // Attempt to JSON-parse complex values, fall back to string
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseFilterExpression(expr: string): FilterCondition | null {
  const trimmed = expr.trim();
  if (!trimmed) return null;

  const match = trimmed.match(/^(?<field>[^:]+):(?<op>[^:]+):(?<value>.+)$/);
  if (!match || !match.groups) return null;

  const field = match.groups.field.trim();
  const op = match.groups.op.trim() as FilterOperator;
  const rawValue = match.groups.value.trim();

  if (!field || !op || rawValue === '') return null;

  const supportedOps: FilterOperator[] = [
    'eq',
    'neq',
    'gt',
    'gte',
    'lt',
    'lte',
    'contains',
    'startsWith',
    'endsWith',
    'in',
    'notIn',
    'is',
    'isNot',
  ];

  if (!supportedOps.includes(op)) return null;

  let value: unknown = decodeFilterValue(rawValue);

  if ((op === 'in' || op === 'notIn') && !Array.isArray(value)) {
    value = String(rawValue)
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .map((v) => decodeFilterValue(v));
  }

  return { field, op, value };
}

function parseFilters(rawFilter: unknown): FilterCondition[] {
  const expressions: string[] = [];

  if (Array.isArray(rawFilter)) {
    for (const v of rawFilter) {
      if (typeof v === 'string') expressions.push(v);
    }
  } else if (typeof rawFilter === 'string') {
    const parts = rawFilter.split(';').map((s) => s.trim()).filter(Boolean);
    expressions.push(...parts);
  }

  const conditions: FilterCondition[] = [];
  for (const expr of expressions) {
    const parsed = parseFilterExpression(expr);
    if (parsed) conditions.push(parsed);
  }

  return conditions;
}

export function parsePaginationParams(
  query: ParsedUrlQuery | PaginationParams,
  config?: PaginationConfig,
): PaginationOptions {
  const {
    defaultPageSize,
    maxPageSize,
    maxSortFields,
    allowCursorPagination,
    cursorField,
  } = { ...DEFAULT_PAGINATION_CONFIG, ...config };

  const rawPage = 'page' in query ? query.page : undefined;
  const rawPageSize = 'pageSize' in query ? query.pageSize : undefined;
  const rawCursor = 'cursor' in query ? query.cursor : undefined;
  const rawSort = 'sort' in query ? query.sort : undefined;
  const rawFilter = 'filter' in query ? query.filter : undefined;

  const pageSize = parsePageSize(rawPageSize ?? undefined, defaultPageSize, maxPageSize);
  const cursor =
    allowCursorPagination && rawCursor !== undefined
      ? parseCursor(rawCursor ?? undefined, cursorField)
      : undefined;

  let page = parsePage(rawPage ?? undefined) ?? 1;
  let skip = (page - 1) * pageSize;
  let take = pageSize;

  if (cursor) {
    // In cursor mode, ignore page and use take only
    page = 1;
    skip = 0;
  }

  const orderBy = parseSort(rawSort ?? undefined, maxSortFields, cursorField);
  const filters = parseFilters(rawFilter ?? undefined);

  return {
    page,
    pageSize,
    skip,
    take,
    cursor,
    orderBy,
    filters,
  };
}

export function buildPrismaWhere(filters: FilterCondition[]): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  for (const { field, op, value } of filters) {
    const existing = where[field] as Record<string, unknown> | undefined;
    const target = existing ?? {};

    switch (op) {
      case 'eq':
        target.equals = value;
        break;
      case 'neq':
        target.not = value;
        break;
      case 'gt