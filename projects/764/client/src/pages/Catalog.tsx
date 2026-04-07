import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency: string;
  category?: string;
  rating?: number;
  inStock?: boolean;
};

type CatalogFilters = {
  search?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sortBy?: "price" | "name" | "rating" | "createdAt";
  sortOrder?: "asc" | "desc";
};

type Pagination = {
  page: number;
  pageSize: number;
};

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

type FiltersProps = {
  value: CatalogFilters;
  categories: string[];
  onChange: (next: CatalogFilters) => void;
  isLoading: boolean;
};

type ProductCardProps = {
  product: Product;
};

type PaginationProps = {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
};

const DEFAULT_PAGE_SIZE = 12;

const parseBooleanParam = (value: string | null): boolean | undefined => {
  if (value === null) return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
};

const parseNumberParam = (value: string | null): number | undefined => {
  if (value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const buildQueryFromState = (filters: CatalogFilters, pagination: Pagination): string => {
  const params = new URLSearchParams();

  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (typeof filters.minPrice === "number") params.set("minPrice", String(filters.minPrice));
  if (typeof filters.maxPrice === "number") params.set("maxPrice", String(filters.maxPrice));
  if (typeof filters.inStock === "boolean") params.set("inStock", String(filters.inStock));
  if (filters.sortBy) params.set("sortBy", filters.sortBy);
  if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

  if (pagination.page > 1) params.set("page", String(pagination.page));
  if (pagination.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(pagination.pageSize));

  return params.toString();
};

const parseStateFromQuery = (searchParams: URLSearchParams): { filters: CatalogFilters; pagination: Pagination } => {
  const page = parseNumberParam(searchParams.get("page")) || 1;
  const pageSize = parseNumberParam(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE;

  const filters: CatalogFilters = {
    search: searchParams.get("search") || undefined,
    category: searchParams.get("category") || undefined,
    minPrice: parseNumberParam(searchParams.get("minPrice")),
    maxPrice: parseNumberParam(searchParams.get("maxPrice")),
    inStock: parseBooleanParam(searchParams.get("inStock")),
    sortBy: (searchParams.get("sortBy") as CatalogFilters["sortBy"]) || undefined,
    sortOrder: (searchParams.get("sortOrder") as CatalogFilters["sortOrder"]) || undefined
  };

  return {
    filters,
    pagination: {
      page: page < 1 ? 1 : page,
      pageSize: pageSize < 1 ? DEFAULT_PAGE_SIZE : pageSize
    }
  };
};

const Filters: React.FC<FiltersProps> = ({ value, categories, onChange, isLoading }) => {
  const [localSearch, setLocalSearch] = useState<string>(value.search ?? "");
  const [localMinPrice, setLocalMinPrice] = useState<string>(value.minPrice?.toString() ?? "");
  const [localMaxPrice, setLocalMaxPrice] = useState<string>(value.maxPrice?.toString() ?? "");

  useEffect(() => {
    setLocalSearch(value.search ?? "");
  }, [value.search]);

  useEffect(() => {
    setLocalMinPrice(value.minPrice?.toString() ?? "");
  }, [value.minPrice]);

  useEffect(() => {
    setLocalMaxPrice(value.maxPrice?.toString() ?? "");
  }, [value.maxPrice]);

  const handleApply = () => {
    onChange({
      ...value,
      search: localSearch || undefined,
      minPrice: localMinPrice !== "" ? Number(localMinPrice) || 0 : undefined,
      maxPrice: localMaxPrice !== "" ? Number(localMaxPrice) || 0 : undefined
    });
  };

  const handleReset = () => {
    setLocalSearch("");
    setLocalMinPrice("");
    setLocalMaxPrice("");
    onChange({
      search: undefined,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      inStock: undefined,
      sortBy: undefined,
      sortOrder: undefined
    });
  };

  return (
    <aside className="catalog-filters">
      <div className="filters-header">
        <h2>Filters</h2>
        <button type="button" onClick={handleReset} disabled={isLoading} className="filters-reset">
          Reset
        </button>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-search">Search</label>
        <input
          id="filter-search"
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search products..."
          disabled={isLoading}
        />
      </div>

      <div className="filter-group">
        <label htmlFor="filter-category">Category</label>
        <select
          id="filter-category"
          value={value.category ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              category: e.target.value || undefined
            })
          }
          disabled={isLoading}
        >
          <option value="">All categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-group filter-group-inline">
        <div>
          <label htmlFor="filter-min-price">Min price</label>
          <input
            id="filter-min-price"
            type="number"
            min={0}
            value={localMinPrice}
            onChange={(e) => setLocalMinPrice(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div>
          <label htmlFor="filter-max-price">Max price</label>
          <input
            id="filter-max-price"
            type="number"
            min={0}
            value={localMaxPrice}
            onChange={(e) => setLocalMaxPrice(e.target.value)}
            disabled={isLoading}
          />
        </div>
      </div>

      <div className="filter-group filter-group-checkbox">
        <label>
          <input
            type="checkbox"
            checked={value.inStock ?? false}
            onChange={(e) =>
              onChange({
                ...value,
                inStock: e.target.checked ? true : undefined
              })
            }
            disabled={isLoading}
          />
          In stock only
        </label>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-sort-by">Sort by</label>
        <select
          id="filter-sort-by"
          value={value.sortBy ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              sortBy: (e.target.value || undefined) as CatalogFilters["sortBy"]
            })
          }
          disabled={isLoading}
        >
          <option value="">Recommended</option>
          <option value="price">Price</option>
          <option value="name">Name</option>
          <option value="rating">Rating</option>
          <option value="createdAt">Newest</option>
        </select>
      </div>

      <div className="filter-group">
        <label htmlFor="filter-sort-order">Order</label>
        <select
          id="filter-sort-order"
          value={value.sortOrder ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              sortOrder: (e.target.value || undefined) as CatalogFilters["sortOrder"]
            })
          }
          disabled={isLoading}
        >
          <option value="">Default</option>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>

      <button type="button" onClick={handleApply} disabled={isLoading} className="filters-apply">
        Apply
      </button>
    </aside>
  );
};

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const formattedPrice = useMemo(() => {
    try {