import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category: string;
  tags?: string[];
  inStock?: boolean;
  [key: string]: unknown;
}

export interface ProductFilters {
  category: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  tags: string[];
  inStockOnly: boolean;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  total: number;
}

export interface ProductsQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  category?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  tags?: string[];
  inStockOnly?: boolean;
}

export interface ProductListResponse {
  items: Product[];
  total: number;
}

export interface ProductDetailResponse extends Product {}

export interface ProductState {
  items: Product[];
  categories: string[];
  searchTerm: string;
  filters: ProductFilters;
  pagination: PaginationState;
  selectedProduct: Product | null;
  loadingList: boolean;
  loadingDetail: boolean;
  errorList: string | null;
  errorDetail: string | null;
}

const DEFAULT_PAGE_SIZE = 20;

const initialState: ProductState = {
  items: [],
  categories: [],
  searchTerm: '',
  filters: {
    category: null,
    minPrice: null,
    maxPrice: null,
    tags: [],
    inStockOnly: false,
  },
  pagination: {
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  },
  selectedProduct: null,
  loadingList: false,
  loadingDetail: false,
  errorList: null,
  errorDetail: null,
};

const buildQueryString = (params: ProductsQueryParams): string => {
  const query = new URLSearchParams();

  if (typeof params.page === 'number') query.set('page', String(params.page));
  if (typeof params.pageSize === 'number') query.set('pageSize', String(params.pageSize));
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (typeof params.minPrice === 'number') query.set('minPrice', String(params.minPrice));
  if (typeof params.maxPrice === 'number') query.set('maxPrice', String(params.maxPrice));
  if (params.tags && params.tags.length > 0) query.set('tags', params.tags.join(','));
  if (params.inStockOnly) query.set('inStockOnly', 'true');

  const queryString = query.toString();
  return queryString ? `?undefined` : '';
};

export const fetchProducts = createAsyncThunk<
  ProductListResponse,
  void,
  { state: RootState; rejectValue: string }
>('products/fetchProducts', async (_arg, thunkApi) => {
  const state = thunkApi.getState();
  const { pagination, searchTerm, filters } = state.products;

  const params: ProductsQueryParams = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    search: searchTerm || undefined,
    category: filters.category,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    tags: filters.tags,
    inStockOnly: filters.inStockOnly,
  };

  const queryString = buildQueryString(params);

  try {
    const res = await fetch(`/api/productsundefined`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return thunkApi.rejectWithValue(text || 'Failed to fetch products');
    }

    const data = (await res.json()) as ProductListResponse;
    return data;
  } catch (error) {
    return thunkApi.rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch products'
    );
  }
});

export const fetchProductById = createAsyncThunk<
  ProductDetailResponse,
  string,
  { rejectValue: string }
>('products/fetchProductById', async (productId, thunkApi) => {
  try {
    const res = await fetch(`/api/products/undefined`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return thunkApi.rejectWithValue(text || 'Failed to fetch product details');
    }

    const data = (await res.json()) as ProductDetailResponse;
    return data;
  } catch (error) {
    return thunkApi.rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch product details'
    );
  }
});

export const fetchProductCategories = createAsyncThunk<
  string[],
  void,
  { rejectValue: string }
>('products/fetchProductCategories', async (_arg, thunkApi) => {
  try {
    const res = await fetch('/api/products/categories', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return thunkApi.rejectWithValue(text || 'Failed to fetch product categories');
    }

    const data = (await res.json()) as string[];
    return data;
  } catch (error) {
    return thunkApi.rejectWithValue(
      error instanceof Error ? error.message : 'Failed to fetch product categories'
    );
  }
});

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setSearchTerm(state, action: PayloadAction<string>) {
      state.searchTerm = action.payload;
      state.pagination.page = 1;
    },
    setCategoryFilter(state, action: PayloadAction<string | null>) {
      state.filters.category = action.payload;
      state.pagination.page = 1;
    },
    setPriceFilter(
      state,
      action: PayloadAction<{ minPrice: number | null; maxPrice: number | null }>
    ) {
      state.filters.minPrice = action.payload.minPrice;
      state.filters.maxPrice = action.payload.maxPrice;
      state.pagination.page = 1;
    },
    setTagsFilter(state, action: PayloadAction<string[]>) {
      state.filters.tags = action.payload;
      state.pagination.page = 1;
    },
    setInStockOnly(state, action: PayloadAction<boolean>) {
      state.filters.inStockOnly = action.payload;
      state.pagination.page = 1;
    },
    resetFilters(state) {
      state.filters = initialState.filters;
      state.searchTerm = '';
      state.pagination.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.pagination.page = action.payload;
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pagination.pageSize = action.payload;
      state.pagination.page = 1;
    },
    clearSelectedProduct(state) {
      state.selectedProduct = null;
      state.errorDetail = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchProducts
      .addCase(fetchProducts.pending, (state) => {
        state.loadingList = true;
        state.errorList = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loadingList = false;
        state.items = action.payload.items;
        state.pagination.total = action.payload.total;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loadingList = false;
        state.errorList = action.payload ?? 'Failed to fetch products';
      })
      // fetchProductById
      .addCase(fetchProductById.pending, (state) => {
        state.loadingDetail = true;
        state.errorDetail = null;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loadingDetail = false;
        state.selectedProduct = action.payload;
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.loadingDetail = false;
        state.errorDetail = action.payload ?? 'Failed to fetch product details';
      })
      // fetchProductCategories
      .addCase(fetchProductCategories.fulfilled, (state, action) => {
        state.categories = action.payload;
      })
      .addCase(fetchProductCategories.rejected, (state, action) => {
        // Do not treat category errors as fatal for main flow; optionally log via errorList
        state.errorList = action.payload ?? state.errorList;
      });
  },
});

export const {
  setSearchTerm,
  setCategoryFilter,
  setPriceFilter,
  setTagsFilter,
  setInStockOnly,
  resetFilters,
  setPage,
  setPageSize,
  clearSelectedProduct,
} = productSlice.actions;

export const selectProductsState = (state: RootState): ProductState => state.products;
export const selectProducts = (state: RootState): Product[] => state.products.items;
export const selectProductCategories = (state: RootState): string[] =>
  state.products.categories;
export const selectSearchTerm