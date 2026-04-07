import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

type SortOption = "relevance" | "price_asc" | "price_desc" | "newest";

interface FiltersState {
  category: string;
  minPrice: string;
  maxPrice: string;
  inStock: boolean;
  sort: SortOption;
}

interface FiltersProps {
  availableCategories: string[];
  defaultSort?: SortOption;
  className?: string;
}

const DEFAULT_SORT: SortOption = "relevance";

const parseBoolean = (value: string | null): boolean => {
  if (!value) return false;
  return value === "true" || value === "1";
};

const parseFiltersFromSearch = (
  search: string,
  defaultSort: SortOption
): FiltersState => {
  const params = new URLSearchParams(search);

  return {
    category: params.get("category") || "",
    minPrice: params.get("minPrice") || "",
    maxPrice: params.get("maxPrice") || "",
    inStock: parseBoolean(params.get("inStock")),
    sort: (params.get("sort") as SortOption) || defaultSort,
  };
};

const buildSearchFromFilters = (
  currentSearch: string,
  filters: FiltersState
): string => {
  const params = new URLSearchParams(currentSearch);

  // Category
  if (filters.category) {
    params.set("category", filters.category);
  } else {
    params.delete("category");
  }

  // Price
  if (filters.minPrice) {
    params.set("minPrice", filters.minPrice);
  } else {
    params.delete("minPrice");
  }

  if (filters.maxPrice) {
    params.set("maxPrice", filters.maxPrice);
  } else {
    params.delete("maxPrice");
  }

  // In stock
  if (filters.inStock) {
    params.set("inStock", "true");
  } else {
    params.delete("inStock");
  }

  // Sort
  if (filters.sort && filters.sort !== DEFAULT_SORT) {
    params.set("sort", filters.sort);
  } else {
    params.delete("sort");
  }

  const searchString = params.toString();
  return searchString ? `?undefined` : "";
};

const Filters: React.FC<FiltersProps> = ({
  availableCategories,
  defaultSort = DEFAULT_SORT,
  className = "",
}) => {
  const location = useLocation();
  const navigate = useNavigate();

  const initialFilters = useMemo(
    () => parseFiltersFromSearch(location.search, defaultSort),
    [location.search, defaultSort]
  );

  const [filters, setFilters] = useState<FiltersState>(initialFilters);

  // Keep local state in sync with URL changes (e.g., back/forward navigation)
  useEffect(() => {
    setFilters(parseFiltersFromSearch(location.search, defaultSort));
  }, [location.search, defaultSort]);

  const updateUrl = useCallback(
    (nextFilters: FiltersState) => {
      const nextSearch = buildSearchFromFilters(location.search, nextFilters);
      navigate(
        {
          pathname: location.pathname,
          search: nextSearch,
        },
        { replace: true }
      );
    },
    [location.pathname, location.search, navigate]
  );

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = { ...filters, category: event.target.value };
    setFilters(next);
    updateUrl(next);
  };

  const handleMinPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^\d.]/g, "");
    const next = { ...filters, minPrice: value };
    setFilters(next);
    updateUrl(next);
  };

  const handleMaxPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value.replace(/[^\d.]/g, "");
    const next = { ...filters, maxPrice: value };
    setFilters(next);
    updateUrl(next);
  };

  const handleInStockChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...filters, inStock: event.target.checked };
    setFilters(next);
    updateUrl(next);
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SortOption;
    const next = { ...filters, sort: value };
    setFilters(next);
    updateUrl(next);
  };

  const handleClearFilters = () => {
    const cleared: FiltersState = {
      category: "",
      minPrice: "",
      maxPrice: "",
      inStock: false,
      sort: defaultSort,
    };
    setFilters(cleared);
    const search = buildSearchFromFilters(location.search, cleared);
    navigate(
      {
        pathname: location.pathname,
        search,
      },
      { replace: true }
    );
  };

  return (
    <aside
      className={`filters-panel border border-gray-200 rounded-md p-4 bg-white shadow-sm text-sm undefined`}
      aria-label="Product filters"
    >
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900 text-base">Filters</h2>
        <button
          type="button"
          onClick={handleClearFilters}
          className="text-xs text-blue-600 hover:text-blue-700 hover:underline"
        >
          Clear all
        </button>
      </div>

      {/* Category */}
      <div className="mb-4">
        <label
          htmlFor="filter-category"
          className="block mb-1 font-medium text-gray-700"
        >
          Category
        </label>
        <select
          id="filter-category"
          value={filters.category}
          onChange={handleCategoryChange}
          className="block w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="">All categories</option>
          {availableCategories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </div>

      {/* Price Range */}
      <div className="mb-4">
        <span className="block mb-1 font-medium text-gray-700">
          Price range
        </span>
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <label
              htmlFor="filter-min-price"
              className="sr-only"
            >
              Minimum price
            </label>
            <input
              id="filter-min-price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Min"
              value={filters.minPrice}
              onChange={handleMinPriceChange}
              className="block w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <span className="text-gray-400 text-xs">to</span>
          <div className="flex-1">
            <label
              htmlFor="filter-max-price"
              className="sr-only"
            >
              Maximum price
            </label>
            <input
              id="filter-max-price"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Max"
              value={filters.maxPrice}
              onChange={handleMaxPriceChange}
              className="block w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* In stock toggle */}
      <div className="mb-4 flex items-center">
        <input
          id="filter-in-stock"
          type="checkbox"
          checked={filters.inStock}
          onChange={handleInStockChange}
          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
        <label
          htmlFor="filter-in-stock"
          className="ml-2 text-gray-700"
        >
          In stock only
        </label>
      </div>

      {/* Sort */}
      <div>
        <label
          htmlFor="filter-sort"
          className="block mb-1 font-medium text-gray-700"
        >
          Sort by
        </label>
        <select
          id="filter-sort"
          value={filters.sort}
          onChange={handleSortChange}
          className="block w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          <option value="relevance">Relevance</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="new