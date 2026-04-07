import React, { useCallback, useMemo, useState } from "react";
import type { FC, MouseEvent } from "react";

type Product = {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  rating?: number;
  ratingCount?: number;
  currency?: string;
  isOutOfStock?: boolean;
};

type ProductCardProps = {
  product: Product;
  initialQuantity?: number;
  maxQuantity?: number;
  onAddToCart?: (product: Product, quantity: number) => void;
  onQuantityChange?: (product: Product, quantity: number) => void;
  className?: string;
  showRatingCount?: boolean;
  disableInteractions?: boolean;
};

const formatPrice = (value: number, currency: string = "USD"): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$undefined`;
  }
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const ProductCard: FC<ProductCardProps> = ({
  product,
  initialQuantity = 0,
  maxQuantity = 99,
  onAddToCart,
  onQuantityChange,
  className = "",
  showRatingCount = true,
  disableInteractions = false,
}) => {
  const [quantity, setQuantity] = useState<number>(
    clamp(initialQuantity, 0, maxQuantity)
  );
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const {
    id,
    title,
    imageUrl,
    price,
    rating,
    ratingCount,
    currency = "USD",
    isOutOfStock,
  } = product;

  const formattedPrice = useMemo(
    () => formatPrice(price, currency),
    [price, currency]
  );

  const handleQuantityUpdate = useCallback(
    (nextQuantity: number) => {
      const clamped = clamp(nextQuantity, 0, maxQuantity);
      setQuantity(clamped);
      if (onQuantityChange) {
        onQuantityChange(product, clamped);
      }
    },
    [maxQuantity, onQuantityChange, product]
  );

  const handleIncrement = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disableInteractions || isOutOfStock) return;
      handleQuantityUpdate(quantity + 1);
    },
    [disableInteractions, handleQuantityUpdate, isOutOfStock, quantity]
  );

  const handleDecrement = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (disableInteractions || isOutOfStock) return;
      handleQuantityUpdate(quantity - 1);
    },
    [disableInteractions, handleQuantityUpdate, isOutOfStock, quantity]
  );

  const handleAddToCart = useCallback(
    async (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (!onAddToCart || disableInteractions || isOutOfStock) return;

      const effectiveQuantity = quantity > 0 ? quantity : 1;
      const clampedQuantity = clamp(effectiveQuantity, 1, maxQuantity);

      setIsAdding(true);
      try {
        await Promise.resolve(onAddToCart(product, clampedQuantity));
        if (quantity === 0) {
          handleQuantityUpdate(clampedQuantity);
        }
      } finally {
        setIsAdding(false);
      }
    },
    [
      disableInteractions,
      handleQuantityUpdate,
      isOutOfStock,
      maxQuantity,
      onAddToCart,
      product,
      quantity,
    ]
  );

  const renderRating = () => {
    if (rating == null || rating <= 0) return null;

    const fullStars = Math.floor(rating);
    const hasHalfStar = rating - fullStars >= 0.25 && rating - fullStars < 0.75;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    const stars: JSX.Element[] = [];

    for (let i = 0; i < fullStars; i += 1) {
      stars.push(
        <span key={`full-undefined`} aria-hidden="true" className="text-yellow-400">
          ★
        </span>
      );
    }

    if (hasHalfStar) {
      stars.push(
        <span
          key="half"
          aria-hidden="true"
          className="text-yellow-400 relative inline-block"
        >
          <span className="text-gray-300">★</span>
          <span className="absolute left-0 top-0 w-1/2 overflow-hidden text-yellow-400">
            ★
          </span>
        </span>
      );
    }

    for (let i = 0; i < emptyStars; i += 1) {
      stars.push(
        <span key={`empty-undefined`} aria-hidden="true" className="text-gray-300">
          ★
        </span>
      );
    }

    return (
      <div className="flex items-center gap-1 text-xs" aria-label={`Rated undefined out of 5`}>
        <div className="flex items-center">{stars}</div>
        <span className="text-gray-700 font-medium">{rating.toFixed(1)}</span>
        {showRatingCount && ratingCount != null && ratingCount > 0 && (
          <span className="text-gray-500">({ratingCount})</span>
        )}
      </div>
    );
  };

  const isAddDisabled =
    disableInteractions || isOutOfStock || isAdding || maxQuantity <= 0;

  return (
    <article
      data-product-id={id}
      className={`group relative flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500/60 undefined`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-gray-50">
        {isOutOfStock && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-gray-700">
              Out of stock
            </span>
          </div>
        )}
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            No image
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-gray-900" title={title}>
          {title}
        </h3>

        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-gray-900">{formattedPrice}</p>
          {renderRating()}
        </div>

        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-center rounded-full border border-gray-200 bg-gray-50 px-1 py-0.5 text-xs">
            <button
              type="button"
              onClick={handleDecrement}
              disabled={disableInteractions || isOutOfStock || quantity <= 0}
              aria-label="Decrease quantity"
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              −
            </button>
            <div className="min-w-[1.5rem] px-1 text-center text-sm font-medium text-gray-900">
              {quantity}
            </div>
            <button
              type="button"
              onClick={handleIncrement}
              disabled={
                disableInteractions || isOutOfStock || quantity >= maxQuantity
              }
              aria-label="Increase quantity"
              className="flex h-7 w-7 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300"
            >
              +
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isAddDisabled}
            className={`inline-flex flex-1 items-center justify-center rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition undefined`}
          >
            {isOutOfStock ? "Unavailable" : isAdding ? "Adding..." : "Add to cart"}
          </button>
        </div>
      </div>
    </article>