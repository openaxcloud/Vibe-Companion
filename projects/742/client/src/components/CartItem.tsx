import React, { useMemo, useCallback } from "react";

export interface CartItemVariant {
  id: string;
  name: string;
  sku?: string;
  options?: string;
}

export interface CartItemPrice {
  currency: string;
  unitPrice: number; // price per single unit, in minor units (e.g. cents)
  subtotal: number; // quantity * unitPrice, in minor units
  formattedUnitPrice?: string;
  formattedSubtotal?: string;
}

export interface CartItemData {
  id: string;
  productId: string;
  name: string;
  imageUrl?: string;
  variant: CartItemVariant;
  quantity: number;
  maxQuantity?: number;
  price: CartItemPrice;
  isRemoving?: boolean;
  isUpdating?: boolean;
  disabled?: boolean;
}

export interface CartItemProps {
  item: CartItemData;
  onQuantityChange?: (itemId: string, nextQty: number) => void;
  onRemove?: (itemId: string) => void;
  className?: string;
  minQuantity?: number;
  readOnly?: boolean;
}

const MIN_QUANTITY_FALLBACK = 1;

const formatMoney = (amountMinor: number, currency: string): string => {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `undefined undefined`;
  }
};

const clamp = (value: number, min: number, max?: number): number => {
  if (max != null && max >= min) {
    return Math.min(Math.max(value, min), max);
  }
  return Math.max(value, min);
};

const CartItem: React.FC<CartItemProps> = ({
  item,
  onQuantityChange,
  onRemove,
  className = "",
  minQuantity = MIN_QUANTITY_FALLBACK,
  readOnly = false,
}) => {
  const isBusy = !!item.isUpdating || !!item.isRemoving || !!item.disabled;

  const minQty = useMemo(
    () => Math.max(MIN_QUANTITY_FALLBACK, minQuantity),
    [minQuantity]
  );

  const canDecrease = useMemo(
    () => !readOnly && !isBusy && item.quantity > minQty,
    [readOnly, isBusy, item.quantity, minQty]
  );

  const canIncrease = useMemo(
    () =>
      !readOnly &&
      !isBusy &&
      (item.maxQuantity == null || item.quantity < item.maxQuantity),
    [readOnly, isBusy, item.quantity, item.maxQuantity]
  );

  const handleChangeQuantity = useCallback(
    (nextQty: number) => {
      if (!onQuantityChange || readOnly || isBusy) return;
      const clamped = clamp(nextQty, minQty, item.maxQuantity);
      if (clamped === item.quantity) return;
      onQuantityChange(item.id, clamped);
    },
    [onQuantityChange, readOnly, isBusy, minQty, item.maxQuantity, item.id, item.quantity]
  );

  const handleDecrease = useCallback(() => {
    if (!canDecrease) return;
    handleChangeQuantity(item.quantity - 1);
  }, [canDecrease, handleChangeQuantity, item.quantity]);

  const handleIncrease = useCallback(() => {
    if (!canIncrease) return;
    handleChangeQuantity(item.quantity + 1);
  }, [canIncrease, handleChangeQuantity, item.quantity]);

  const handleQuantityInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (readOnly || isBusy) return;
      const raw = e.target.value.trim();
      if (raw === "") {
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        return;
      }
      const nextQty = Math.floor(parsed);
      if (nextQty <= 0) {
        handleChangeQuantity(minQty);
      } else {
        handleChangeQuantity(nextQty);
      }
    },
    [readOnly, isBusy, handleChangeQuantity, minQty]
  );

  const handleRemove = useCallback(() => {
    if (!onRemove || readOnly || isBusy) return;
    onRemove(item.id);
  }, [onRemove, readOnly, isBusy, item.id]);

  const unitPriceLabel = useMemo(() => {
    if (item.price.formattedUnitPrice) return item.price.formattedUnitPrice;
    return formatMoney(item.price.unitPrice, item.price.currency);
  }, [item.price]);

  const subtotalLabel = useMemo(() => {
    if (item.price.formattedSubtotal) return item.price.formattedSubtotal;
    return formatMoney(item.price.subtotal, item.price.currency);
  }, [item.price]);

  const rootClassName = [
    "cart-item",
    isBusy ? "cart-item--busy" : "",
    readOnly ? "cart-item--readonly" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} aria-busy={isBusy}>
      <div className="cart-item__media">
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
            alt={item.name}
            className="cart-item__image"
            loading="lazy"
          />
        ) : (
          <div className="cart-item__image cart-item__image--placeholder" />
        )}
      </div>

      <div className="cart-item__body">
        <div className="cart-item__header">
          <div className="cart-item__title-group">
            <div className="cart-item__name" title={item.name}>
              {item.name}
            </div>
            <div className="cart-item__variant">
              <span className="cart-item__variant-name">{item.variant.name}</span>
              {item.variant.options && (
                <span className="cart-item__variant-options">
                  {" "}
                  · {item.variant.options}
                </span>
              )}
              {item.variant.sku && (
                <span className="cart-item__variant-sku"> · SKU: {item.variant.sku}</span>
              )}
            </div>
          </div>

          <div className="cart-item__price">
            <div className="cart-item__price-subtotal">{subtotalLabel}</div>
            <div className="cart-item__price-unit">
              {unitPriceLabel} <span className="cart-item__price-unit-label">/ unit</span>
            </div>
          </div>
        </div>

        <div className="cart-item__footer">
          <div className="cart-item__quantity">
            <button
              type="button"
              className="cart-item__qty-btn cart-item__qty-btn--decrease"
              onClick={handleDecrease}
              disabled={!canDecrease}
              aria-label="Decrease quantity"
            >
              −
            </button>

            <input
              type="number"
              className="cart-item__qty-input"
              value={item.quantity}
              min={minQty}
              max={item.maxQuantity}
              onChange={handleQuantityInputChange}
              aria-label="Quantity"
              disabled={readOnly || isBusy}
            />

            <button
              type="button"
              className="cart-item__qty-btn cart-item__qty-btn--increase"
              onClick={handleIncrease}
              disabled={!canIncrease}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <div className="cart-item__actions">
            {!readOnly && (
              <button
                type="button"
                className="cart-item__remove-btn"
                onClick={handleRemove}
                disabled={isBusy}
              >
                {item.isRemoving ? "Removing…" : "Remove"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItem;