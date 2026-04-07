import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

export type CategoryOption = {
  label: string;
  value: string;
};

export interface FilterState {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface FilterBarProps {
  categories: CategoryOption[];
  onFiltersChange?: (filters: FilterState) => void;
  className?: string;
  /**
   * Optional debounce in ms for change notifications
   */
  debounceMs?: number;
}

const parseNumber = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const num = Number(value);
  if (Number.isNaN(num)) return undefined;
  return num;
};

const toStringOrEmpty = (value?: number): string => {
  if (value === undefined || value === null) return "";
  if (Number.isNaN(value)) return "";
  return String(value);
};

const DEFAULT_DEBOUNCE = 300;

const useDebouncedCallback = <TArgs extends unknown[]>(
  callback: (...args: TArgs) => void,
  delay: number
) => {
  const [timeoutId, setTimeoutId] = useState<number | undefined>(undefined);

  const debounced = useCallback(
    (...args: TArgs) => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      const id = window.setTimeout(() => {
        callback(...args);
      }, delay);
      setTimeoutId(id);
    },
    [callback, delay, timeoutId]
  );

  useEffect(() => {
    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [timeoutId]);

  return debounced;
};

const FilterBar: React.FC<FilterBarProps> = ({
  categories,
  onFiltersChange,
  className,
  debounceMs = DEFAULT_DEBOUNCE,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFilters: FilterState = useMemo(
    () => ({
      category: searchParams.get("category") || undefined,
      minPrice: parseNumber(searchParams.get("minPrice")),
      maxPrice: parseNumber(searchParams.get("maxPrice")),
    }),
    [searchParams]
  );

  const [category, setCategory] = useState<string | undefined>(
    initialFilters.category
  );
  const [minPrice, setMinPrice] = useState<number | undefined>(
    initialFilters.minPrice
  );
  const [maxPrice, setMaxPrice] = useState<number | undefined>(
    initialFilters.maxPrice
  );

  useEffect(() => {
    setCategory(initialFilters.category);
    setMinPrice(initialFilters.minPrice);
    setMaxPrice(initialFilters.maxPrice);
  }, [initialFilters.category, initialFilters.minPrice, initialFilters.maxPrice]);

  const emitFiltersChange = useDebouncedCallback(
    (filters: FilterState) => {
      if (onFiltersChange) {
        onFiltersChange(filters);
      }
    },
    Math.max(0, debounceMs)
  );

  const syncUrlAndNotify = useCallback(
    (next: FilterState) => {
      const newSearch = new URLSearchParams(searchParams.toString());

      if (next.category) {
        newSearch.set("category", next.category);
      } else {
        newSearch.delete("category");
      }

      if (typeof next.minPrice === "number" && !Number.isNaN(next.minPrice)) {
        newSearch.set("minPrice", String(next.minPrice));
      } else {
        newSearch.delete("minPrice");
      }

      if (typeof next.maxPrice === "number" && !Number.isNaN(next.maxPrice)) {
        newSearch.set("maxPrice", String(next.maxPrice));
      } else {
        newSearch.delete("maxPrice");
      }

      const nextFilters: FilterState = {
        category: next.category,
        minPrice: next.minPrice,
        maxPrice: next.maxPrice,
      };

      setSearchParams(newSearch, { replace: true });
      emitFiltersChange(nextFilters);
    },
    [emitFiltersChange, searchParams, setSearchParams]
  );

  const handleCategoryChange = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value || undefined;
      setCategory(value);
      syncUrlAndNotify({
        category: value,
        minPrice,
        maxPrice,
      });
    },
    [maxPrice, minPrice, syncUrlAndNotify]
  );

  const handleMinPriceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      const nextMin = value.trim() === "" ? undefined : Number(value);
      if (!Number.isNaN(nextMin as number) || value.trim() === "") {
        setMinPrice(nextMin);
        syncUrlAndNotify({
          category,
          minPrice: nextMin,
          maxPrice,
        });
      }
    },
    [category, maxPrice, syncUrlAndNotify]
  );

  const handleMaxPriceChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      const nextMax = value.trim() === "" ? undefined : Number(value);
      if (!Number.isNaN(nextMax as number) || value.trim() === "") {
        setMaxPrice(nextMax);
        syncUrlAndNotify({
          category,
          minPrice,
          maxPrice: nextMax,
        });
      }
    },
    [category, minPrice, syncUrlAndNotify]
  );

  const handleReset = useCallback(() => {
    setCategory(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);

    const newSearch = new URLSearchParams(searchParams.toString());
    newSearch.delete("category");
    newSearch.delete("minPrice");
    newSearch.delete("maxPrice");

    setSearchParams(newSearch, { replace: true });
    emitFiltersChange({});
  }, [emitFiltersChange, searchParams, setSearchParams]);

  const isDirty = useMemo(
    () => Boolean(category || minPrice !== undefined || maxPrice !== undefined),
    [category, minPrice, maxPrice]
  );

  const rootClassName = useMemo(
    () =>
      [
        "filter-bar",
        "flex",
        "flex-wrap",
        "items-end",
        "gap-4",
        "p-4",
        "bg-white",
        "border",
        "border-gray-200",
        "rounded-md",
        className || "",
      ]
        .filter(Boolean)
        .join(" "),
    [className]
  );

  return (
    <div className={rootClassName}>
      <div className="flex flex-col gap-1 min-w-[180px]">
        <label htmlFor="filter-category" className="text-sm font-medium text-gray-700">
          Category
        </label>
        <select
          id="filter-category"
          name="category"
          value={category || ""}
          onChange={handleCategoryChange}
          className="h-10 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat.value} value={cat.value}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1 w-32">
        <label htmlFor="filter-min-price" className="text-sm font-medium text-gray-700">
          Min price
        </label>
        <input
          id="filter-min-price"
          name="minPrice"
          type="number"
          min={0}
          value={toStringOrEmpty(minPrice)}
          onChange={handleMinPriceChange}
          className="h-10 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1 w-32">
        <label htmlFor="filter-max-price" className="text-sm font-medium text-gray-700">
          Max price
        </label>
        <input
          id="filter-max-price"
          name="maxPrice"
          type="number"
          min={0}
          value={toStringOrEmpty(maxPrice)}
          onChange={handleMaxPriceChange}
          className="h-10 rounded border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={handleReset}
        disabled={!isDirty}
        className={`h-10 px-3 rounded border text-sm font-medium transition-colors undefined`}
      >
        Reset
      </button>
    </div>
  );
};