import React from "react";

export type Product = {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  currency?: string;
  inStock: boolean;
};

type ProductCardProps = {
  product: Product;
  onAddToCart?: (product: Product) => void;
  className?: string;
};

const ProductCard: React.FC<ProductCardProps> = ({ product, onAddToCart, className = "" }) => {
  const { title, imageUrl, price, currency = "USD", inStock } = product;

  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!inStock) return;
    if (onAddToCart) {
      onAddToCart(product);
    }
  };

  const formatPrice = (value: number, currencyCode: string): string => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `undefined undefined`;
    }
  };

  const formattedPrice = formatPrice(price, currency);

  return (
    <div
      className={`product-card border rounded-lg shadow-sm overflow-hidden bg-white flex flex-col undefined`.trim()}
      aria-label={title}
    >
      <div className="relative w-full pt-[75%] bg-gray-100 overflow-hidden">
        <img
          src={imageUrl}
          alt={title}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
        {!inStock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white text-sm font-semibold uppercase tracking-wide">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 p-4 gap-2">
        <h2 className="text-sm font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem]">
          {title}
        </h2>

        <div className="flex items-center justify-between mt-1">
          <div className="text-base font-bold text-gray-900">{formattedPrice}</div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <div className="flex gap-0.5" aria-label="Rating placeholder">
              <span>★</span>
              <span>★</span>
              <span>★</span>
              <span>★</span>
              <span>★</span>
            </div>
            <span className="text-[11px]">(rating)</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleAddToCart}
          disabled={!inStock}
          className={`mt-3 inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 undefined`}
          aria-disabled={!inStock}
        >
          {inStock ? "Add to Cart" : "Out of Stock"}
        </button>
      </div>
    </div>
  );
};

export default ProductCard;