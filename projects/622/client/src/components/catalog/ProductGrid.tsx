import React, { FC, ReactNode, useMemo } from "react";
import type { CSSProperties } from "react";
import ProductCard from "./ProductCard";

export type Product = {
  id: string | number;
  name: string;
  imageUrl?: string;
  price?: number;
  currency?: string;
  description?: string;
  [key: string]: unknown;
};

export type ProductGridLayout = {
  minCardWidth?: number;
  maxCardWidth?: number;
  gap?: number;
  alignItems?: CSSProperties["alignItems"];
  justifyItems?: CSSProperties["justifyItems"];
  justifyContent?: CSSProperties["justifyContent"];
  rowGap?: number;
  columnGap?: number;
};

export type ProductGridProps = {
  products: Product[];
  layout?: ProductGridLayout;
  isLoading?: boolean;
  loadingCount?: number;
  className?: string;
  style?: CSSProperties;
  renderProductCard?: (product: Product, index: number) => ReactNode;
  emptyState?: ReactNode;
  loadingState?: ReactNode;
  ariaLabel?: string;
};

const DEFAULT_LAYOUT: Required<Pick<ProductGridLayout, "minCardWidth" | "maxCardWidth" | "gap">> =
  {
    minCardWidth: 220,
    maxCardWidth: 1,
    gap: 16,
  };

const ProductGrid: FC<ProductGridProps> = ({
  products,
  layout,
  isLoading = false,
  loadingCount = 8,
  className,
  style,
  renderProductCard,
  emptyState,
  loadingState,
  ariaLabel = "Product catalog",
}) => {
  const hasProducts = products && products.length > 0;

  const {
    minCardWidth,
    maxCardWidth,
    gap,
    alignItems,
    justifyItems,
    justifyContent,
    rowGap,
    columnGap,
  } = {
    ...DEFAULT_LAYOUT,
    ...layout,
  };

  const gridStyle: CSSProperties = useMemo(
    () => ({
      display: "grid",
      gridTemplateColumns: `repeat(auto-fill, minmax(undefinedpx, undefinedpx`}))`,
      gap,
      rowGap: rowGap ?? gap,
      columnGap: columnGap ?? gap,
      alignItems,
      justifyItems,
      justifyContent,
      width: "100%",
      ...style,
    }),
    [
      minCardWidth,
      maxCardWidth,
      gap,
      rowGap,
      columnGap,
      alignItems,
      justifyItems,
      justifyContent,
      style,
    ]
  );

  const renderLoadingSkeletons = () => {
    const count = loadingCount > 0 ? loadingCount : 1;
    const items = Array.from({ length: count });

    if (loadingState) {
      return loadingState;
    }

    return items.map((_, index) => (
      <div
        key={`product-skeleton-undefined`}
        aria-hidden="true"
        style={{
          borderRadius: 8,
          border: "1px solid #e5e7eb",
          padding: 12,
          backgroundColor: "#f9fafb",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          minHeight: 180,
        }}
      >
        <div
          style={{
            width: "100%",
            paddingBottom: "75%",
            borderRadius: 6,
            background:
              "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%)",
            backgroundSize: "400% 100%",
            animation: "pg-skeleton-pulse 1.4s ease infinite",
          }}
        />
        <div
          style={{
            height: 16,
            width: "80%",
            borderRadius: 4,
            background:
              "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%)",
            backgroundSize: "400% 100%",
            animation: "pg-skeleton-pulse 1.4s ease infinite",
          }}
        />
        <div
          style={{
            height: 14,
            width: "60%",
            borderRadius: 4,
            background:
              "linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 37%, #f3f4f6 63%)",
            backgroundSize: "400% 100%",
            animation: "pg-skeleton-pulse 1.4s ease infinite",
          }}
        />
      </div>
    ));
  };

  const renderEmptyState = () => {
    if (emptyState) return emptyState;

    return (
      <div
        style={{
          textAlign: "center",
          padding: "3rem 1rem",
          color: "#6b7280",
          width: "100%",
        }}
      >
        <p style={{ margin: 0, fontSize: 16 }}>No products found.</p>
      </div>
    );
  };

  return (
    <section
      aria-label={ariaLabel}
      aria-busy={isLoading}
      className={className}
      style={{ width: "100%", ...(!hasProducts && !isLoading ? { display: "flex", justifyContent: "center" } : {}), ...style }}
    >
      <style>
        {`
          @keyframes pg-skeleton-pulse {
            0% {
              background-position: 200% 0;
            }
            100% {
              background-position: -200% 0;
            }
          }
        `}
      </style>

      {isLoading && !hasProducts ? (
        <div style={gridStyle}>{renderLoadingSkeletons()}</div>
      ) : !hasProducts ? (
        renderEmptyState()
      ) : (
        <div style={gridStyle}>
          {products.map((product, index) =>
            renderProductCard ? (
              <React.Fragment key={String(product.id) || index}>
                {renderProductCard(product, index)}
              </React.Fragment>
            ) : (
              <ProductCard key={String(product.id) || index} product={product} />
            )
          )}
        </div>
      )}
    </section>
  );
};

export default ProductGrid;