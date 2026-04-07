import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  createdAt: string;
};

type SortOption = "relevance" | "price_asc" | "price_desc" | "newest";

type CatalogFilters = {
  search: string;
  category: string;
  minPrice: string;
  maxPrice: string;
  sort: SortOption;
  page: number;
  pageSize: number;
};

type CatalogResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE_SIZE = 12;
const PAGE_SIZE_OPTIONS = [12, 24, 48, 96];

const CATEGORIES: { label: string; value: string }[] = [
  { label: "All Categories", value: "" },
  { label: "Electronics", value: "electronics" },
  { label: "Books", value: "books" },
  { label: "Clothing", value: "clothing" },
  { label: "Home & Kitchen", value: "home-kitchen" },
  { label: "Sports", value: "sports" },
];

const SORT_OPTIONS: { label: string; value: SortOption }[] = [
  { label: "Relevance", value: "relevance" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
  { label: "Newest", value: "newest" },
];

const parseNumberParam = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const parseSortParam = (value: string | null): SortOption => {
  const allowed: SortOption[] = ["relevance", "price_asc", "price_desc", "newest"];
  if (value && allowed.includes(value as SortOption)) {
    return value as SortOption;
  }
  return "relevance";
};

const buildFiltersFromSearchParams = (params: URLSearchParams): CatalogFilters => {
  return {
    search: params.get("q") ?? "",
    category: params.get("category") ?? "",
    minPrice: params.get("minPrice") ?? "",
    maxPrice: params.get("maxPrice") ?? "",
    sort: parseSortParam(params.get("sort")),
    page: parseNumberParam(params.get("page"), 1),
    pageSize: parseNumberParam(params.get("pageSize"), DEFAULT_PAGE_SIZE),
  };
};

const serializeFiltersToSearchParams = (filters: CatalogFilters): URLSearchParams => {
  const params = new URLSearchParams();

  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.category) params.set("category", filters.category);
  if (filters.minPrice.trim()) params.set("minPrice", filters.minPrice.trim());
  if (filters.maxPrice.trim()) params.set("maxPrice", filters.maxPrice.trim());
  if (filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) params.set("pageSize", String(filters.pageSize));

  return params;
};

const fetchCatalog = async (filters: CatalogFilters, signal?: AbortSignal): Promise<CatalogResponse> => {
  const params = serializeFiltersToSearchParams(filters);
  const response = await fetch(`/api/catalog?undefined`, { signal });
  if (!response.ok) {
    throw new Error(`Failed to load catalog (undefined)`);
  }
  const data = (await response.json()) as CatalogResponse;
  return data;
};

const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
};

const Catalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const initialFilters = useMemo(() => buildFiltersFromSearchParams(searchParams), [searchParams]);
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);

  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Keep local filter state in sync when URL changes externally (e.g. browser back)
  useEffect(() => {
    setFilters(prev => {
      const next = buildFiltersFromSearchParams(searchParams);
      const changed =
        prev.search !== next.search ||
        prev.category !== next.category ||
        prev.minPrice !== next.minPrice ||
        prev.maxPrice !== next.maxPrice ||
        prev.sort !== next.sort ||
        prev.page !== next.page ||
        prev.pageSize !== next.pageSize;
      return changed ? next : prev;
    });
  }, [searchParams]);

  // Whenever filters change, update URL and refetch catalog
  useEffect(() => {
    const params = serializeFiltersToSearchParams(filters);
    setSearchParams(params, { replace: true });

    const abortController = new AbortController();
    setLoading(true);
    setError(null);

    fetchCatalog(filters, abortController.signal)
      .then(result => {
        setData(result);
      })
      .catch(err => {
        if (err.name === "AbortError") return;
        setError(err.message || "Unable to load catalog");
      })
      .finally(() => {
        setLoading(false);
      });

    return () => abortController.abort();
  }, [filters, setSearchParams]);

  const totalPages = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, Math.ceil(data.total / data.pageSize));
  }, [data]);

  const updateFilters = useCallback((updater: (prev: CatalogFilters) => CatalogFilters) => {
    setFilters(prev => {
      const updated = updater(prev);
      // Normalize page bounds
      if (updated.page < 1) updated.page = 1;
      return updated;
    });
  }, []);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    updateFilters(prev => ({
      ...prev,
      search: value,
      page: 1,
    }));
  };

  const handleCategoryChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters(prev => ({
      ...prev,
      category: value,
      page: 1,
    }));
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value as SortOption;
    updateFilters(prev => ({
      ...prev,
      sort: value,
      page: 1,
    }));
  };

  const handleMinPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!/^\d*(\.\d{0,2})?$/.test(value)) return;
    updateFilters(prev => ({
      ...prev,
      minPrice: value,
      page: 1,
    }));
  };

  const handleMaxPriceChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (!/^\d*(\.\d{0,2})?$/.test(value)) return;
    updateFilters(prev => ({
      ...prev,
      maxPrice: value,
      page: 1,
    }));
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage === filters.page) return;
    if (totalPages && nextPage > totalPages) return;
    updateFilters(prev => ({
      ...prev,
      page: nextPage,
    }));
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = Number(event.target.value);
    if (!PAGE_SIZE_OPTIONS.includes(value)) return;
    updateFilters(prev => ({
      ...prev,
      pageSize: value,
      page: 1,
    }));
  };

  const handleResetFilters = () => {
    const base: CatalogFilters = {
      search: "",
      category: "",
      minPrice: "",
      maxPrice: "",
      sort: "relevance",
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    };
    setFilters(base);
    setSearchParams(serializeFiltersToSearchParams(base), { replace: true });
    navigate({ pathname: "/catalog", search: "?" + serializeFiltersToSearchParams(base).toString() }, { replace: true });
  };

  const hasActiveFilters = useMemo(() => {
    return (
      filters.search.trim() !== "" ||
      filters.category !== "" ||
      filters.minPrice.trim() !== "" ||
      filters.maxPrice.trim() !== "" ||
      filters.sort !== "re