import React, { useCallback, useMemo } from "react";

export interface CartItemData {
  id: string;
  name: string;
  imageUrl: string;
  price: number;
  currency?: string;
  quantity: number;
  maxQuantity?: number;
  isUpdating?: boolean;
}

interface CartItemProps {
  item: CartItemData;
  onIncrease: (id: string) => void;
  onDecrease: (id: string) => void;
  onRemove: (id: string) => void;
  disableInteractions?: boolean;
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
    return `$undefined`;
  }
};

const CartItem: React.FC<CartItemProps> = ({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  disableInteractions = false,
}) => {
  const {
    id,
    name,
    imageUrl,
    price,
    currency,
    quantity,
    maxQuantity,
    isUpdating,
  } = item;

  const isDisabled = disableInteractions || isUpdating;
  const isIncreaseDisabled =
    isDisabled || (typeof maxQuantity === "number" && quantity >= maxQuantity);
  const isDecreaseDisabled = isDisabled || quantity <= 1;

  const handleIncrease = useCallback(() => {
    if (!isIncreaseDisabled) {
      onIncrease(id);
    }
  }, [id, isIncreaseDisabled, onIncrease]);

  const handleDecrease = useCallback(() => {
    if (!isDecreaseDisabled) {
      onDecrease(id);
    }
  }, [id, isDecreaseDisabled, onDecrease]);

  const handleRemove = useCallback(() => {
    if (!isDisabled) {
      onRemove(id);
    }
  }, [id, isDisabled, onRemove]);

  const lineTotal = useMemo(() => price * quantity, [price, quantity]);

  return (
    <div
      className="cart-item flex gap-4 border-b border-neutral-200 py-4 last:border-b-0"
      aria-busy={isUpdating || undefined}
      aria-live="polite"
    >
      <div className="cart-item__image w-20 h-20 flex-shrink-0 rounded-md border border-neutral-200 overflow-hidden bg-neutral-50">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-neutral-400">
            No Image
          </div>
        )}
      </div>

      <div className="cart-item__content flex-1 flex flex-col justify-between gap-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="cart-item__name font-medium text-sm text-neutral-900 truncate">
              {name}
            </div>
            <div className="cart-item__price text-sm text-neutral-600 mt-1">
              {formatPrice(price, currency)}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            disabled={isDisabled}
            aria-label={`Remove undefined from cart`}
            className={`cart-item__remove text-xs text-neutral-500 hover:text-red-600 transition-colors undefined`}
          >
            Remove
          </button>
        </div>

        <div className="cart-item__footer flex items-center justify-between gap-4 mt-1">
          <div className="cart-item__quantity flex items-center gap-2">
            <span className="text-xs text-neutral-600">Qty</span>
            <div className="inline-flex items-center border border-neutral-200 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={handleDecrease}
                disabled={isDecreaseDisabled}
                aria-label={`Decrease quantity of undefined`}
                className={`w-8 h-8 flex items-center justify-center text-lg leading-none text-neutral-600 hover:bg-neutral-100 transition-colors undefined`}
              >
                −
              </button>
              <div className="min-w-[2.5rem] text-center text-sm text-neutral-900 select-none">
                {quantity}
              </div>
              <button
                type="button"
                onClick={handleIncrease}
                disabled={isIncreaseDisabled}
                aria-label={`Increase quantity of undefined`}
                className={`w-8 h-8 flex items-center justify-center text-lg leading-none text-neutral-600 hover:bg-neutral-100 transition-colors undefined`}
              >
                +
              </button>
            </div>
            {typeof maxQuantity === "number" && (
              <span className="text-[11px] text-neutral-500 ml-1">
                Max {maxQuantity}
              </span>
            )}
          </div>

          <div className="cart-item__total text-sm font-semibold text-neutral-900">
            {formatPrice(lineTotal, currency)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItem;