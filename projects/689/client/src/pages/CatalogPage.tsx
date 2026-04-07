import React, { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { useSearchParams, useNavigate } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  available: boolean;
  imageUrl?: string;
  createdAt?: string;
};

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  limit: number;
};

type SortField = "name" | "price" | "createdAt";
type SortDirection = "asc" | "desc";

type AvailabilityFilter = "all" | "available" | "unavailable";

type CatalogQueryParams = {
  page: number;
  limit: number;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  availability: AvailabilityFilter;
  sortBy: SortField;
  sortDir: SortDirection;
};

const fetcher = async (url: string): Promise<ProductsResponse> => {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch products: undefined`);
  }
  return res.json();
};

const parseNumberParam = (value: string | null, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

const parseAvailability = (value: string | null): AvailabilityFilter => {
  if (value === "available" || value === "unavailable") return value;
  return "all";
};

const parseSortField = (value: string | null): SortField => {
  if (value === "price" || value === "createdAt" || value === "name") return value;
  return "name";
};

const parseSortDirection = (value: string | null): SortDirection => {
  if (value === "desc") return "desc";
  return "asc";
};

const DEFAULT_LIMIT = 12;

const buildApiUrl = (baseUrl: string, params: CatalogQueryParams): string => {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("limit", String(params.limit));
  if (params.category) search.set("category", params.category);
  if (typeof params.priceMin === "number") search.set("priceMin", String(params.priceMin));
  if (typeof params.priceMax === "number") search.set("priceMax", String(params.priceMax));
  if (params.availability !== "all") search.set("available", params.availability === "available" ? "true" : "false");
  search.set("sortBy", params.sortBy);
  search.set("sortDir", params.sortDir);
  return `undefined?undefined`;
};

const CatalogPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [localCategory, setLocalCategory] = useState<string>("");
  const [localPriceMin, setLocalPriceMin] = useState<string>("");
  const [localPriceMax, setLocalPriceMax] = useState<string>("");
  const [localAvailability, setLocalAvailability] = useState<AvailabilityFilter>("all");
  const [localSortBy, setLocalSortBy] = useState<SortField>("name");
  const [localSortDir, setLocalSortDir] = useState<SortDirection>("asc");
  const [localLimit, setLocalLimit] = useState<number>(DEFAULT_LIMIT);

  const queryParams: CatalogQueryParams = useMemo(() => {
    const page = parseNumberParam(searchParams.get("page"), 1) || 1;
    const limit = parseNumberParam(searchParams.get("limit"), DEFAULT_LIMIT) || DEFAULT_LIMIT;
    const category = searchParams.get("category") || undefined;
    const priceMinParam = searchParams.get("priceMin");
    const priceMaxParam = searchParams.get("priceMax");
    const availability = parseAvailability(searchParams.get("availability"));
    const sortBy = parseSortField(searchParams.get("sortBy"));
    const sortDir = parseSortDirection(searchParams.get("sortDir"));

    const priceMin = priceMinParam !== null && priceMinParam !== "" ? Number(priceMinParam) : undefined;
    const priceMax = priceMaxParam !== null && priceMaxParam !== "" ? Number(priceMaxParam) : undefined;

    return {
      page,
      limit,
      category,
      priceMin,
      priceMax,
      availability,
      sortBy,
      sortDir,
    };
  }, [searchParams]);

  useEffect(() => {
    setLocalCategory(queryParams.category ?? "");
    setLocalPriceMin(
      typeof queryParams.priceMin === "number" && !Number.isNaN(queryParams.priceMin)
        ? String(queryParams.priceMin)
        : ""
    );
    setLocalPriceMax(
      typeof queryParams.priceMax === "number" && !Number.isNaN(queryParams.priceMax)
        ? String(queryParams.priceMax)
        : ""
    );
    setLocalAvailability(queryParams.availability);
    setLocalSortBy(queryParams.sortBy);
    setLocalSortDir(queryParams.sortDir);
    setLocalLimit(queryParams.limit);
  }, [queryParams]);

  const apiUrl = useMemo(
    () => buildApiUrl("/api/products", queryParams),
    [queryParams]
  );

  const { data, error, isLoading, mutate } = useSWR<ProductsResponse>(apiUrl, fetcher, {
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const totalPages = useMemo(() => {
    if (!data || !data.total || !queryParams.limit) return 1;
    return Math.max(1, Math.ceil(data.total / queryParams.limit));
  }, [data, queryParams.limit]);

  const updateSearchParams = useCallback(
    (updates: Partial<CatalogQueryParams>) => {
      const current = new URLSearchParams(searchParams.toString());

      const next: CatalogQueryParams = {
        ...queryParams,
        ...updates,
      };

      current.set("page", String(next.page));
      current.set("limit", String(next.limit));

      if (next.category) {
        current.set("category", next.category);
      } else {
        current.delete("category");
      }

      if (typeof next.priceMin === "number" && !Number.isNaN(next.priceMin)) {
        current.set("priceMin", String(next.priceMin));
      } else {
        current.delete("priceMin");
      }

      if (typeof next.priceMax === "number" && !Number.isNaN(next.priceMax)) {
        current.set("priceMax", String(next.priceMax));
      } else {
        current.delete("priceMax");
      }

      if (next.availability && next.availability !== "all") {
        current.set("availability", next.availability);
      } else {
        current.delete("availability");
      }

      current.set("sortBy", next.sortBy);
      current.set("sortDir", next.sortDir);

      setSearchParams(current, { replace: true });
    },
    [queryParams, searchParams, setSearchParams]
  );

  const handleApplyFilters = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const nextParams: Partial<CatalogQueryParams> = {};

      const trimmedCategory = localCategory.trim();
      if (trimmedCategory) {
        nextParams.category = trimmedCategory;
      } else {
        nextParams.category = undefined;
      }

      const min = localPriceMin.trim() === "" ? undefined : Number(localPriceMin);
      const max = localPriceMax.trim() === "" ? undefined : Number(localPriceMax);

      if (typeof min === "number" && !Number.isNaN(min)) {
        nextParams.priceMin = min >= 0 ? min : 0;
      } else {
        nextParams.priceMin = undefined;
      }

      if (typeof max === "number" && !Number.isNaN(max)) {
        nextParams.priceMax = max >= 0 ? max : undefined;
      } else {
        nextParams.priceMax = undefined;
      }

      nextParams.availability = localAvailability;
      nextParams.sortBy = localSortBy;
      nextParams.sortDir = localSortDir;
      nextParams.limit = localLimit;
      nextParams.page = 1;

      updateSearchParams(nextParams);
    },
    [
      localAvailability,
      localCategory,
      localLimit,
      localPriceMax,
      localPriceMin,
      localSortBy,
      localSortDir,
      updateSearchParams,
    ]
  );

  const handleResetFilters = useCallback(() => {
    setLocalCategory("");
    setLocalPriceMin("");
    setLocalPriceMax("");
    setLocalAvailability("all");
    setLocalSortBy("name");
    setLocalSortDir("asc");
    setLocalLimit(DEFAULT_LIMIT);

    updateSearchParams({
      page: 1,
      limit: DEFAULT_LIMIT,
      category: undefined,
      priceMin: undefined,
      priceMax: undefined,
      availability: "all",
      sortBy: "name",
      sortDir: "asc",
    });
  }, [updateSearch