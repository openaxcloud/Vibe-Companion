import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Grid,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
  Pagination,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Slider,
  Button,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { styled } from "@mui/material/styles";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  inStock: boolean;
};

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

type SortOption = "relevance" | "price_asc" | "price_desc" | "name_asc" | "name_desc";

type CatalogFilters = {
  query: string;
  category: string;
  sort: SortOption;
  inStockOnly: boolean;
  minPrice: number | null;
  maxPrice: number | null;
  page: number;
};

const PAGE_SIZE = 12;
const MIN_PRICE = 0;
const MAX_PRICE = 1000;

async function fetchProducts(filters: CatalogFilters): Promise<ProductsResponse> {
  const params = new URLSearchParams();
  if (filters.query) params.append("q", filters.query);
  if (filters.category && filters.category !== "all") {
    params.append("category", filters.category);
  }
  if (filters.sort) params.append("sort", filters.sort);
  if (filters.inStockOnly) params.append("inStock", "true");
  if (filters.minPrice != null) params.append("minPrice", String(filters.minPrice));
  if (filters.maxPrice != null) params.append("maxPrice", String(filters.maxPrice));
  params.append("page", String(filters.page));
  params.append("pageSize", String(PAGE_SIZE));

  const res = await fetch(`/api/products?undefined`);
  if (!res.ok) {
    throw new Error("Failed to load products");
  }
  return res.json();
}

// Placeholder categories; in a real app these might be fetched from an API
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All categories" },
  { value: "electronics", label: "Electronics" },
  { value: "books", label: "Books" },
  { value: "clothing", label: "Clothing" },
  { value: "home", label: "Home & Kitchen" },
];

const SortSelect = styled(Select)(({ theme }) => ({
  minWidth: 180,
  [theme.breakpoints.down("sm")]: {
    minWidth: 140,
  },
}));

const CatalogContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(3),
  [theme.breakpoints.down("sm")]: {
    padding: theme.spacing(2),
  },
}));

const FiltersContainer = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "2fr 1.2fr 1.2fr 1.2fr",
  gap: theme.spacing(2),
  alignItems: "center",
  marginBottom: theme.spacing(3),
  [theme.breakpoints.down("md")]: {
    gridTemplateColumns: "1fr 1fr",
  },
  [theme.breakpoints.down("sm")]: {
    gridTemplateColumns: "1fr",
  },
}));

const FilterRow = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  gap: theme.spacing(2),
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(2),
  flexWrap: "wrap",
  justifyContent: "space-between",
}));

const ProductsGrid = styled(Grid)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));

// Minimal ProductCard placeholder; replace with actual component if exists
type ProductCardProps = {
  product: Product;
};
const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: "1px solid",
        borderColor: "divider",
        padding: 2,
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box
        sx={{
          position: "relative",
          paddingBottom: "75%",
          mb: 2,
          bgcolor: "grey.100",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        {product.imageUrl ? (
          <Box
            component="img"
            src={product.imageUrl}
            alt={product.name}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "text.secondary",
              fontSize: 14,
            }}
          >
            No image
          </Box>
        )}
      </Box>
      <Typography variant="subtitle1" fontWeight={600} gutterBottom noWrap>
        {product.name}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ mb: 1, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
      >
        {product.description}
      </Typography>
      <Box sx={{ mt: "auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6">undefined</Typography>
        <Typography
          variant="caption"
          color={product.inStock ? "success.main" : "text.secondary"}
          sx={{ fontWeight: 500 }}
        >
          {product.inStock ? "In stock" : "Out of stock"}
        </Typography>
      </Box>
    </Box>
  );
};

const DEFAULT_FILTERS: CatalogFilters = {
  query: "",
  category: "all",
  sort: "relevance",
  inStockOnly: false,
  minPrice: MIN_PRICE,
  maxPrice: MAX_PRICE,
  page: 1,
};

const parseNumberParam = (value: string | null, fallback: number | null): number | null => {
  if (value == null) return fallback;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
};

const Catalog: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const initialFilters: CatalogFilters = useMemo(() => {
    return {
      query: searchParams.get("q") ?? DEFAULT_FILTERS.query,
      category: searchParams.get("category") ?? DEFAULT_FILTERS.category,
      sort: (searchParams.get("sort") as SortOption) ?? DEFAULT_FILTERS.sort,
      inStockOnly: searchParams.get("inStock") === "true",
      minPrice: parseNumberParam(searchParams.get("minPrice"), DEFAULT_FILTERS.minPrice),
      maxPrice: parseNumberParam(searchParams.get("maxPrice"), DEFAULT_FILTERS.maxPrice),
      page: parseNumberParam(searchParams.get("page"), DEFAULT_FILTERS.page) ?? DEFAULT_FILTERS.page,
    };
  }, [searchParams]);

  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [searchInput, setSearchInput] = useState<string>(initialFilters.query);

  useEffect(() => {
    setFilters(initialFilters);
    setSearchInput(initialFilters.query);
  }, [initialFilters]);

  const updateSearchParams = useCallback(
    (next: CatalogFilters) => {
      const params: Record<string, string> = {};
      if (next.query) params.q = next.query;
      if (next.category && next.category !== "all") params.category = next.category;
      if (next.sort && next.sort !== "relevance") params.sort = next.sort;
      if (next.inStockOnly) params.inStock = "true";
      if (next.minPrice != null && next.minPrice !== MIN_PRICE) params.minPrice = String(next.minPrice);
      if (next.maxPrice != null && next.maxPrice !== MAX_PRICE) params.maxPrice = String(next.maxPrice);
      if (next.page !== 1) params.page = String(next.page);
      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  const handleFiltersChange = useCallback(
    (partial: Partial<CatalogFilters>, resetPage: boolean = true) => {
      setFilters((prev) => {
        const next: CatalogFilters = {
          ...prev,
          ...partial,
          page: resetPage ? 1 : partial.page ?? prev.page,
        };
        updateSearchParams(next);
        return next;
      });
    },
    [updateSearchParams]
  );

  const handleSearchSubmit = useCallback(