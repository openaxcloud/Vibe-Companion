import React, { useCallback, useEffect, useMemo, useState } from "react";

export type ProductSortField = "name" | "price" | "rating" | "newest";
export type ProductSortDirection = "asc" | "desc";

export interface Product {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number | null;
  rating?: number | null; // 0-5
  reviewCount?: number | null;
  isNew?: boolean;
  isOnSale?: boolean;
  category?: string;
  tags?: string[];
  inStock?: boolean;
}

export interface ProductGridProps {
  products: Product[];
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  defaultSortField?: ProductSortField;
  defaultSortDirection?: ProductSortDirection;
  categories?: string[];
  tags?: string[];
  showFilters?: boolean;
  showSort?: boolean;
  showPagination?: boolean;
  loading?: boolean;
  error?: string | null;
  onProductClick?: (product: Product) => void;
  onSortChange?: (field: ProductSortField, direction: ProductSortDirection) => void;
  onFilterChange?: (filters: {
    category: string | "all";
    inStockOnly: boolean;
    tag: string | "all";
  }) => void;
  className?: string;
  emptyStateMessage?: string;
}

interface InternalFilters {
  category: string | "all";
  inStockOnly: boolean;
  tag: string | "all";
}

interface PaginationState {
  page: number;
  pageSize: number;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [12, 24, 48];
const DEFAULT_PAGE_SIZE = 12;

const sortProducts = (
  items: Product[],
  field: ProductSortField,
  direction: ProductSortDirection
): Product[] => {
  const sorted = [...items].sort((a, b) => {
    switch (field) {
      case "name": {
        const an = a.name.toLowerCase();
        const bn = b.name.toLowerCase();
        if (an < bn) return -1;
        if (an > bn) return 1;
        return 0;
      }
      case "price": {
        return a.price - b.price;
      }
      case "rating": {
        const ar = a.rating ?? 0;
        const br = b.rating ?? 0;
        return ar - br;
      }
      case "newest": {
        // Fallback: treat newer (isNew = true) as "larger"
        const an = a.isNew ? 1 : 0;
        const bn = b.isNew ? 1 : 0;
        return an - bn;
      }
      default:
        return 0;
    }
  });

  if (direction === "desc") {
    sorted.reverse();
  }
  return sorted;
};

const filterProducts = (items: Product[], filters: InternalFilters): Product[] => {
  return items.filter((product) => {
    if (filters.category !== "all" && product.category !== filters.category) {
      return false;
    }
    if (filters.inStockOnly && product.inStock === false) {
      return false;
    }
    if (filters.tag !== "all") {
      const productTags = product.tags ?? [];
      if (!productTags.includes(filters.tag)) {
        return false;
      }
    }
    return true;
  });
};

const clampPage = (page: number, totalPages: number): number => {
  if (totalPages <= 0) return 1;
  if (page < 1) return 1;
  if (page > totalPages) return totalPages;
  return page;
};

const ProductCard: React.FC<{
  product: Product;
  onClick?: (product: Product) => void;
}> = ({ product, onClick }) => {
  const handleClick = useCallback(() => {
    if (onClick) {
      onClick(product);
    }
  }, [onClick, product]);

  const hasDiscount =
    product.originalPrice != null &&
    product.originalPrice > product.price;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
            No image
          </div>
        )}
        {(product.isNew || product.isOnSale) && (
          <div className="absolute left-2 top-2 flex gap-1">
            {product.isNew && (
              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">
                New
              </span>
            )}
            {product.isOnSale && (
              <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white">
                Sale
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3 sm:p-4">
        <div className="flex-1">
          <h3 className="line-clamp-2 text-sm font-medium text-gray-900 sm:text-base">
            {product.name}
          </h3>
          {product.description && (
            <p className="mt-1 line-clamp-2 text-xs text-gray-500 sm:text-sm">
              {product.description}
            </p>
          )}
        </div>
        <div className="mt-1 flex items-end justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-semibold text-gray-900 sm:text-lg">
                undefined
              </span>
              {hasDiscount && (
                <span className="text-xs text-gray-400 line-through sm:text-sm">
                  undefined
                </span>
              )}
            </div>
            {product.rating != null && (
              <div className="mt-1 flex items-center gap-1 text-xs text-amber-500 sm:text-sm">
                <span className="font-medium">{product.rating.toFixed(1)}</span>
                <span className="text-gray-300">•</span>
                <span className="text-gray-500">
                  {product.reviewCount != null ? `undefined reviews` : "Rated"}
                </span>
              </div>
            )}
          </div>
          {product.inStock === false ? (
            <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-500">
              Out of stock
            </span>
          ) : (
            <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              In stock
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const ProductGrid: React.FC<ProductGridProps> = ({
  products,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  defaultSortField = "name",
  defaultSortDirection = "asc",
  categories,
  tags,
  showFilters = true,
  showSort = true,
  showPagination = true,
  loading = false,
  error = null,
  onProductClick,
  onSortChange,
  onFilterChange,
  className,
  emptyStateMessage = "No products found.",
}) => {
  const [sortField, setSortField] = useState<ProductSortField>(defaultSortField);
  const [sortDirection, setSortDirection] = useState<ProductSortDirection>(defaultSortDirection);
  const [filters, setFilters] = useState<InternalFilters>({
    category: "all",
    inStockOnly: false,
    tag: "all",
  });
  const [pagination, setPagination] = useState<PaginationState>({
    page: 1,
    pageSize: defaultPageSize,
  });

  useEffect(() => {
    if (onSortChange) {
      onSortChange(sortField, sortDirection);
    }
  }, [sortField, sortDirection, onSortChange]);

  useEffect(() => {
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters, onFilterChange]);

  useEffect(() => {
    setPagination((prev) => ({ ...prev, page: 1 }));
  }, [filters, sortField, sortDirection, pagination.pageSize]);

  const derivedCategories = useMemo(() => {
    if (