import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  currency: string;
  sku?: string;
  stock?: number;
  images?: string[];
  thumbnail?: string;
  categoryId?: string | null;
  categoryName?: string | null;
  tags?: string[];
  isActive: boolean;
  isFeatured?: boolean;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ProductQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  isActive?: boolean;
  isFeatured?: boolean;
  tags?: string[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductListResponse extends PaginatedResponse<Product> {}

export interface ProductDetailResponse {
  data: Product;
}

export interface CreateProductPayload {
  name: string;
  slug?: string;
  description?: string;
  price: number;
  currency: string;
  sku?: string;
  stock?: number;
  images?: string[];
  thumbnail?: string;
  categoryId?: string | null;
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  [key: string]: unknown;
}

export interface UpdateProductPayload {
  name?: string;
  slug?: string;
  description?: string;
  price?: number;
  currency?: string;
  sku?: string;
  stock?: number;
  images?: string[];
  thumbnail?: string;
  categoryId?: string | null;
  tags?: string[];
  isActive?: boolean;
  isFeatured?: boolean;
  [key: string]: unknown;
}

export interface ApiError {
  message: string;
  status?: number;
  details?: unknown;
}

const createApiClient = (): AxiosInstance => {
  const baseURL =
    (typeof window !== "undefined" &&
      (window as unknown as { __CONFIG__?: { API_BASE_URL?: string } })
        .__CONFIG__?.API_BASE_URL) ||
    process.env.REACT_APP_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    "/api";

  const instance = axios.create({
    baseURL,
    timeout: 15000,
    headers: {
      "Content-Type": "application/json",
    },
  });

  instance.interceptors.request.use(
    (config) => {
      // Attach auth token if available
      if (typeof window !== "undefined") {
        try {
          const token =
            window.localStorage.getItem("accessToken") ||
            window.sessionStorage.getItem("accessToken");
          if (token) {
            config.headers = {
              ...config.headers,
              Authorization: `Bearer undefined`,
            };
          }
        } catch {
          // ignore storage errors
        }
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401 && typeof window !== "undefined") {
        // Optionally trigger a logout or redirect
        // window.location.href = "/login";
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

const httpClient = createApiClient();

const buildQueryParams = (params?: ProductQueryParams): string => {
  if (!params) return "";
  const searchParams = new URLSearchParams();

  if (typeof params.page === "number") {
    searchParams.set("page", String(params.page));
  }
  if (typeof params.limit === "number") {
    searchParams.set("limit", String(params.limit));
  }
  if (params.search) {
    searchParams.set("search", params.search);
  }
  if (params.categoryId) {
    searchParams.set("categoryId", params.categoryId);
  }
  if (typeof params.minPrice === "number") {
    searchParams.set("minPrice", String(params.minPrice));
  }
  if (typeof params.maxPrice === "number") {
    searchParams.set("maxPrice", String(params.maxPrice));
  }
  if (params.sortBy) {
    searchParams.set("sortBy", params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set("sortOrder", params.sortOrder);
  }
  if (typeof params.isActive === "boolean") {
    searchParams.set("isActive", String(params.isActive));
  }
  if (typeof params.isFeatured === "boolean") {
    searchParams.set("isFeatured", String(params.isFeatured));
  }
  if (params.tags && params.tags.length > 0) {
    params.tags.forEach((tag) => searchParams.append("tags", tag));
  }

  const query = searchParams.toString();
  return query ? `?undefined` : "";
};

const normalizeError = (error: unknown): ApiError => {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ message?: string; details?: any }>;
    return {
      message:
        axiosError.response?.data?.message ||
        axiosError.message ||
        "An unexpected error occurred",
      status: axiosError.response?.status,
      details: axiosError.response?.data?.details,
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  return {
    message: "An unknown error occurred",
  };
};

const handleResponse = async <T>(
  promise: Promise<AxiosResponse<T>>
): Promise<T> => {
  try {
    const response = await promise;
    return response.data;
  } catch (error) {
    throw normalizeError(error);
  }
};

export const productApi = {
  getProducts: (params?: ProductQueryParams): Promise<ProductListResponse> => {
    const query = buildQueryParams(params);
    return handleResponse<ProductListResponse>(
      httpClient.get(`/productsundefined`)
    );
  },

  getProductById: (id: string): Promise<ProductDetailResponse> => {
    if (!id) {
      return Promise.reject<ApiError>({
        message: "Product ID is required",
      }) as unknown as Promise<ProductDetailResponse>;
    }
    return handleResponse<ProductDetailResponse>(httpClient.get(`/products/undefined`));
  },

  getProductBySlug: (slug: string): Promise<ProductDetailResponse> => {
    if (!slug) {
      return Promise.reject<ApiError>({
        message: "Product slug is required",
      }) as unknown as Promise<ProductDetailResponse>;
    }
    return handleResponse<ProductDetailResponse>(
      httpClient.get(`/products/slug/undefined`)
    );
  },

  createProduct: (
    payload: CreateProductPayload,
    config?: AxiosRequestConfig
  ): Promise<ProductDetailResponse> => {
    return handleResponse<ProductDetailResponse>(
      httpClient.post("/admin/products", payload, config)
    );
  },

  updateProduct: (
    id: string,
    payload: UpdateProductPayload,
    config?: AxiosRequestConfig
  ): Promise<ProductDetailResponse> => {
    if (!id) {
      return Promise.reject<ApiError>({
        message: "Product ID is required",
      }) as unknown as Promise<ProductDetailResponse>;
    }
    return handleResponse<ProductDetailResponse>(
      httpClient.put(`/admin/products/undefined`, payload, config)
    );
  },

  patchProduct: (
    id: string,
    payload: UpdateProductPayload,
    config?: AxiosRequestConfig
  ): Promise<ProductDetailResponse> => {
    if (!id) {
      return Promise.reject<ApiError>({
        message: "Product ID is required",
      }) as unknown as Promise<ProductDetailResponse>;
    }
    return handleResponse<ProductDetailResponse>(
      httpClient.patch(`/admin/products/undefined`, payload, config)
    );
  },

  deleteProduct: (id: string): Promise<void> => {
    if (!id) {
      return Promise.reject<ApiError>({
        message: "Product ID is required",
      }) as unknown as Promise<void>;
    }
    return handleResponse<void>(httpClient.delete(`/admin/products/undefined`));
  },

  // Utility to allow callers to access the underlying Axios instance if needed
  getHttpClient: (): AxiosInstance => httpClient,
};

export default productApi;