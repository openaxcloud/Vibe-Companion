import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type SortOption = "relevance" | "newest" | "oldest";

interface Filters {
  category: string;
  sort: SortOption;
}

interface Item {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: string;
}

interface ApiResponse {
  data: Item[];
  page: number;
  pageSize: number;
  total: number;
}

const DEFAULT_PAGE_SIZE = 10;

const CATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "All Categories" },
  { value: "books", label: "Books" },
  { value: "music", label: "Music" },
  { value: "movies", label: "Movies" },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

const buildQueryString = (params: {
  q?: string;
  category?: string;
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}): string => {
  const sp = new URLSearchParams();

  if (params.q) sp.set("q", params.q);
  if (params.category) sp.set("category", params.category);
  if (params.sort) sp.set("sort", params.sort);
  if (typeof params.page === "number") sp.set("page", String(params.page));
  if (typeof params.pageSize === "number")
    sp.set("pageSize", String(params.pageSize));

  const qs = sp.toString();
  return qs ? `?undefined` : "";
};

const parseNumber = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const Home: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialQuery = searchParams.get("q") ?? "";
  const initialCategory = searchParams.get("category") ?? "";
  const initialSort = (searchParams.get("sort") as SortOption) || "relevance";
  const initialPage = parseNumber(searchParams.get("page"), 1);
  const initialPageSize = parseNumber(
    searchParams.get("pageSize"),
    DEFAULT_PAGE_SIZE
  );

  const [query, setQuery] = useState<string>(initialQuery);
  const [filters, setFilters] = useState<Filters>({
    category: initialCategory,
    sort: initialSort,
  });
  const [page, setPage] = useState<number>(initialPage);
  const [pageSize] = useState<number>(initialPageSize);
  const [results, setResults] = useState<Item[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const totalPages = useMemo(
    () => (total > 0 ? Math.ceil(total / pageSize) : 1),
    [total, pageSize]
  );

  const updateSearchParams = (params: {
    q?: string;
    category?: string;
    sort?: SortOption;
    page?: number;
    pageSize?: number;
  }) => {
    const next = new URLSearchParams(searchParams.toString());
    if (params.q !== undefined) {
      if (params.q) next.set("q", params.q);
      else next.delete("q");
    }
    if (params.category !== undefined) {
      if (params.category) next.set("category", params.category);
      else next.delete("category");
    }
    if (params.sort !== undefined) {
      if (params.sort) next.set("sort", params.sort);
      else next.delete("sort");
    }
    if (params.page !== undefined) {
      if (params.page > 1) next.set("page", String(params.page));
      else next.delete("page");
    }
    if (params.pageSize !== undefined) {
      if (params.pageSize !== DEFAULT_PAGE_SIZE)
        next.set("pageSize", String(params.pageSize));
      else next.delete("pageSize");
    }
    setSearchParams(next);
  };

  useEffect(() => {
    const spQuery = searchParams.get("q") ?? "";
    const spCategory = searchParams.get("category") ?? "";
    const spSort = (searchParams.get("sort") as SortOption) || "relevance";
    const spPage = parseNumber(searchParams.get("page"), 1);
    const spPageSize = parseNumber(
      searchParams.get("pageSize"),
      DEFAULT_PAGE_SIZE
    );

    setQuery(spQuery);
    setFilters({
      category: spCategory,
      sort: spSort,
    });
    setPage(spPage);
    // pageSize is fixed after mount to avoid layout jumps; do not update from URL changes
    if (spPageSize !== pageSize) {
      // optional: could handle mismatch, but we'll ignore to keep state stable
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const qs = buildQueryString({
          q: query || undefined,
          category: filters.category || undefined,
          sort: filters.sort,
          page,
          pageSize,
        });

        const res = await fetch(`/api/itemsundefined`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`Request failed with status undefined`);
        }

        const json = (await res.json()) as ApiResponse;
        setResults(json.data);
        setTotal(json.total);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "Unknown error");
        setResults([]);
        setTotal(0);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [query, filters.category, filters.sort, page, pageSize]);

  const handleSubmitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    updateSearchParams({
      q: query || undefined,
      category: filters.category || undefined,
      sort: filters.sort,
      page: 1,
      pageSize,
    });
  };

  const handleChangeQuery = (event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value);
  };

  const handleChangeCategory = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const category = event.target.value;
    setFilters((prev) => ({ ...prev, category }));
    setPage(1);
    updateSearchParams({
      q: query || undefined,
      category: category || undefined,
      sort: filters.sort,
      page: 1,
      pageSize,
    });
  };

  const handleChangeSort = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const sort = event.target.value as SortOption;
    setFilters((prev) => ({ ...prev, sort }));
    setPage(1);
    updateSearchParams({
      q: query || undefined,
      category: filters.category || undefined,
      sort,
      page: 1,
      pageSize,
    });
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    updateSearchParams({
      q: query || undefined,
      category: filters.category || undefined,
      sort: filters.sort,
      page: nextPage,
      pageSize,
    });
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages: number[] = [];
    const maxButtons = 5;
    let start = Math.max(1, page - Math.floor(maxButtons / 2));
    let end = start + maxButtons - 1;

    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxButtons + 1);
    }

    for (let p = start; p <= end; p++) {
      pages.push(p);
    }

    return (
      <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1 || loading}
          className="rounded border px-3 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        {start > 1 &&