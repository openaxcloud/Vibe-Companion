import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl?: string;
  category: string;
  inStock: boolean;
};

type ApiResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

type SortOption = {
  value: string;
  label: string;
};

const PAGE_SIZE_OPTIONS: number[] = [12, 24, 48];
const DEFAULT_PAGE_SIZE = 12;
const DEFAULT_PAGE = 1;

const SORT_OPTIONS: SortOption[] = [
  { value: "relevance", label: "Relevance" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A-Z" },
  { value: "name_desc", label: "Name: Z-A" },
];

const CATEGORY_OPTIONS: string[] = [
  "All",
  "Clothing",
  "Electronics",
  "Home",
  "Books",
  "Sports",
];

const STOCK_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All" },
  { value: "in", label: "In stock" },
  { value: "out", label: "Out of stock" },
];

const API_BASE_URL = "/api/products";

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const getInitialNumberParam = (
  params: URLSearchParams,
  key: string,
  defaultValue: number,
  min = 1
): number => {
  const raw = params.get(key);
  if (!raw) return defaultValue;
  const num = Number(raw);
  if (Number.isNaN(num) || num < min) return defaultValue;
  return num;
};

const getInitialStringParam = (
  params: URLSearchParams,
  key: string,
  defaultValue: string
): string => {
  const raw = params.get(key);
  if (!raw) return defaultValue;
  return raw;
};

const buildQueryFromState = (state: {
  page: number;
  pageSize: number;
  sort: string;
  category: string;
  search: string;
  stock: string;
}): string => {
  const searchParams = new URLSearchParams();

  if (state.page !== DEFAULT_PAGE) {
    searchParams.set("page", String(state.page));
  }

  if (state.pageSize !== DEFAULT_PAGE_SIZE) {
    searchParams.set("pageSize", String(state.pageSize));
  }

  if (state.sort && state.sort !== "relevance") {
    searchParams.set("sort", state.sort);
  }

  if (state.category && state.category !== "All") {
    searchParams.set("category", state.category);
  }

  if (state.search.trim().length > 0) {
    searchParams.set("q", state.search.trim());
  }

  if (state.stock && state.stock !== "all") {
    searchParams.set("stock", state.stock);
  }

  const query = searchParams.toString();
  return query ? `?undefined` : "";
};

const fetchProducts = async (
  controller: AbortController,
  state: {
    page: number;
    pageSize: number;
    sort: string;
    category: string;
    search: string;
    stock: string;
  }
): Promise<ApiResponse> => {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(state.page));
  searchParams.set("pageSize", String(state.pageSize));
  if (state.sort) searchParams.set("sort", state.sort);
  if (state.category && state.category !== "All") {
    searchParams.set("category", state.category);
  }
  if (state.search.trim().length > 0) {
    searchParams.set("q", state.search.trim());
  }
  if (state.stock && state.stock !== "all") {
    searchParams.set("stock", state.stock);
  }

  const response = await fetch(
    `undefined?undefined`,
    {
      method: "GET",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch products: undefined`);
  }

  const data = (await response.json()) as ApiResponse;
  return data;
};

const Home: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [page, setPage] = useState<number>(() =>
    getInitialNumberParam(searchParams, "page", DEFAULT_PAGE)
  );
  const [pageSize, setPageSize] = useState<number>(() =>
    getInitialNumberParam(searchParams, "pageSize", DEFAULT_PAGE_SIZE, 1)
  );
  const [sort, setSort] = useState<string>(() =>
    getInitialStringParam(searchParams, "sort", "relevance")
  );
  const [category, setCategory] = useState<string>(() =>
    getInitialStringParam(searchParams, "category", "All")
  );
  const [stock, setStock] = useState<string>(() =>
    getInitialStringParam(searchParams, "stock", "all")
  );
  const [search, setSearch] = useState<string>(() =>
    getInitialStringParam(searchParams, "q", "")
  );

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialLoaded, setInitialLoaded] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(() => {
    if (!total || !pageSize) return 1;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  useEffect(() => {
    const normalizedPage = clamp(page, 1, Number.isFinite(totalPages) ? totalPages || 1 : 1);
    const nextQuery = buildQueryFromState({
      page: normalizedPage,
      pageSize,
      sort,
      category,
      search,
      stock,
    });

    const currentQuery = window.location.search || "";
    if (currentQuery !== nextQuery) {
      navigate({ search: nextQuery }, { replace: true });
    }

    if (normalizedPage !== page) {
      setPage(normalizedPage);
    }
  }, [page, pageSize, sort, category, search, stock, totalPages, navigate]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchProducts(controller, {
      page,
      pageSize,
      sort,
      category,
      search,
      stock,
    })
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setInitialLoaded(true);
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
        setItems([]);
        setTotal(0);
        setInitialLoaded(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [page, pageSize, sort, category, search, stock]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage === page) return;
    const clamped = clamp(nextPage, 1, totalPages || 1);
    setPage(clamped);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newSize = Number(event.target.value);
    if (Number.isNaN(newSize) || newSize <= 0) return;
    setPageSize(newSize);
    setPage(1);
  };

  const handleSortChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSort(event.target.value);
    setPage(1);
  };

  const handleCategoryChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setCategory(event.target.value);
    setPage(1);
  };

  const handleStockChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setStock(event.target.value);
    setPage(1);
  };

  const handleSearchInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setSearch(event.target.value);
  };

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
  };

  const handleClearFilters = () => {
    setCategory("All");
    setStock("all");
    setSort("relevance");
    setSearch("");
    setPage