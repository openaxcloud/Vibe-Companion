import React from "react";

export type Product = {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  currency?: string;
  isFavorite?: boolean;
  isInCart?: boolean;
};

type ProductCardProps = {
  product: Product;
  onAddToCart?: (product: Product) => void;
  onToggleFavorite?: (product: Product) => void;
  className?: string;
  disabled?: boolean;
};

const formatPrice = (value: number, currency: string = "USD"): string => {
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

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  onToggleFavorite,
  className = "",
  disabled = false,
}) => {
  const {
    title,
    imageUrl,
    price,
    currency = "USD",
    isFavorite = false,
    isInCart = false,
  } = product;

  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!disabled && onAddToCart) {
      onAddToCart(product);
    }
  };

  const handleToggleFavorite = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    if (!disabled && onToggleFavorite) {
      onToggleFavorite(product);
    }
  };

  return (
    <article
      className={`product-card relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md undefined`}
      aria-disabled={disabled}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-200 ease-out hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gray-100 text-sm text-gray-400">
            No image
          </div>
        )}

        <button
          type="button"
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          onClick={handleToggleFavorite}
          disabled={disabled || !onToggleFavorite}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-gray-500 shadow-sm backdrop-blur transition hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span aria-hidden="true">
            {isFavorite ? (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 fill-red-500"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12.1 4.44 12 4.55l-.11-.11A5.2 5.2 0 0 0 8.5 3 5.5 5.5 0 0 0 3 8.6c0 1.52.61 2.98 1.7 4.06l6.82 6.78a.99.99 0 0 0 1.4 0l6.82-6.79A5.72 5.72 0 0 0 21 8.6 5.5 5.5 0 0 0 15.5 3a5.2 5.2 0 0 0-3.4 1.44Z" />
              </svg>
            ) : (
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16.5 3c-1.74 0-3.41.81-4.5 2.09A5.96 5.96 0 0 0 7.5 3 5.5 5.5 0 0 0 2 8.6c0 1.52.61 2.98 1.7 4.06l6.82 6.78a.99.99 0 0 0 1.4 0l6.82-6.79A5.72 5.72 0 0 0 22 8.6 5.5 5.5 0 0 0 16.5 3Zm2.99 9.02-6.49 6.45-6.49-6.45A3.73 3.73 0 0 1 4 8.6 3.5 3.5 0 0 1 7.5 5c1.34 0 2.6.76 3.23 1.94.36.68 1.19.93 1.87.57.24-.13.44-.33.57-.57A3.95 3.95 0 0 1 16.5 5 3.5 3.5 0 0 1 20 8.6c0 1-.41 1.96-1.51 3.42Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </span>
        </button>
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-gray-900 sm:text-base">
          {title}
        </h3>

        <div className="mt-2 flex items-baseline justify-between gap-2">
          <p className="text-base font-semibold text-gray-900 sm:text-lg">
            {formatPrice(price, currency)}
          </p>
        </div>

        <div className="mt-3 flex items-center">
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={disabled || !onAddToCart}
            className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-600"
          >
            {isInCart ? "In Cart" : "Add to Cart"}
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;