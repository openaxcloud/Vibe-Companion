import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

export type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type CartContextValue = {
  items: CartItem[];
  updateItemQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart?: () => void;
};

const CartContext = React.createContext<CartContextValue | undefined>(
  undefined
);

// Hook placeholder; assumes CartContext.Provider is set up higher in the tree
export const useCart = (): CartContextValue => {
  const ctx = React.useContext(CartContext);
  if (!ctx) {
    throw new Error("useCart must be used within a CartContext provider");
  }
  return ctx;
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const { items, updateItemQuantity, removeItem } = useCart();

  const handleQuantityChange = useCallback(
    (id: string, nextQuantity: number) => {
      if (Number.isNaN(nextQuantity) || nextQuantity <= 0) return;
      updateItemQuantity(id, nextQuantity);
    },
    [updateItemQuantity]
  );

  const handleRemove = useCallback(
    (id: string) => {
      removeItem(id);
    },
    [removeItem]
  );

  const handleProceedToCheckout = useCallback(() => {
    if (!items.length) return;
    navigate("/checkout");
  }, [items.length, navigate]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items]
  );

  if (!items.length) {
    return (
      <div className="cart-page">
        <div className="cart-container empty">
          <h1 className="cart-title">Your Cart</h1>
          <p className="cart-empty-message">Your cart is currently empty.</p>
          <button
            type="button"
            className="cart-continue-button"
            onClick={() => navigate("/")}
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <div className="cart-container">
        <h1 className="cart-title">Your Cart</h1>

        <div className="cart-layout">
          <section className="cart-items-section">
            {items.map((item) => (
              <article key={item.id} className="cart-item">
                <div className="cart-item-main">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="cart-item-image"
                    />
                  ) : (
                    <div className="cart-item-image placeholder">
                      <span>{item.name.charAt(0).toUpperCase()}</span>
                    </div>
                  )}

                  <div className="cart-item-details">
                    <h2 className="cart-item-name">{item.name}</h2>
                    <div className="cart-item-meta">
                      <span className="cart-item-price">
                        {formatCurrency(item.price)}
                      </span>
                    </div>
                    <div className="cart-item-actions">
                      <label className="cart-item-quantity-label">
                        Qty
                        <input
                          type="number"
                          min={1}
                          className="cart-item-quantity-input"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(
                              item.id,
                              Number(e.target.value)
                            )
                          }
                        />
                      </label>
                      <button
                        type="button"
                        className="cart-item-remove-button"
                        onClick={() => handleRemove(item.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>

                <div className="cart-item-total">
                  <span className="cart-item-total-label">Total</span>
                  <span className="cart-item-total-value">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </div>
              </article>
            ))}
          </section>

          <aside className="cart-summary">
            <h2 className="cart-summary-title">Order Summary</h2>
            <div className="cart-summary-row">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            <p className="cart-summary-note">
              Taxes and shipping are calculated at checkout.
            </p>
            <button
              type="button"
              className="cart-checkout-button"
              onClick={handleProceedToCheckout}
            >
              Proceed to Checkout
            </button>
            <button
              type="button"
              className="cart-continue-button secondary"
              onClick={() => navigate("/")}
            >
              Continue Shopping
            </button>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default Cart;