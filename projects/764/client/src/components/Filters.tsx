import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";

export type SortOptionValue = "relevance" | "price_asc" | "price_desc" | "newest";

export interface FiltersProps {
  /**
   * Available categories for filtering
   */
  categories: string[];
  /**
   * Optional label to show above category list
   */
  categoryLabel?: string;
  /**
   * Minimum allowed price for range
   */
  minPriceLimit?: number;
  /**
   * Maximum allowed price for range
   */
  maxPriceLimit?: number;
  /**
   * Sort options configuration
   */
  sortOptions?: { label: string; value: SortOptionValue }[];
  /**
   * Called whenever filter state changes (debounced for search/price)
   */
  onFiltersChange?: (filters: {
    category?: string;
    search?: string;
    minPrice?: number;
    maxPrice?: number;
    sort?: SortOptionValue;
  }) => void;
  /**
   * Whether to render as a sidebar (vertical) or topbar (horizontal)
   */
  layout?: "sidebar" | "topbar";
  /**
   * Optional className for root container
   */
  className?: string;
}

/**
 * Helper to safely parse numbers from URLSearchParams
 */
const parseNumberParam = (value: string | null | undefined): number | undefined => {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Debounce hook
 */
const useDebouncedValue = <T,>(value: T, delay: number): T => {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);

  return debounced;
};

const DEFAULT_SORT_OPTIONS: { label: string; value: SortOptionValue }[] = [
  { label: "Relevance", value: "relevance" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Newest", value: "newest" },
];

const Filters: React.FC<FiltersProps> = ({
  categories,
  categoryLabel = "Categories",
  minPriceLimit = 0,
  maxPriceLimit = 1000,
  sortOptions = DEFAULT_SORT_OPTIONS,
  onFiltersChange,
  layout = "sidebar",
  className = "",
}) => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const initialCategory = searchParams.get("category") || undefined;
  const initialSearch = searchParams.get("search") || "";
  const initialSort = (searchParams.get("sort") as SortOptionValue | null) || "relevance";
  const initialMinPrice = parseNumberParam(searchParams.get("minPrice")) ?? minPriceLimit;
  const initialMaxPrice = parseNumberParam(searchParams.get("maxPrice")) ?? maxPriceLimit;

  const [category, setCategory] = useState<string | undefined>(initialCategory);
  const [search, setSearch] = useState<string>(initialSearch);
  const [sort, setSort] = useState<SortOptionValue>(initialSort);
  const [minPrice, setMinPrice] = useState<number>(initialMinPrice);
  const [maxPrice, setMaxPrice] = useState<number>(initialMaxPrice);

  const debouncedSearch = useDebouncedValue(search, 300);
  const debouncedMinPrice = useDebouncedValue(minPrice, 300);
  const debouncedMaxPrice = useDebouncedValue(maxPrice, 300);

  const updateURLParams = useCallback(
    (next: {
      category?: string;
      search?: string;
      sort?: SortOptionValue;
      minPrice?: number;
      maxPrice?: number;
    }) => {
      const params = new URLSearchParams(location.search);

      const setOrDelete = (key: string, value: string | undefined) => {
        if (value === undefined || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      };

      setOrDelete("category", next.category);
      setOrDelete("search", next.search);
      setOrDelete("sort", next.sort);
      setOrDelete(
        "minPrice",
        typeof next.minPrice === "number" ? String(next.minPrice) : undefined
      );
      setOrDelete(
        "maxPrice",
        typeof next.maxPrice === "number" ? String(next.maxPrice) : undefined
      );

      navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
    },
    [location.pathname, location.search, navigate]
  );

  useEffect(() => {
    const filters = {
      category,
      search: debouncedSearch || undefined,
      sort,
      minPrice: debouncedMinPrice,
      maxPrice: debouncedMaxPrice,
    };

    if (onFiltersChange) {
      onFiltersChange(filters);
    }

    updateURLParams(filters);
  }, [
    category,
    debouncedSearch,
    sort,
    debouncedMinPrice,
    debouncedMaxPrice,
    onFiltersChange,
    updateURLParams,
  ]);

  // Sync internal state if URL changes from the outside (e.g., navigation)
  useEffect(() => {
    const sp = new URLSearchParams(location.search);

    const urlCategory = sp.get("category") || undefined;
    const urlSearch = sp.get("search") || "";
    const urlSort = (sp.get("sort") as SortOptionValue | null) || "relevance";
    const urlMinPrice = parseNumberParam(sp.get("minPrice")) ?? minPriceLimit;
    const urlMaxPrice = parseNumberParam(sp.get("maxPrice")) ?? maxPriceLimit;

    setCategory((prev) => (prev !== urlCategory ? urlCategory : prev));
    setSearch((prev) => (prev !== urlSearch ? urlSearch : prev));
    setSort((prev) => (prev !== urlSort ? urlSort : prev));
    setMinPrice((prev) => (prev !== urlMinPrice ? urlMinPrice : prev));
    setMaxPrice((prev) => (prev !== urlMaxPrice ? urlMaxPrice : prev));
  }, [location.search, minPriceLimit, maxPriceLimit]);

  const handleCategoryClick = (value?: string) => {
    setCategory(value);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(e.target.value as SortOptionValue);
  };

  const handleMinPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const n = Number(v);
    if (!v) {
      setMinPrice(minPriceLimit);
      return;
    }
    if (Number.isFinite(n)) {
      setMinPrice(Math.max(minPriceLimit, Math.min(n, maxPrice)));
    }
  };

  const handleMaxPriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const n = Number(v);
    if (!v) {
      setMaxPrice(maxPriceLimit);
      return;
    }
    if (Number.isFinite(n)) {
      setMaxPrice(Math.min(maxPriceLimit, Math.max(n, minPrice)));
    }
  };

  const handleResetFilters = () => {
    setCategory(undefined);
    setSearch("");
    setSort("relevance");
    setMinPrice(minPriceLimit);
    setMaxPrice(maxPriceLimit);
  };

  const rootLayoutClass = useMemo(() => {
    const base = "filters-container";
    const layoutClass = layout === "sidebar" ? "filters-sidebar" : "filters-topbar";
    return `undefined undefined undefined`.trim();
  }, [layout, className]);

  return (
    <aside className={rootLayoutClass}>
      <div className="filters-main">
        <div className="filters-row filters-row-search-sort">
          <div className="filters-search">
            <label htmlFor="filters-search-input" className="filters-label">
              Search
            </label>
            <input
              id="filters-search-input"
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder="Search products..."
              className="filters-input filters-input-search"
            />
          </div>

          <div className="filters-sort">
            <label htmlFor="filters-sort-select" className="filters-label">
              Sort by
            </label>
            <select
              id="filters-sort-select"
              value={sort}
              onChange={handleSortChange}
              className="filters-select"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <