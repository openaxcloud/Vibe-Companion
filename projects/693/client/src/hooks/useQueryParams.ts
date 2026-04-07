import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type QueryParamValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryParamValue | QueryParamValue[]>;

type ParsedQueryParams = Record<string, string | string[]>;

interface UseQueryParamsOptions {
  /**
   * Replace the current history entry instead of pushing a new one.
   * Defaults to false (push).
   */
  replace?: boolean;
  /**
   * When true, parameters with empty values are removed from the URL.
   * Defaults to true.
   */
  removeEmpty?: boolean;
}

type SetQueryParamsInput =
  | QueryParams
  | ((current: ParsedQueryParams) => QueryParams);

interface UseQueryParamsResult {
  /**
   * Parsed query params as strings or array of strings.
   * Numbers/booleans are not auto-coerced to avoid ambiguity.
   */
  queryParams: ParsedQueryParams;
  /**
   * Get a single param by key. Returns string | string[] | undefined.
   */
  getParam: (key: string) => string | string[] | undefined;
  /**
   * Set or update query params. Accepts an object or an updater function.
   */
  setQueryParams: (next: SetQueryParamsInput, options?: UseQueryParamsOptions) => void;
  /**
   * Remove one or multiple query params.
   */
  removeQueryParams: (keys: string | string[], options?: UseQueryParamsOptions) => void;
  /**
   * Clear all query params.
   */
  clearQueryParams: (options?: UseQueryParamsOptions) => void;
}

/**
 * Convert various supported value types into string/string[] for URLSearchParams.
 */
const normalizeToStringValues = (
  value: QueryParamValue | QueryParamValue[]
): string | string[] | undefined => {
  if (Array.isArray(value)) {
    const normalizedArray = value
      .map((v) => (v === null || v === undefined ? "" : String(v)))
      .filter((v) => v !== "");
    return normalizedArray.length ? normalizedArray : undefined;
  }

  if (value === null || value === undefined) return undefined;

  const str = String(value);
  return str === "" ? undefined : str;
};

/**
 * Convert URLSearchParams to a simple object representation.
 * Keys with multiple values are stored as string[].
 */
const searchParamsToObject = (searchParams: URLSearchParams): ParsedQueryParams => {
  const result: ParsedQueryParams = {};

  searchParams.forEach((value, key) => {
    if (Object.prototype.hasOwnProperty.call(result, key)) {
      const existing = result[key];
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        result[key] = [existing, value];
      }
    } else {
      result[key] = value;
    }
  });

  return result;
};

/**
 * Build a search string from a query params object.
 * Skips undefined or null values. Optionally removes empty-string values.
 */
const buildSearchString = (
  params: QueryParams,
  options?: UseQueryParamsOptions
): string => {
  const removeEmpty = options?.removeEmpty ?? true;
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, rawValue]) => {
    const normalized = normalizeToStringValues(rawValue);
    if (normalized === undefined) return;

    if (Array.isArray(normalized)) {
      normalized.forEach((v) => {
        if (!removeEmpty || v !== "") {
          searchParams.append(key, v);
        }
      });
    } else {
      if (!removeEmpty || normalized !== "") {
        searchParams.set(key, normalized);
      }
    }
  });

  const search = searchParams.toString();
  return search ? `?undefined` : "";
};

/**
 * Merge current query params object with updates.
 * Removing keys when next value is undefined.
 */
const mergeQueryParams = (
  current: ParsedQueryParams,
  next: QueryParams
): ParsedQueryParams => {
  const merged: ParsedQueryParams = { ...current };

  Object.entries(next).forEach(([key, value]) => {
    const normalized = normalizeToStringValues(value);
    if (normalized === undefined) {
      delete merged[key];
    } else {
      merged[key] = normalized;
    }
  });

  return merged;
};

export const useQueryParams = (): UseQueryParamsResult => {
  const location = useLocation();
  const navigate = useNavigate();

  const queryParams: ParsedQueryParams = useMemo(() => {
    const searchParams = new URLSearchParams(location.search);
    return searchParamsToObject(searchParams);
  }, [location.search]);

  const getParam = useCallback(
    (key: string): string | string[] | undefined => {
      return queryParams[key];
    },
    [queryParams]
  );

  const setQueryParams = useCallback(
    (next: SetQueryParamsInput, options?: UseQueryParamsOptions) => {
      const currentObject = queryParams;
      const nextObject =
        typeof next === "function" ? mergeQueryParams(currentObject, next(currentObject)) : mergeQueryParams(currentObject, next);

      const search = buildSearchString(nextObject, options);
      const replace = options?.replace ?? false;

      navigate(
        {
          pathname: location.pathname,
          search,
          hash: location.hash
        },
        { replace }
      );
    },
    [location.hash, location.pathname, navigate, queryParams]
  );

  const removeQueryParams = useCallback(
    (keys: string | string[], options?: UseQueryParamsOptions) => {
      const keysArray = Array.isArray(keys) ? keys : [keys];
      const nextObject: QueryParams = {};

      Object.keys(queryParams).forEach((key) => {
        if (!keysArray.includes(key)) {
          nextObject[key] = queryParams[key];
        }
      });

      const search = buildSearchString(nextObject, options);
      const replace = options?.replace ?? false;

      navigate(
        {
          pathname: location.pathname,
          search,
          hash: location.hash
        },
        { replace }
      );
    },
    [location.hash, location.pathname, navigate, queryParams]
  );

  const clearQueryParams = useCallback(
    (options?: UseQueryParamsOptions) => {
      const replace = options?.replace ?? false;

      navigate(
        {
          pathname: location.pathname,
          search: "",
          hash: location.hash
        },
        { replace }
      );
    },
    [location.hash, location.pathname, navigate]
  );

  return {
    queryParams,
    getParam,
    setQueryParams,
    removeQueryParams,
    clearQueryParams
  };
};

export default useQueryParams;