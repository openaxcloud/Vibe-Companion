import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

type ProductDetailRouteParams = {
  id: string;
};

type Product = {
  id: string;
  name: string;
  price: number;
  originalPrice?: number;
  description: string;
  images: string[];
  inStock: boolean;
  stockCount?: number;
};

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Premium Wireless Headphones",
    price: 149.99,
    originalPrice: 199.99,
    description:
      "Experience high-fidelity sound with our Premium Wireless Headphones. Featuring active noise cancellation, 30-hour battery life, and a comfortable over-ear design. Perfect for work, travel, and everyday listening.",
    images: [],
    inStock: true,
    stockCount: 18,
  },
  {
    id: "2",
    name: "Ergonomic Office Chair",
    price: 289.0,
    description:
      "Stay comfortable and productive with this ergonomic office chair. Adjustable lumbar support, breathable mesh back, and multi-angle recline provide all-day comfort.",
    images: [],
    inStock: false,
    stockCount: 0,
  },
];

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

const StockBadge: React.FC<{ inStock: boolean; stockCount?: number }> = ({
  inStock,
  stockCount,
}) => {
  if (!inStock) {
    return (
      <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
        Out of stock
      </span>
    );
  }

  if (typeof stockCount === "number") {
    const isLow = stockCount > 0 && stockCount <= 5;
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold undefined`}
      >
        {isLow ? `Only undefined left` : "In stock"}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
      In stock
    </span>
  );
};

const QuantitySelector: React.FC<{
  value: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}> = ({ value, min = 1, max = 99, disabled, onChange }) => {
  const handleDecrement = () => {
    if (disabled) return;
    onChange(clamp(value - 1, min, max));
  };

  const handleIncrement = () => {
    if (disabled) return;
    onChange(clamp(value + 1, min, max));
  };

  const handleInputChange: React.ChangeEventHandler<HTMLInputElement> = (
    event
  ) => {
    if (disabled) return;
    const next = parseInt(event.target.value, 10);
    if (Number.isNaN(next)) {
      onChange(min);
      return;
    }
    onChange(clamp(next, min, max));
  };

  return (
    <div className="inline-flex items-center rounded-md border border-gray-300 bg-white">
      <button
        type="button"
        aria-label="Decrease quantity"
        onClick={handleDecrement}
        disabled={disabled || value <= min}
        className={`px-3 py-2 text-sm font-medium undefined`}
      >
        -
      </button>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={handleInputChange}
        disabled={disabled}
        className="w-14 border-x border-gray-200 py-1.5 text-center text-sm text-gray-900 focus:outline-none"
      />
      <button
        type="button"
        aria-label="Increase quantity"
        onClick={handleIncrement}
        disabled={disabled || value >= max}
        className={`px-3 py-2 text-sm font-medium undefined`}
      >
        +
      </button>
    </div>
  );
};

const ImageCarouselPlaceholder: React.FC = () => {
  return (
    <div className="flex flex-col gap-3 md:flex-row">
      <div className="flex-1">
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-gray-300 bg-gray-50">
          <div className="text-center text-xs text-gray-400">
            <p className="font-medium">Product Images</p>
            <p>Image carousel placeholder</p>
          </div>
        </div>
      </div>
      <div className="flex w-full flex-row gap-2 md:w-24 md:flex-col">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="flex-1 cursor-default rounded-md border border-dashed border-gray-200 bg-gray-50"
          />
        ))}
      </div>
    </div>
  );
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<ProductDetailRouteParams>();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);

  const product = useMemo(
    () => mockProducts.find((p) => p.id === id) ?? mockProducts[0],
    [id]
  );

  const handleAddToCart = useCallback(async () => {
    if (!product.inStock || isAdding) return;
    try {
      setIsAdding(true);
      await new Promise((resolve) => setTimeout(resolve, 700));
      // Replace alert with real toast/in-app notification in production
      // eslint-disable-next-line no-alert
      alert(
        `Added undefined x "undefined" to cart (mock implementation).`
      );
    } finally {
      setIsAdding(false);
    }
  }, [isAdding, product, quantity]);

  const handleBuyNow = useCallback(async () => {
    if (!product.inStock || isAdding) return;
    await handleAddToCart();
    navigate("/checkout");
  }, [handleAddToCart, isAdding, navigate, product.inStock]);

  const canPurchase = product.inStock && !isAdding;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md px-1 py-0.5 text-gray-500 hover:text-gray-700"
        >
          ← Back
        </button>
        <span className="text-gray-300">/</span>
        <span>Product</span>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <section aria-label="Product images" className="space-y-3">
          <ImageCarouselPlaceholder />
        </section>

        <section
          aria-label="Product details"
          className="flex flex-col gap-6 rounded-lg border border-gray-100 bg-white p-5 shadow-sm"
        >
          <header className="space-y-2">
            <h1 className="text-2xl font-semibold text-gray-900">
              {product.name}
            </h1>
            <StockBadge
              inStock={product.inStock}
              stockCount={product.stockCount}
            />
          </header>

          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <p className="text-2xl font-semibold text-gray-900">
                {formatCurrency(product.price)}
              </p>
              {product.originalPrice && product.originalPrice > product.price && (
                <>
                  <p className="text-sm text-gray-400 line-through">
                    {formatCurrency(product.originalPrice)}
                  </p>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    {Math.round(
                      ((product.originalPrice - product.price)