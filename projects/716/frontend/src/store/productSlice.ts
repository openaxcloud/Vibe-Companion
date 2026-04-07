import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from './store';

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  category?: string;
  tags?: string[];
  inStock?: boolean;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ProductFilters {
  category?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  inStock?: boolean | null;
  tags?: string[];
}

export interface ProductSort {
  field: 'name' | 'price' | 'createdAt';
  direction: 'asc' | 'desc';
}

export interface ProductListMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ProductState {
  items: Product[];
  selectedProduct: Product | null;
  loadingList: boolean;
  loadingSelected: boolean;
  errorList: string | null;
  errorSelected: string | null;
  searchTerm: string;
  filters: ProductFilters;
  sort: ProductSort;
  pagination: {
    page: number;
    pageSize: number;
  };
}

export interface FetchProductsParams {
  page?: number;
  pageSize?: number;
  searchTerm?: string;
  filters?: ProductFilters;
  sort?: ProductSort;
}

export interface FetchProductsResponse {
  data: Product[];
  meta: ProductListMeta;
}

export interface FetchProductByIdParams {
  id: string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '/api';

const initialState: ProductState = {
  items: [],
  selectedProduct: null,
  loadingList: false,
  loadingSelected: false,
  errorList: null,
  errorSelected: null,
  searchTerm: '',
  filters: {
    category: null,
    minPrice: null,
    maxPrice: null,
    inStock: null,
    tags: [],
  },
  sort: {
    field: 'name',
    direction: 'asc',
  },
  pagination: {
    page: 1,
    pageSize: 12,
  },
};

const buildQueryString = (params: Record<string, unknown>): string => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      (typeof value === 'string' && value.trim() === '') ||
      (Array.isArray(value) && value.length === 0)
    ) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((v) => searchParams.append(key, String(v)));
    } else {
      searchParams.append(key, String(value));
    }
  });
  const query = searchParams.toString();
  return query ? `?undefined` : '';
};

export const fetchProducts = createAsyncThunk<
  FetchProductsResponse,
  FetchProductsParams | void,
  { state: RootState }
>('products/fetchProducts', async (paramsArg, thunkAPI) => {
  const state = thunkAPI.getState().products;
  const params: FetchProductsParams = {
    page: state.pagination.page,
    pageSize: state.pagination.pageSize,
    searchTerm: state.searchTerm || undefined,
    filters: state.filters,
    sort: state.sort,
    ...paramsArg,
  };

  const query = buildQueryString({
    page: params.page,
    pageSize: params.pageSize,
    search: params.searchTerm,
    category: params.filters?.category || undefined,
    minPrice: params.filters?.minPrice || undefined,
    maxPrice: params.filters?.maxPrice || undefined,
    inStock:
      typeof params.filters?.inStock === 'boolean'
        ? params.filters?.inStock
        : undefined,
    tags: params.filters?.tags && params.filters.tags.length > 0 ? params.filters.tags : undefined,
    sortField: params.sort?.field,
    sortDirection: params.sort?.direction,
  });

  const response = await fetch(`undefined/productsundefined`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const message = `Failed to fetch products: undefined undefined`;
    throw new Error(message);
  }

  const json = (await response.json()) as FetchProductsResponse;
  return json;
});

export const fetchProductById = createAsyncThunk<Product, FetchProductByIdParams>(
  'products/fetchProductById',
  async ({ id }) => {
    const response = await fetch(`undefined/products/undefined`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const message = `Failed to fetch product: undefined undefined`;
      throw new Error(message);
    }

    const json = (await response.json()) as Product;
    return json;
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setSearchTerm(state, action: PayloadAction<string>) {
      state.searchTerm = action.payload;
      state.pagination.page = 1;
    },
    setFilters(state, action: PayloadAction<Partial<ProductFilters>>) {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
      state.pagination.page = 1;
    },
    clearFilters(state) {
      state.filters = initialState.filters;
      state.pagination.page = 1;
    },
    setSort(state, action: PayloadAction<ProductSort>) {
      state.sort = action.payload;
      state.pagination.page = 1;
    },
    setPage(state, action: PayloadAction<number>) {
      state.pagination.page = action.payload;
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pagination.pageSize = action.payload;
      state.pagination.page = 1;
    },
    setSelectedProduct(state, action: PayloadAction<Product | null>) {
      state.selectedProduct = action.payload;
      state.errorSelected = null;
    },
    clearSelectedProduct(state) {
      state.selectedProduct = null;
      state.errorSelected = null;
    },
    resetProductState() {
      return initialState;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loadingList = true;
        state.errorList = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loadingList = false;
        state.items = action.payload.data;
        state.pagination.page = action.payload.meta.page;
        state.pagination.pageSize = action.payload.meta.pageSize;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loadingList = false;
        state.errorList = action.error.message || 'Failed to load products';
      })
      .addCase(fetchProductById.pending, (state) => {
        state.loadingSelected = true;
        state.errorSelected = null;
      })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loadingSelected = false;
        state.selectedProduct = action.payload;
      })
      .addCase(fetchProductById.rejected, (state, action) => {
        state.loadingSelected = false;
        state.errorSelected = action.error.message || 'Failed to load product';
      });
  },
});

export const {
  setSearchTerm,
  setFilters,
  clearFilters,
  setSort,
  setPage,
  setPageSize,
  setSelectedProduct,
  clearSelectedProduct,
  resetProductState,
} = productSlice.actions;

export const selectProductsState = (state: RootState): ProductState => state.products;

export const selectProducts = (state: RootState): Product[] => state.products.items;

export const selectSelectedProduct = (state: RootState): Product | null =>
  state.products.selectedProduct;

export const selectProductLoadingList = (state: RootState): boolean =>
  state.products.loadingList;

export const selectProductLoadingSelected = (state: RootState): boolean =>
  state.products.loadingSelected;

export const selectProductErrorList = (state: RootState): string | null =>
  state.products.errorList;

export const selectProductErrorSelected = (state: RootState): string | null =>
  state.products.errorSelected;

export const selectProductSearchTerm = (state: RootState): string =>
  state.products.searchTerm;

export const selectProductFilters = (state: RootState): ProductFilters =>
  state.products.filters;

export const selectProductSort = (state: RootState): ProductSort =>
  state.products.sort;

export const selectProductPagination = (
  state: RootState
): ProductState['pagination'] => state.products.pagination;

export default productSlice.reducer;