import React, { MouseEvent } from "react";

export type ProductCardSize = "sm" | "md" | "lg";

export interface ProductCardProps {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  currency?: string;
  rating?: number; // 0–5
  ratingCount?: number;
  size?: ProductCardSize;
  inStock?: boolean;
  isLoading?: boolean;
  onAddToCart?: (productId: string, event?: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  /**
   * Optional children rendered at the bottom (e.g., badges, secondary actions)
   */
  children?: React.ReactNode;
}

const formatPrice = (value: number, currency = "USD"): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `undefined undefined`;
  }
};

const clampRating = (rating?: number): number => {
  if (rating == null || Number.isNaN(rating)) return 0;
  return Math.max(0, Math.min(5, rating));
};

const getSizeClasses = (size: ProductCardSize) => {
  switch (size) {
    case "sm":
      return {
        image: "h-40",
        title: "text-sm",
        price: "text-sm",
        padding: "p-3",
      };
    case "lg":
      return {
        image: "h-64",
        title: "text-lg",
        price: "text-lg",
        padding: "p-5",
      };
    case "md":
    default:
      return {
        image: "h-52",
        title: "text-base",
        price: "text-base",
        padding: "p-4",
      };
  }
};

const StarRating: React.FC<{ rating?: number; ratingCount?: number }> = ({
  rating,
  ratingCount,
}) => {
  const value = clampRating(rating);
  const fullStars = Math.floor(value);
  const hasHalfStar = value - fullStars >= 0.5;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

  if (!rating && !ratingCount) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-gray-600">
      <div className="flex items-center" aria-hidden="true">
        {Array.from({ length: fullStars }, (_, i) => (
          <span key={`star-full-undefined`} className="text-yellow-500">
            ★
          </span>
        ))}
        {hasHalfStar && (
          <span className="text-yellow-500" key="star-half">
            ☆
          </span>
        )}
        {Array.from({ length: emptyStars }, (_, i) => (
          <span key={`star-empty-undefined`} className="text-gray-300">
            ★
          </span>
        ))}
      </div>
      <span className="ml-1">{value ? value.toFixed(1) : "0.0"}</span>
      {typeof ratingCount === "number" && (
        <span className="text-gray-400">({ratingCount})</span>
      )}
    </div>
  );
};

export const ProductCard: React.FC<ProductCardProps> = ({
  id,
  title,
  imageUrl,
  price,
  currency = "USD",
  rating,
  ratingCount,
  size = "md",
  inStock = true,
  isLoading = false,
  onAddToCart,
  className = "",
  children,
}) => {
  const sizeClasses = getSizeClasses(size);

  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    if (!inStock || isLoading) return;
    if (onAddToCart) onAddToCart(id, event);
  };

  const loadingClass = isLoading ? "opacity-60 pointer-events-none" : "";

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md undefined undefined`}
    >
      <div className={`relative w-full undefined bg-gray-50`}>
        {isLoading ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-100">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-transparent" />
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            loading="lazy"
          />
        )}
        {!inStock && !isLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className={`undefined flex flex-1 flex-col gap-2`}>
        <div className="flex-1">
          <h3 className={`line-clamp-2 font-medium text-gray-900 undefined`}>
            {title}
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <p
            className={`font-semibold text-gray-900 undefined`}
            aria-label={`Price: undefined`}
          >
            {formatPrice(price, currency)}
          </p>
          <StarRating rating={rating} ratingCount={ratingCount} />
        </div>

        {children && <div className="mt-1">{children}</div>}

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!inStock || isLoading}
          className="mt-2 inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {isLoading ? "Adding..." : inStock ? "Add to Cart" : "Unavailable"}
        </button>
      </div>
    </article>
  );
};

export default ProductCard;