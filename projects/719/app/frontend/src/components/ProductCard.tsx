import React, { memo, useCallback } from "react";

export type Product = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  imageAlt?: string;
  rating?: number; // 0–5
  ratingCount?: number;
  currency?: string;
  isOutOfStock?: boolean;
  isInCart?: boolean;
};

export type ProductCardProps = {
  product: Product;
  onAddToCart?: (productId: string) => void;
  onCardClick?: (productId: string) => void;
  className?: string;
  showRating?: boolean;
  showAddToCart?: boolean;
  disabled?: boolean;
};

const formatPrice = (value: number, currency: string = "USD"): string => {
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
  if (rating < 0) return 0;
  if (rating > 5) return 5;
  return rating;
};

const getRatingStars = (rating?: number): Array<"full" | "half" | "empty"> => {
  const r = clampRating(rating);
  const stars: Array<"full" | "half" | "empty"> = [];
  const full = Math.floor(r);
  const hasHalf = r - full >= 0.25 && r - full < 0.75;
  const roundedUp = r - full >= 0.75;

  for (let i = 0; i < 5; i += 1) {
    if (i < full) {
      stars.push("full");
    } else if (i === full && (hasHalf || roundedUp)) {
      stars.push(hasHalf ? "half" : "full");
    } else {
      stars.push("empty");
    }
  }

  return stars;
};

const mergeClassNames = (...classes: Array<string | false | null | undefined>): string =>
  classes.filter(Boolean).join(" ");

const ProductCard: React.FC<ProductCardProps> = memo(
  ({
    product,
    onAddToCart,
    onCardClick,
    className,
    showRating = true,
    showAddToCart = true,
    disabled = false,
  }) => {
    const {
      id,
      title,
      price,
      imageUrl,
      imageAlt,
      rating,
      ratingCount,
      currency = "USD",
      isOutOfStock,
      isInCart,
    } = product;

    const handleCardClick = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!onCardClick) return;

        const target = event.target as HTMLElement | null;
        if (target && target.closest("button")) {
          return;
        }

        onCardClick(id);
      },
      [id, onCardClick]
    );

    const handleAddToCartClick = useCallback(
      (event: React.MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (disabled || isOutOfStock || !onAddToCart) return;
        onAddToCart(id);
      },
      [disabled, id, isOutOfStock, onAddToCart]
    );

    const isButtonDisabled = disabled || isOutOfStock;
    const ratingStars = showRating ? getRatingStars(rating) : [];

    return (
      <div
        role={onCardClick ? "button" : "group"}
        tabIndex={onCardClick ? 0 : -1}
        onClick={onCardClick ? handleCardClick : undefined}
        onKeyDown={
          onCardClick
            ? (event: React.KeyboardEvent<HTMLDivElement>) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  handleCardClick(event as unknown as React.MouseEvent<HTMLDivElement>);
                }
              }
            : undefined
        }
        aria-disabled={disabled || undefined}
        className={mergeClassNames(
          "group relative flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden transition-transform transition-shadow duration-150 ease-out hover:shadow-md hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-500",
          disabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
          className
        )}
      >
        <div className="relative aspect-[4/3] w-full bg-gray-100 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={imageAlt || title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-200 ease-out group-hover:scale-105"
          />
          {isOutOfStock && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-800">
                Out of stock
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <div className="mb-2 line-clamp-2 text-sm font-medium text-gray-900 sm:text-base">
            {title}
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-base font-semibold text-gray-900 sm:text-lg">
              {formatPrice(price, currency)}
            </div>

            {showRating && (
              <div className="flex items-center gap-1" aria-label={rating ? `Rated undefined out of 5` : "Not yet rated"}>
                <div className="flex items-center">
                  {ratingStars.map((type, index) => {
                    const key = `undefined-star-undefined`;
                    const commonClasses = "h-4 w-4 text-yellow-400";
                    if (type === "full") {
                      return (
                        <svg
                          key={key}
                          className={commonClasses}
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.18 3.622a1 1 0 00.95.69h3.81c.969 0 1.371 1.24.588 1.81l-3.082 2.24a1 1 0 00-.364 1.118l1.18 3.623c.3.921-.755 1.688-1.54 1.118L10 13.347l-3.673 2.801c-.784.57-1.838-.197-1.539-1.118l1.18-3.623a1 1 0 00-.364-1.118L2.522 9.05c-.783-.57-.38-1.81.588-1.81h3.81a1 1 0 00.95-.69l1.18-3.622z" />
                        </svg>
                      );
                    }
                    if (type === "half") {
                      return (
                        <span key={key} className="relative inline-flex h-4 w-4">
                          <svg
                            className={mergeClassNames("absolute inset-0", commonClasses)}
                            viewBox="0 0 20 20"
                            fill="none"
                            aria-hidden="true"
                          >
                            <defs>
                              <linearGradient id={`undefined-gradient`}>
                                <stop offset="50%" stopColor="currentColor" />
                                <stop offset="50%" stopColor="transparent" />
                              </linearGradient>
                            </defs>
                            <path
                              d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.18 3.622a1 1 0 00.95.69h3.81c.969 0 1.371 1.24.588 1.81l-3.082 2.24a1 1 0 00-.364 1.118l1.18 3.623c.3.921-.755 1.688-1.54 1.118L10 13.347l-3.673 2.801c-.784.57-1.838-.197-1.539-1.118l1.18-3.623a1 1 0 00-.364-1.118L2.522 9.05c-.783-.57-.38-1.81.588-1.81h3.81a1 1 0 00.95