import React from "react";

export interface Product {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  currency?: string;
}

export interface ProductCardProps {
  product: Product;
  onAddToCart?: (product: Product) => void;
  className?: string;
}

const formatPrice = (value: number, currency: string = "USD"): string => {
  try {
    return new Intl.NumberFormat("en-US", {
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
  className = "",
}) => {
  const handleAddToCart = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    event.preventDefault();
    if (onAddToCart) {
      onAddToCart(product);
    }
  };

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-transform duration-200 hover:-translate-y-1 hover:shadow-md focus-within:-translate-y-1 focus-within:shadow-md dark:border-gray-800 dark:bg-gray-900 undefined`}
      aria-label={product.title}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gray-100 dark:bg-gray-800">
        <img
          src={product.imageUrl}
          alt={product.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <header className="flex-1 space-y-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 transition-colors group-hover:text-blue-600 dark:text-gray-100 dark:group-hover:text-blue-400">
            {product.title}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">
              {formatPrice(product.price, product.currency)}
            </p>
            <div
              className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400"
              aria-label="Rating placeholder"
            >
              <div className="flex items-center">
                <span className="inline-block h-4 w-4 rounded-sm bg-gray-200 dark:bg-gray-700" />
                <span className="ml-1 inline-block h-4 w-4 rounded-sm bg-gray-200 dark:bg-gray-700" />
                <span className="ml-1 inline-block h-4 w-4 rounded-sm bg-gray-200 dark:bg-gray-700" />
                <span className="ml-1 inline-block h-4 w-4 rounded-sm bg-gray-200 dark:bg-gray-700" />
                <span className="ml-1 inline-block h-4 w-4 rounded-sm bg-gray-200 dark:bg-gray-700" />
              </div>
              <span className="ml-2">Rating</span>
            </div>
          </div>
        </header>

        <button
          type="button"
          onClick={handleAddToCart}
          className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:bg-gray-400 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-offset-gray-900"
        >
          <span>Add to cart</span>
        </button>
      </div>
    </article>
  );
};

export default ProductCard;