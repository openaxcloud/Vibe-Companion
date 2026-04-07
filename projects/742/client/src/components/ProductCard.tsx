import React, { FC, MouseEvent } from "react";

export type ProductRating = {
  value: number; // 0-5
  count?: number;
};

export type ProductCardProps = {
  id: string;
  title: string;
  price: number;
  imageUrl: string;
  rating?: ProductRating;
  currency?: string;
  className?: string;
  disabled?: boolean;
  onAddToCart?: (productId: string, event: MouseEvent<HTMLButtonElement>) => void;
};

const formatPrice = (value: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `undefined undefined`;
  }
};

const clampRating = (value: number): number => {
  if (Number.isNaN(value)) return 0;
  if (value < 0) return 0;
  if (value > 5) return 5;
  return value;
};

const getRatingStars = (ratingValue: number): (0 | 0.5 | 1)[] => {
  const value = clampRating(ratingValue);
  const fullStars = Math.floor(value);
  const hasHalfStar = value - fullStars >= 0.25 && value - fullStars < 0.75;
  const adjustedFullStars =
    value - fullStars >= 0.75 ? fullStars + 1 : fullStars;

  const stars: (0 | 0.5 | 1)[] = [];
  for (let i = 0; i < 5; i += 1) {
    if (i < adjustedFullStars) {
      stars.push(1);
    } else if (i === adjustedFullStars && hasHalfStar) {
      stars.push(0.5);
    } else {
      stars.push(0);
    }
  }
  return stars;
};

const StarIcon: FC<{ fill: 0 | 0.5 | 1 }> = ({ fill }) => {
  const baseClass =
    "h-4 w-4 sm:h-5 sm:w-5 inline-block transition-colors duration-150";
  if (fill === 1) {
    return (
      <svg
        className={`undefined text-yellow-400`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        aria-hidden="true"
        fill="currentColor"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.284 3.955a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.449a1 1 0 00-.364 1.118l1.285 3.955c.3.922-.755 1.688-1.54 1.118l-3.37-2.449a1 1 0 00-1.175 0l-3.37 2.449c-.784.57-1.838-.196-1.539-1.118l1.285-3.955a1 1 0 00-.364-1.118L2.07 9.382c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.28-3.955z" />
      </svg>
    );
  }

  if (fill === 0.5) {
    return (
      <svg
        className={`undefined text-yellow-400`}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="half-gradient">
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" stopOpacity="1" />
          </linearGradient>
        </defs>
        <path
          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.284 3.955a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.449a1 1 0 00-.364 1.118l1.285 3.955c.3.922-.755 1.688-1.54 1.118l-3.37-2.449a1 1 0 00-1.175 0l-3.37 2.449c-.784.57-1.838-.196-1.539-1.118l1.285-3.955a1 1 0 00-.364-1.118L2.07 9.382c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.28-3.955z"
          fill="url(#half-gradient)"
          stroke="currentColor"
          strokeWidth="1"
        />
      </svg>
    );
  }

  return (
    <svg
      className={`undefined text-gray-300 dark:text-gray-600`}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.284 3.955a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.449a1 1 0 00-.364 1.118l1.285 3.955c.3.922-.755 1.688-1.54 1.118l-3.37-2.449a1 1 0 00-1.175 0l-3.37 2.449c-.784.57-1.838-.196-1.539-1.118l1.285-3.955a1 1 0 00-.364-1.118L2.07 9.382c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.28-3.955z" />
    </svg>
  );
};

export const ProductCard: FC<ProductCardProps> = ({
  id,
  title,
  price,
  imageUrl,
  rating,
  currency = "USD",
  className = "",
  disabled = false,
  onAddToCart,
}) => {
  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>): void => {
    if (disabled) return;
    if (onAddToCart) {
      onAddToCart(id, event);
    }
  };

  const ratingValue = rating?.value ?? 0;
  const ratingCount = rating?.count;
  const stars = getRatingStars(ratingValue);
  const formattedPrice = formatPrice(price, currency);

  return (
    <article
      className={`group flex flex-col rounded-xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 focus-within:ring-offset-transparent dark:border-gray-800 dark:bg-gray-900 undefined`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-xl bg-gray-100 dark:bg-gray-800">
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-2 px-4 py-3 sm:px-5 sm:py-4">
        <h3 className="line-clamp-2 text-sm font-medium text-gray-900 dark:text-gray-50 sm:text-base">
          {title}
        </h3>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-base font-semibold text-gray-900 dark:text-gray-50 sm:text-lg">
              {formattedPrice}
            </span>
            {rating && (
              <div className="mt-1 flex items-center gap-1.5">
                <div className="flex items-center" aria-hidden="true">