import React, { FC, ReactNode } from "react";
import "./ProductGrid.css";
import { ProductCard } from "./ProductCard";

export type Product = {
  id: string | number;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  inStock?: boolean;
  [key: string]: unknown;
};

type ProductGridProps = {
  products: Product[] | null | undefined;
  isLoading?: boolean;
  error?: string | null;
  onProductClick?: (product: Product) => void;
  renderEmptyState?: () => ReactNode;
  renderLoadingState?: () => ReactNode;
  gridAriaLabel?: string;
  className?: string;
  cardVariant?: "default" | "compact" | "comfortable";
};

const DefaultLoadingState: FC = () => (
  <div className="product-grid__loading" aria-busy="true" aria-live="polite">
    <div className="product-grid__spinner" />
    <span>Loading products…</span>
  </div>
);

const DefaultEmptyState: FC = () => (
  <div className="product-grid__empty" aria-live="polite">
    <p>No products found.</p>
  </div>
);

const ErrorState: FC<{ message: string }> = ({ message }) => (
  <div className="product-grid__error" role="alert">
    <p>Unable to load products.</p>
    <p className="product-grid__error-message">{message}</p>
  </div>
);

export const ProductGrid: FC<ProductGridProps> = ({
  products,
  isLoading = false,
  error = null,
  onProductClick,
  renderEmptyState,
  renderLoadingState,
  gridAriaLabel = "Products",
  className = "",
  cardVariant = "default",
}) => {
  const hasProducts = Array.isArray(products) && products.length > 0;

  if (error) {
    return <ErrorState message={error} />;
  }

  if (isLoading && !hasProducts) {
    if (renderLoadingState) {
      return <>{renderLoadingState()}</>;
    }
    return <DefaultLoadingState />;
  }

  if (!isLoading && (!products || products.length === 0)) {
    if (renderEmptyState) {
      return <>{renderEmptyState()}</>;
    }
    return <DefaultEmptyState />;
  }

  return (
    <section
      className={`product-grid__container undefined`.trim()}
      aria-label={gridAriaLabel}
    >
      <div className="product-grid">
        {products?.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            variant={cardVariant}
            onClick={onProductClick ? () => onProductClick(product) : undefined}
          />
        ))}
      </div>
      {isLoading && hasProducts && (
        <div className="product-grid__loading-inline" aria-busy="true">
          <div className="product-grid__spinner product-grid__spinner--inline" />
          <span>Loading more products…</span>
        </div>
      )}
    </section>
  );
};

export default ProductGrid;