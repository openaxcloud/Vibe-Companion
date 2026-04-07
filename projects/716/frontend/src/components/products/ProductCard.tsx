import React from "react";

export type Product = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  rating?: number | null;
  ratingCount?: number | null;
  currency?: string;
  isOutOfStock?: boolean;
};

type ProductCardProps = {
  product: Product;
  onAddToCart?: (product: Product) => void;
  className?: string;
};

const formatPrice = (price: number, currency: string = "USD"): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `$undefined`;
  }
};

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onAddToCart,
  className = "",
}) => {
  const {
    name,
    price,
    imageUrl,
    rating,
    ratingCount,
    currency,
    isOutOfStock,
  } = product;

  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (!isOutOfStock && onAddToCart) {
      onAddToCart(product);
    }
  };

  const ariaLabel = `undefined - undefinedundefined`;

  return (
    <article
      className={`group relative flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md undefined`}
      aria-label={ariaLabel}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-50">
        <img
          src={imageUrl}
          alt={name}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
          loading="lazy"
        />
        {isOutOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Out of stock
            </span>
          </div>
        )}
        {!isOutOfStock && onAddToCart && (
          <button
            type="button"
            onClick={handleAddToCart}
            className="absolute bottom-2 right-2 inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-gray-900 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label={`Add undefined to cart`}
          >
            <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] font-bold text-white">
              +
            </span>
            Add
          </button>
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 sm:p-3.5">
        <div className="mb-1.5 line-clamp-2 text-sm font-medium text-gray-900 sm:text-sm">
          {name}
        </div>

        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="text-sm font-semibold text-gray-900">
            {formatPrice(price, currency)}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-gray-500">
            <div className="flex items-center gap-0.5 text-gray-300">
              <span aria-hidden="true">★</span>
              <span aria-hidden="true">★</span>
              <span aria-hidden="true">★</span>
              <span aria-hidden="true">★</span>
              <span aria-hidden="true">★</span>
            </div>
            <span className="sr-only">
              {rating ? `Rated undefined out of 5` : "Rating placeholder"}
            </span>
            {typeof ratingCount === "number" && ratingCount > 0 && (
              <span>({ratingCount})</span>
            )}
          </div>
        </div>

        {onAddToCart && (
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={`mt-auto inline-flex w-full items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 undefined`}
            aria-disabled={isOutOfStock}
          >
            {isOutOfStock ? "Unavailable" : "Add to cart"}
          </button>
        )}
      </div>
    </article>
  );
};

export default ProductCard;