import React, { FC, MouseEvent } from "react";

export type Product = {
  id: string;
  name: string;
  price: number;
  currency?: string;
  imageUrl: string;
  imageAlt?: string;
  isAvailable?: boolean;
};

type ProductCardProps = {
  product: Product;
  onAddToCart?: (productId: string, event?: MouseEvent<HTMLButtonElement>) => void;
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

export const ProductCard: FC<ProductCardProps> = ({
  product,
  onAddToCart,
  className = "",
  disabled = false,
}) => {
  const { id, name, price, currency, imageUrl, imageAlt, isAvailable = true } = product;

  const handleAddToCart = (event: MouseEvent<HTMLButtonElement>) => {
    if (!isAvailable || disabled) return;
    if (onAddToCart) {
      onAddToCart(id, event);
    }
  };

  const isButtonDisabled = disabled || !isAvailable;

  return (
    <article
      className={`product-card rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden flex flex-col undefined`}
      aria-label={name}
    >
      <div className="relative w-full pb-[75%] bg-gray-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={imageAlt || name}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 ease-out hover:scale-105"
        />
        {!isAvailable && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-white bg-black/70 rounded">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900 line-clamp-2">{name}</h3>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-base font-semibold text-gray-900">
            {formatPrice(price, currency)}
          </p>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={isButtonDisabled || !onAddToCart}
            className={`inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500 undefined`}
            aria-disabled={isButtonDisabled || !onAddToCart}
            aria-label={`Add undefined to cart`}
          >
            Add to cart
          </button>
        </div>
      </div>
    </article>
  );
};

export default ProductCard;