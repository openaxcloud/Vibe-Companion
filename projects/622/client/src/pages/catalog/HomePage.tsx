import React, { useCallback, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CardMedia,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Pagination,
  Select,
  SelectChangeEvent,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Stack,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  isFeatured?: boolean;
};

type ProductsResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

type Category = {
  id: string;
  name: string;
};

type SortOption = {
  value: string;
  label: string;
};

const PAGE_SIZE = 12;

const SORT_OPTIONS: SortOption[] = [
  { value: "featured_desc", label: "Featured" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "name_asc", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
  { value: "newest_desc", label: "Newest" },
];

const fetchProducts = async (
  search: string,
  category: string,
  sort: string,
  page: number,
  pageSize: number
): Promise<ProductsResponse> => {
  const params = new URLSearchParams();
  if (search.trim()) params.append("search", search.trim());
  if (category) params.append("category", category);
  if (sort) params.append("sort", sort);
  params.append("page", String(page));
  params.append("pageSize", String(pageSize));

  const response = await fetch(`/api/products?undefined`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch products");
  }

  const data = (await response.json()) as ProductsResponse;
  return data;
};

const fetchCategories = async (): Promise<Category[]> => {
  const response = await fetch("/api/categories", {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch categories");
  }

  const data = (await response.json()) as Category[];
  return data;
};

const HomePage: React.FC = () => {
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [sort, setSort] = useState<string>("featured_desc");
  const [page, setPage] = useState<number>(1);

  const {
    data: categories,
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
  } = useQuery<Category[], Error>({
    queryKey: ["categories"],
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: productsData,
    isLoading: isProductsLoading,
    isError: isProductsError,
    error: productsError,
  } = useQuery<ProductsResponse, Error>({
    queryKey: ["products", { search, category, sort, page, pageSize: PAGE_SIZE }],
    queryFn: () => fetchProducts(search, category, sort, page, PAGE_SIZE),
    keepPreviousData: true,
  });

  const totalPages = useMemo(
    () => (productsData ? Math.max(1, Math.ceil(productsData.total / PAGE_SIZE)) : 1),
    [productsData]
  );

  const handleSearchInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchInput(event.target.value);
    },
    []
  );

  const handleSearchSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setSearch(searchInput);
      setPage(1);
    },
    [searchInput]
  );

  const handleCategoryChange = useCallback((event: SelectChangeEvent<string>) => {
    setCategory(event.target.value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback((event: SelectChangeEvent<string>) => {
    setSort(event.target.value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback(
    (_event: React.ChangeEvent<unknown>, value: number) => {
      setPage(value);
    },
    []
  );

  const isLoading = isProductsLoading || isCategoriesLoading;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box display="flex" flexDirection="column" gap={3}>
        <Box display="flex" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
          <Typography variant="h4" component="h1" fontWeight={600}>
            Catalog
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Browse our selection of products. Use search and filters to find exactly what you need.
          </Typography>
        </Box>

        <Box
          component="form"
          onSubmit={handleSearchSubmit}
          display="flex"
          flexWrap="wrap"
          gap={2}
          alignItems="center"
        >
          <TextField
            label="Search products"
            variant="outlined"
            size="small"
            value={searchInput}
            onChange={handleSearchInputChange}
            sx={{ flex: { xs: "1 1 100%", sm: "1 1 40%" }, minWidth: 200 }}
          />

          <FormControl
            size="small"
            sx={{ minWidth: 160, flex: { xs: "1 1 45%", sm: "0 0 auto" } }}
          >
            <InputLabel id="category-filter-label">Category</InputLabel>
            <Select
              labelId="category-filter-label"
              value={category}
              label="Category"
              onChange={handleCategoryChange}
              disabled={isCategoriesLoading || isCategoriesError}
            >
              <MenuItem value="">
                <em>All Categories</em>
              </MenuItem>
              {categories?.map((cat) => (
                <MenuItem key={cat.id} value={cat.id}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl
            size="small"
            sx={{ minWidth: 180, flex: { xs: "1 1 45%", sm: "0 0 auto" } }}
          >
            <InputLabel id="sort-label">Sort by</InputLabel>
            <Select
              labelId="sort-label"
              value={sort}
              label="Sort by"
              onChange={handleSortChange}
            >
              {SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box
            sx={{
              flex: { xs: "1 1 100%", sm: "0 0 auto" },
              display: "flex",
              justifyContent: { xs: "flex-start", sm: "flex-end" },
            }}
          >
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={isLoading}
            >
              Search
            </Button>
          </Box>
        </Box>

        {isProductsError && (
          <Alert severity="error">
            {productsError?.message || "Unable to load products. Please try again later."}
          </Alert>
        )}

        <Box minHeight={200}>
          {isLoading ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={8}>
              <CircularProgress />
            </Box>
          ) : productsData && productsData.items.length === 0 ? (
            <Box display="flex" justifyContent="center" alignItems="center" py={8}>
              <Typography variant="body1" color="text.secondary">
                No products found. Try adjusting your search or filters.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={3}>
              {productsData?.items.map((product) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                  <Card
                    sx={{
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    {product.imageUrl && (
                      <CardMedia
                        component="img"
                        height="180"
                        image={product.imageUrl}
                        alt={product.name}
                        sx={{ objectFit: "cover" }}
                      />
                    )}
                    <CardContent