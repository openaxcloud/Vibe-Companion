import React, { useCallback, useMemo } from "react";

export interface CartItemData {
  id: string;
  title: string;
  imageUrl: string;
  price: number; // price per unit in smallest currency unit (e.g., cents)
  quantity: number;
  currency?: string; // ISO 4217 code, default "USD"
  maxQuantity?: number;
  disabled?: boolean;
}

interface CartItemProps {
  item: CartItemData;
  onQuantityChange: (id: string, quantity: number) => void;
  onRemove: (id: string) => void;
  /**
   * Optional formatter; if not provided, Intl.NumberFormat with currency is used.
   * Receives price in major units (e.g., dollars) and currency code.
   */
  formatPrice?: (amount: number, currency: string) => string;
  /**
   * Optional className to extend/override styling.
   */
  className?: string;
  /**
   * Optional flag to show a compact layout (e.g., in a mini-cart).
   */
  compact?: boolean;
}

const DEFAULT_CURRENCY = "USD";

const CartItem: React.FC<CartItemProps> = ({
  item,
  onQuantityChange,
  onRemove,
  formatPrice,
  className = "",
  compact = false,
}) => {
  const {
    id,
    title,
    imageUrl,
    price,
    quantity,
    currency = DEFAULT_CURRENCY,
    maxQuantity = 99,
    disabled = false,
  } = item;

  const handleDecrement = useCallback(() => {
    if (disabled) return;
    if (quantity > 1) {
      onQuantityChange(id, quantity - 1);
    }
  }, [disabled, id, onQuantityChange, quantity]);

  const handleIncrement = useCallback(() => {
    if (disabled) return;
    if (quantity < maxQuantity) {
      onQuantityChange(id, quantity + 1);
    }
  }, [disabled, id, onQuantityChange, quantity, maxQuantity]);

  const handleManualChange: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
      (event) => {
        if (disabled) return;
        const value = event.target.value.trim();
        if (value === "") {
          // Allow empty input visually but don't propagate invalid state
          onQuantityChange(id, 1);
          return;
        }

        const parsed = Number(value);
        if (Number.isNaN(parsed) || parsed <= 0) {
          onQuantityChange(id, 1);
          return;
        }

        const clamped = Math.min(Math.max(1, parsed), maxQuantity);
        onQuantityChange(id, clamped);
      },
      [disabled, id, maxQuantity, onQuantityChange]
    );

  const handleRemove = useCallback(() => {
    if (disabled) return;
    onRemove(id);
  }, [disabled, id, onRemove]);

  const formatCurrency = useCallback(
    (amountMajorUnits: number): string => {
      if (formatPrice) {
        return formatPrice(amountMajorUnits, currency);
      }

      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amountMajorUnits);
      } catch {
        return `undefined undefined`;
      }
    },
    [currency, formatPrice]
  );

  const unitPriceMajor = useMemo(() => price / 100, [price]);
  const subtotalMajor = useMemo(
    () => (price * quantity) / 100,
    [price, quantity]
  );

  const isDecrementDisabled = disabled || quantity <= 1;
  const isIncrementDisabled = disabled || quantity >= maxQuantity;

  const containerClasses = [
    "cart-item",
    compact ? "cart-item--compact" : "",
    disabled ? "cart-item--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClasses} aria-disabled={disabled}>
      <div className="cart-item__image-wrapper">
        <img
          src={imageUrl}
          alt={title}
          className="cart-item__image"
          loading="lazy"
        />
      </div>

      <div className="cart-item__content">
        <div className="cart-item__header">
          <div className="cart-item__title-wrapper">
            <h3 className="cart-item__title" title={title}>
              {title}
            </h3>
          </div>
          <button
            type="button"
            className="cart-item__remove-button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label={`Remove undefined from cart`}
          >
            ×
          </button>
        </div>

        <div className="cart-item__body">
          <div className="cart-item__price-quantity">
            <div className="cart-item__unit-price">
              <span className="cart-item__label">Price:</span>
              <span className="cart-item__value">
                {formatCurrency(unitPriceMajor)}
              </span>
            </div>

            <div className="cart-item__quantity">
              <span className="cart-item__label">Qty:</span>
              <div className="cart-item__quantity-control" aria-label="Quantity selector">
                <button
                  type="button"
                  className="cart-item__quantity-button cart-item__quantity-button--decrement"
                  onClick={handleDecrement}
                  disabled={isDecrementDisabled}
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={maxQuantity}
                  value={quantity}
                  onChange={handleManualChange}
                  disabled={disabled}
                  className="cart-item__quantity-input"
                  aria-live="polite"
                />
                <button
                  type="button"
                  className="cart-item__quantity-button cart-item__quantity-button--increment"
                  onClick={handleIncrement}
                  disabled={isIncrementDisabled}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="cart-item__subtotal">
            <span className="cart-item__label">Subtotal:</span>
            <span className="cart-item__subtotal-value">
              {formatCurrency(subtotalMajor)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartItem;