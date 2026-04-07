import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type SearchBarProps = {
  /**
   * Optional placeholder text for the search input
   */
  placeholder?: string;
  /**
   * Optional CSS class for the root container
   */
  className?: string;
  /**
   * Optional CSS class for the input element
   */
  inputClassName?: string;
  /**
   * Initial search value; used when not derived from URL
   */
  initialValue?: string;
  /**
   * Optional minimum characters before triggering a search update
   */
  minLength?: number;
  /**
   * Debounce delay in milliseconds
   */
  debounceMs?: number;
};

/**
 * Example global search state hook.
 * Replace this with your actual global state implementation (e.g. Redux, Zustand, Jotai, Context, etc.).
 */
type GlobalSearchState = {
  query: string;
  setQuery: (value: string) => void;
};

// Stub for a global search hook; adjust to your actual implementation.
const useGlobalSearch = (): GlobalSearchState => {
  const [query, setLocalQuery] = useState<string>("");

  const setQuery = useCallback((value: string) => {
    setLocalQuery(value);
  }, []);

  return { query, setQuery };
};

const useQueryParams = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const setQueryParam = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(location.search);

      if (value === null || value.trim() === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      const newSearch = params.toString();
      const newPath = `undefinedundefined` : ""}`;

      if (newPath !== `undefinedundefined`) {
        navigate(newPath, { replace: true });
      }
    },
    [location.pathname, location.search, navigate]
  );

  const getQueryParam = useCallback(
    (key: string): string | null => {
      const value = searchParams.get(key);
      return value !== null ? value : null;
    },
    [searchParams]
  );

  return { getQueryParam, setQueryParam };
};

const DEFAULT_DEBOUNCE_MS = 300;
const SEARCH_QUERY_KEY = "q";

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = "Search products",
  className,
  inputClassName,
  initialValue = "",
  minLength = 0,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) => {
  const { query: globalQuery, setQuery: setGlobalQuery } = useGlobalSearch();
  const { getQueryParam, setQueryParam } = useQueryParams();

  const urlQuery = getQueryParam(SEARCH_QUERY_KEY);
  const initial = useMemo(() => {
    if (urlQuery !== null) return urlQuery;
    if (globalQuery) return globalQuery;
    return initialValue;
  }, [urlQuery, globalQuery, initialValue]);

  const [localValue, setLocalValue] = useState<string>(initial);

  useEffect(() => {
    setLocalValue(initial);
  }, [initial]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const valueToApply =
        minLength > 0 && localValue.trim().length < minLength
          ? ""
          : localValue.trim();

      if (valueToApply !== globalQuery) {
        setGlobalQuery(valueToApply);
      }

      const currentUrlValue = urlQuery ?? "";
      if (valueToApply !== currentUrlValue) {
        setQueryParam(SEARCH_QUERY_KEY, valueToApply || null);
      }
    }, debounceMs);

    return () => {
      clearTimeout(handler);
    };
  }, [
    localValue,
    debounceMs,
    setGlobalQuery,
    setQueryParam,
    globalQuery,
    urlQuery,
    minLength,
  ]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLocalValue(event.target.value);
    },
    []
  );

  const handleClear = useCallback(() => {
    setLocalValue("");
  }, []);

  const showClear = localValue.length > 0;

  return (
    <div className={className ?? "search-bar"}>
      <div className="search-bar__input-wrapper">
        <input
          type="search"
          aria-label="Search catalog"
          value={localValue}
          onChange={handleChange}
          placeholder={placeholder}
          className={inputClassName ?? "search-bar__input"}
          autoComplete="off"
        />
        {showClear && (
          <button
            type="button"
            aria-label="Clear search"
            className="search-bar__clear-button"
            onClick={handleClear}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default SearchBar;