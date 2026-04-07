import React, { useCallback, useEffect, useMemo, useState } from "react";

export type SortByOption = "relevance" | "price_asc" | "price_desc" | "newest" | "rating";

export interface CategoryOption {
  id: string;
  label: string;
}

export interface FiltersState {
  search: string;
  categoryId: string | null;
  priceMin: number | null;
  priceMax: number | null;
  sortBy: SortByOption;
}

interface FiltersBarProps {
  categories: CategoryOption[];
  initialFilters?: Partial<FiltersState>;
  minAllowedPrice?: number;
  maxAllowedPrice?: number;
  disabled?: boolean;
  onChange: (filters: FiltersState) => void;
  onSearchImmediate?: (search: string) => void;
  debounceMs?: number;
}

const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = 10000;
const DEFAULT_DEBOUNCE_MS = 350;

const normalizeInitialFilters = (
  initial?: Partial<FiltersState>,
  minAllowedPrice?: number,
  maxAllowedPrice?: number
): FiltersState => {
  const priceMin =
    initial?.priceMin ?? (typeof minAllowedPrice === "number" ? minAllowedPrice : DEFAULT_MIN_PRICE);
  const priceMax =
    initial?.priceMax ?? (typeof maxAllowedPrice === "number" ? maxAllowedPrice : DEFAULT_MAX_PRICE);

  return {
    search: initial?.search ?? "",
    categoryId: initial?.categoryId ?? null,
    priceMin,
    priceMax,
    sortBy: initial?.sortBy ?? "relevance",
  };
};

export const FiltersBar: React.FC<FiltersBarProps> = ({
  categories,
  initialFilters,
  minAllowedPrice,
  maxAllowedPrice,
  disabled = false,
  onChange,
  onSearchImmediate,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}) => {
  const [filters, setFilters] = useState<FiltersState>(() =>
    normalizeInitialFilters(initialFilters, minAllowedPrice, maxAllowedPrice)
  );
  const [searchInput, setSearchInput] = useState<string>(filters.search);

  const minPriceBound = useMemo(
    () => (typeof minAllowedPrice === "number" ? minAllowedPrice : DEFAULT_MIN_PRICE),
    [minAllowedPrice]
  );
  const maxPriceBound = useMemo(
    () => (typeof maxAllowedPrice === "number" ? maxAllowedPrice : DEFAULT_MAX_PRICE),
    [maxAllowedPrice]
  );

  // Sync internal state if initialFilters prop changes
  useEffect(() => {
    setFilters(normalizeInitialFilters(initialFilters, minAllowedPrice, maxAllowedPrice));
  }, [initialFilters, minAllowedPrice, maxAllowedPrice]);

  // Sync search input when filters.search changes externally
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Debounce search change notification
  useEffect(() => {
    if (disabled) return;
    const handler = window.setTimeout(() => {
      setFilters((prev) => {
        if (prev.search === searchInput) return prev;
        const next = { ...prev, search: searchInput };
        onChange(next);
        if (onSearchImmediate) {
          onSearchImmediate(searchInput);
        }
        return next;
      });
    }, debounceMs);

    return () => {
      window.clearTimeout(handler);
    };
  }, [searchInput, debounceMs, disabled, onChange, onSearchImmediate]);

  const emitFiltersChange = useCallback(
    (next: FiltersState) => {
      if (disabled) return;
      setFilters(next);
      onChange(next);
    },
    [disabled, onChange]
  );

  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      const categoryId = value === "" ? null : value;
      emitFiltersChange({ ...filters, categoryId });
    },
    [emitFiltersChange, filters]
  );

  const handleSortChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value as SortByOption;
      emitFiltersChange({ ...filters, sortBy: value });
    },
    [emitFiltersChange, filters]
  );

  const handlePriceMinChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      const numeric = value === "" ? null : Number(value.replace(/[^\d.-]/g, ""));
      if (numeric !== null && Number.isNaN(numeric)) return;

      let nextMin = numeric;
      let nextMax = filters.priceMax;

      if (nextMin !== null && nextMin < minPriceBound) {
        nextMin = minPriceBound;
      }
      if (nextMax !== null && nextMin !== null && nextMin > nextMax) {
        nextMax = nextMin;
      }

      emitFiltersChange({
        ...filters,
        priceMin: nextMin,
        priceMax: nextMax,
      });
    },
    [emitFiltersChange, filters, minPriceBound]
  );

  const handlePriceMaxChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      const numeric = value === "" ? null : Number(value.replace(/[^\d.-]/g, ""));
      if (numeric !== null && Number.isNaN(numeric)) return;

      let nextMax = numeric;
      let nextMin = filters.priceMin;

      if (nextMax !== null && nextMax > maxPriceBound) {
        nextMax = maxPriceBound;
      }
      if (nextMin !== null && nextMax !== null && nextMax < nextMin) {
        nextMin = nextMax;
      }

      emitFiltersChange({
        ...filters,
        priceMin: nextMin,
        priceMax: nextMax,
      });
    },
    [emitFiltersChange, filters, maxPriceBound]
  );

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(event.target.value);
    },
    []
  );

  const handleClearAll = useCallback(() => {
    const reset = normalizeInitialFilters(
      {
        search: "",
        categoryId: null,
        priceMin: minPriceBound,
        priceMax: maxPriceBound,
        sortBy: "relevance",
      },
      minPriceBound,
      maxPriceBound
    );
    setSearchInput("");
    emitFiltersChange(reset);
  }, [emitFiltersChange, maxPriceBound, minPriceBound]);

  const hasActiveFilters = useMemo(() => {
    const base = normalizeInitialFilters(undefined, minPriceBound, maxPriceBound);
    return (
      filters.search.trim() !== base.search ||
      filters.categoryId !== base.categoryId ||
      filters.priceMin !== base.priceMin ||
      filters.priceMax !== base.priceMax ||
      filters.sortBy !== base.sortBy
    );
  }, [filters, minPriceBound, maxPriceBound]);

  const formatNumberInputValue = (value: number | null): string => {
    if (value === null || Number.isNaN(value)) return "";
    return String(value);
  };

  return (
    <div
      className="filters-bar flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-3 shadow-sm md:flex-row md:items-end md:justify-between"
      aria-label="Product filters"
    >
      <div className="flex flex-1 flex-col gap-2 md:flex-row md:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="filters-search">
            Search
          </label>
          <input
            id="filters-search"
            type="search"
            className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            placeholder="Search products…"
            value={searchInput}
            onChange={handleSearchChange}
            disabled={disabled}
          />
        </div>

        <div className="w-full md:w-48">
          <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="filters-category">
            Category
          </label>
          <select
            id="filters-category"
            className="block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
            value={filters.categoryId ?? ""}
            onChange={handleCategoryChange}
            disabled={disabled}
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex w-full flex-row gap-2 md:w-60">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-700" htmlFor="filters-price-min