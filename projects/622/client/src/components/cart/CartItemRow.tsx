import React, { useCallback, useMemo } from "react";
import type { FC, MouseEvent } from "react";
import { useCart } from "../../context/CartContext";

export interface CartItemRowProps {
  id: string;
  productId: string;
  name: string;
  price: number;
  imageUrl?: string | null;
  quantity: number;
  maxQuantity?: number;
  currency?: string;
  isUpdating?: boolean;
  isRemoving?: boolean;
  onError?: (error: Error) => void;
  className?: string;
}

const formatCurrency = (value: number, currency: string): string => {
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

const clampQuantity = (value: number, maxQuantity?: number): number => {
  if (value < 1) return 1;
  if (typeof maxQuantity === "number" && maxQuantity > 0) {
    return Math.min(value, maxQuantity);
  }
  return value;
};

const CartItemRow: FC<CartItemRowProps> = ({
  id,
  productId,
  name,
  price,
  imageUrl,
  quantity,
  maxQuantity,
  currency = "USD",
  isUpdating = false,
  isRemoving = false,
  onError,
  className = "",
}) => {
  const { updateItemQuantity, removeItem } = useCart();

  const subtotal = useMemo(() => quantity * price, [quantity, price]);
  const isBusy = isUpdating || isRemoving;

  const handleError = useCallback(
    (error: unknown) => {
      const normalizedError =
        error instanceof Error ? error : new Error("Unknown error");
      if (onError) {
        onError(normalizedError);
      } else {
        // eslint-disable-next-line no-console
        console.error("CartItemRow error:", normalizedError);
      }
    },
    [onError]
  );

  const handleIncrease = useCallback(async () => {
    if (isBusy) return;
    const nextQty = clampQuantity(quantity + 1, maxQuantity);
    if (nextQty === quantity) return;

    try {
      await updateItemQuantity(id, nextQty);
    } catch (error) {
      handleError(error);
    }
  }, [id, quantity, maxQuantity, updateItemQuantity, handleError, isBusy]);

  const handleDecrease = useCallback(async () => {
    if (isBusy) return;
    const nextQty = clampQuantity(quantity - 1, maxQuantity);
    if (nextQty === quantity) return;

    try {
      await updateItemQuantity(id, nextQty);
    } catch (error) {
      handleError(error);
    }
  }, [id, quantity, maxQuantity, updateItemQuantity, handleError, isBusy]);

  const handleQuantityInputChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      if (isBusy) return;
      const raw = event.target.value;
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed)) return;

      const nextQty = clampQuantity(parsed, maxQuantity);
      if (nextQty === quantity) return;

      try {
        await updateItemQuantity(id, nextQty);
      } catch (error) {
        handleError(error);
      }
    },
    [id, quantity, maxQuantity, updateItemQuantity, handleError, isBusy]
  );

  const handleRemove = useCallback(
    async (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      if (isBusy) return;

      try {
        await removeItem(id);
      } catch (error) {
        handleError(error);
      }
    },
    [id, removeItem, handleError, isBusy]
  );

  return (
    <div
      className={`flex w-full items-center gap-4 border-b border-gray-200 py-4 last:border-b-0 undefined`}
      data-cart-item-id={id}
      data-product-id={productId}
    >
      <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
            No image
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-gray-900">
              {name}
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {formatCurrency(price, currency)} each
            </div>
          </div>

          <button
            type="button"
            onClick={handleRemove}
            disabled={isBusy}
            aria-label={`Remove undefined from cart`}
            className="flex h-7 w-7 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 items-stretch overflow-hidden rounded border border-gray-300 bg-white text-sm">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={isBusy || quantity <= 1}
                className="flex w-8 items-center justify-center border-r border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Decrease quantity of undefined`}
              >
                -
              </button>
              <input
                type="number"
                min={1}
                max={maxQuantity ?? undefined}
                value={quantity}
                onChange={handleQuantityInputChange}
                className="w-12 border-0 p-0 text-center text-sm outline-none focus:ring-0"
                aria-label={`Quantity of undefined`}
                disabled={isBusy}
              />
              <button
                type="button"
                onClick={handleIncrease}
                disabled={
                  isBusy ||
                  (typeof maxQuantity === "number" &&
                    maxQuantity > 0 &&
                    quantity >= maxQuantity)
                }
                className="flex w-8 items-center justify-center border-l border-gray-200 text-gray-600 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={`Increase quantity of undefined`}
              >
                +
              </button>
            </div>
            {typeof maxQuantity === "number" && maxQuantity > 0 && (
              <span className="text-xs text-gray-400">
                Max {maxQuantity} per order
              </span>
            )}
          </div>

          <div className="text-right text-sm font-semibold text-gray-900">
            {formatCurrency(subtotal, currency)}
          </div>
        </div>

        {isBusy && (
          <div className="mt-1 text-xs text-gray-400">
            Updating item…
          </div>
        )}
      </div>
    </div>
  );
};

export default CartItemRow;