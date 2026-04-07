import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type CartItem = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
};

type CartProps = {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const Cart: React.FC<CartProps> = ({ items, onUpdateQuantity, onRemoveItem }) => {
  const navigate = useNavigate();

  const handleQuantityChange = useCallback(
    (id: string, quantity: number) => {
      if (quantity < 1) return;
      onUpdateQuantity(id, quantity);
    },
    [onUpdateQuantity]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onRemoveItem(id);
    },
    [onRemoveItem]
  );

  const handleProceedToCheckout = useCallback(() => {
    if (!items.length) return;
    navigate("/checkout");
  }, [items.length, navigate]);

  const subtotal = useMemo(
    () =>
      items.reduce((acc, item) => {
        return acc + item.price * item.quantity;
      }, 0),
    [items]
  );

  const taxRate = 0.08;
  const tax = useMemo(() => subtotal * taxRate, [subtotal]);
  const total = useMemo(() => subtotal + tax, [subtotal, tax]);

  const isEmpty = items.length === 0;

  return (
    <div className="cart-page">
      <h1 className="cart-page__title">Shopping Cart</h1>

      <div className="cart-page__content">
        <section className="cart-page__items">
          {isEmpty ? (
            <div className="cart-page__empty">
              <p>Your cart is currently empty.</p>
              <button
                type="button"
                className="cart-page__continue-button"
                onClick={() => navigate("/")}
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <ul className="cart-page__list" aria-label="Shopping cart items">
              {items.map((item) => (
                <li key={item.id} className="cart-page__item">
                  {item.imageUrl && (
                    <div className="cart-page__item-image-wrapper">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="cart-page__item-image"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="cart-page__item-details">
                    <div className="cart-page__item-header">
                      <h2 className="cart-page__item-name">{item.name}</h2>
                      <button
                        type="button"
                        className="cart-page__item-remove"
                        onClick={() => handleRemove(item.id)}
                        aria-label={`Remove undefined from cart`}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="cart-page__item-meta">
                      <span className="cart-page__item-price">
                        {formatCurrency(item.price)}
                      </span>
                      <div className="cart-page__item-quantity">
                        <label
                          htmlFor={`quantity-undefined`}
                          className="cart-page__item-quantity-label"
                        >
                          Qty:
                        </label>
                        <div className="cart-page__item-quantity-controls">
                          <button
                            type="button"
                            className="cart-page__item-quantity-button"
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity - 1)
                            }
                            aria-label={`Decrease quantity of undefined`}
                            disabled={item.quantity <= 1}
                          >
                            −
                          </button>
                          <input
                            id={`quantity-undefined`}
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(
                                item.id,
                                Number(e.target.value) || 1
                              )
                            }
                            className="cart-page__item-quantity-input"
                            aria-label={`Quantity of undefined`}
                          />
                          <button
                            type="button"
                            className="cart-page__item-quantity-button"
                            onClick={() =>
                              handleQuantityChange(item.id, item.quantity + 1)
                            }
                            aria-label={`Increase quantity of undefined`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="cart-page__item-total">
                      Item total:{" "}
                      <span className="cart-page__item-total-value">
                        {formatCurrency(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="cart-page__summary" aria-label="Order summary">
          <h2 className="cart-page__summary-title">Order Summary</h2>
          <div className="cart-page__summary-row">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="cart-page__summary-row">
            <span>Tax (8%)</span>
            <span>{formatCurrency(tax)}</span>
          </div>
          <div className="cart-page__summary-row cart-page__summary-row--total">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
          <button
            type="button"
            className="cart-page__checkout-button"
            onClick={handleProceedToCheckout}
            disabled={isEmpty}
          >
            Proceed to Checkout
          </button>
          {!isEmpty && (
            <button
              type="button"
              className="cart-page__continue-button cart-page__continue-button--link"
              onClick={() => navigate("/")}
            >
              Continue Shopping
            </button>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Cart;