import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ProductCard from "../components/ProductCard";

type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency?: string;
};

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 12;
const DEBOUNCE_DELAY = 400;

const parseNumberParam = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return parsed;
};

const useQueryParams = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search]
  );

  const getParam = useCallback(
    (key: string): string | null => {
      return searchParams.get(key);
    },
    [searchParams]
  );

  const setParams = useCallback(
    (params: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(location.search);
      Object.entries(params).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      });
      navigate(
        {
          pathname: location.pathname,
          search: next.toString(),
        },
        { replace: true }
      );
    },
    [location.pathname, location.search, navigate]
  );

  return { getParam, setParams, searchParams };
};

const Catalog: FC = () => {
  const { getParam, setParams } = useQueryParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(
    parseNumberParam(getParam("page"), DEFAULT_PAGE)
  );
  const [pageSize] = useState<number>(
    parseNumberParam(getParam("pageSize"), DEFAULT_PAGE_SIZE)
  );
  const [searchInput, setSearchInput] = useState<string>(getParam("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState<string>(
    getParam("q") ?? ""
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const debounceTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setParams({
        q: searchInput.trim() || null,
        page: 1,
      });
      setPage(1);
    }, DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput, setParams]);

  useEffect(() => {
    const paramPage = parseNumberParam(getParam("page"), DEFAULT_PAGE);
    if (paramPage !== page) {
      setPage(paramPage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getParam("page")]);

  const fetchProducts = useCallback(
    async (currentPage: number, currentSearch: string) => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        params.set("page", String(currentPage));
        params.set("pageSize", String(pageSize));
        if (currentSearch) {
          params.set("q", currentSearch);
        }

        const response = await fetch(`/api/products?undefined`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to load products (undefined)`);
        }

        const data: ProductsResponse = await response.json();

        setProducts(data.items);
        setTotal(data.total);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    fetchProducts(page, debouncedSearch);
  }, [page, debouncedSearch, fetchProducts]);

  const totalPages = useMemo(() => {
    if (!total || !pageSize) return 1;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      const safePage = Math.min(Math.max(1, nextPage), totalPages);
      setPage(safePage);
      setParams({
        page: safePage,
      });
    },
    [setParams, totalPages]
  );

  const handlePrevPage = useCallback(() => {
    handlePageChange(page - 1);
  }, [handlePageChange, page]);

  const handleNextPage = useCallback(() => {
    handlePageChange(page + 1);
  }, [handlePageChange, page]);

  const handleSearchChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(event.target.value);
    },
    []
  );

  const hasResults = products.length > 0;

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1200px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: "1.75rem",
            fontWeight: 600,
          }}
        >
          Catalog
        </h1>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <input
            type="search"
            value={searchInput}
            onChange={handleSearchChange}
            placeholder="Search products..."
            aria-label="Search products"
            style={{
              flex: "1 1 240px",
              minWidth: "200px",
              padding: "8px 12px",
              fontSize: "0.95rem",
              borderRadius: "4px",
              border: "1px solid #d0d7de",
              outline: "none",
            }}
          />
          <div
            style={{
              fontSize: "0.85rem",
              color: "#6e7781",
              whiteSpace: "nowrap",
            }}
          >
            {loading
              ? "Loading products..."
              : hasResults
              ? `Showing undefined–undefined of undefined`
              : "No products"}
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          style={{
            padding: "12px 16px",
            borderRadius: "4px",
            border: "1px solid #ffccd5",
            backgroundColor: "#fff5f7",
            color: "#b00020",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      <main
        style={{
          minHeight: "200px",
        }}
      >
        {loading && !hasResults ? (
          <div
            style={{
              padding: "32px 0",
              textAlign: "center",
              color: "#6e7781",
              fontSize: "0.95rem",
            }}
          >
            Loading products...
          </div>
        ) : !hasResults ? (
          <div
            style={{
              padding: "32px 0",
              textAlign: "center",
              color: "#6e7781",
              fontSize: "0.95rem",
            }}
          >
            No products found{debouncedSearch ? ` for “undefined”` : ""}.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
              gap: "16px",
            }}
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product}