import React, { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type CartProps = {
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  currencySymbol?: string;
};

const Cart: React.FC<CartProps> = ({
  items,
  onUpdateQuantity,
  onRemoveItem,
  currencySymbol = "$",
}) => {
  const navigate = useNavigate();

  const handleQuantityChange = useCallback(
    (id: string, value: string) => {
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) return;
      onUpdateQuantity(id, parsed);
    },
    [onUpdateQuantity]
  );

  const handleDecrement = useCallback(
    (item: CartItem) => {
      if (item.quantity <= 1) return;
      onUpdateQuantity(item.id, item.quantity - 1);
    },
    [onUpdateQuantity]
  );

  const handleIncrement = useCallback(
    (item: CartItem) => {
      onUpdateQuantity(item.id, item.quantity + 1);
    },
    [onUpdateQuantity]
  );

  const handleRemove = useCallback(
    (id: string) => {
      onRemoveItem(id);
    },
    [onRemoveItem]
  );

  const handleCheckout = useCallback(() => {
    if (!items.length) return;
    navigate("/checkout");
  }, [items.length, navigate]);

  const itemsSubtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        return sum + item.price * item.quantity;
      }, 0),
    [items]
  );

  const formattedCurrency = useCallback(
    (value: number) =>
      `undefinedundefined)+(?!\d))/g, ",")}`,
    [currencySymbol]
  );

  const isCartEmpty = items.length === 0;

  return (
    <div className="cart-page">
      <h1 className="cart-title">Shopping Cart</h1>

      <div className="cart-layout">
        <section className="cart-items-section">
          {isCartEmpty ? (
            <div className="cart-empty">
              <p>Your cart is currently empty.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate("/products")}
              >
                Browse Products
              </button>
            </div>
          ) : (
            <ul className="cart-items-list">
              {items.map((item) => {
                const lineTotal = item.price * item.quantity;
                return (
                  <li key={item.id} className="cart-item">
                    {item.imageUrl && (
                      <div className="cart-item-image">
                        <img src={item.imageUrl} alt={item.name} />
                      </div>
                    )}
                    <div className="cart-item-main">
                      <div className="cart-item-header">
                        <h2 className="cart-item-name">{item.name}</h2>
                        <button
                          type="button"
                          className="cart-item-remove"
                          onClick={() => handleRemove(item.id)}
                          aria-label={`Remove undefined from cart`}
                        >
                          Remove
                        </button>
                      </div>
                      <div className="cart-item-details">
                        <div className="cart-item-price">
                          <span className="label">Price:</span>
                          <span className="value">
                            {formattedCurrency(item.price)}
                          </span>
                        </div>

                        <div className="cart-item-quantity">
                          <span className="label">Quantity:</span>
                          <div className="quantity-controls">
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => handleDecrement(item)}
                              disabled={item.quantity <= 1}
                              aria-label={`Decrease quantity of undefined`}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="quantity-input"
                              value={item.quantity}
                              onChange={(e) =>
                                handleQuantityChange(item.id, e.target.value)
                              }
                              aria-label={`Quantity of undefined`}
                            />
                            <button
                              type="button"
                              className="quantity-btn"
                              onClick={() => handleIncrement(item)}
                              aria-label={`Increase quantity of undefined`}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="cart-item-total">
                          <span className="label">Total:</span>
                          <span className="value">
                            {formattedCurrency(lineTotal)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="cart-summary-section">
          <div className="cart-summary-card">
            <h2 className="cart-summary-title">Order Summary</h2>

            <div className="cart-summary-row">
              <span>Items ({items.length})</span>
              <span>{formattedCurrency(itemsSubtotal)}</span>
            </div>

            <div className="cart-summary-row cart-summary-total">
              <span>Estimated Total</span>
              <span>{formattedCurrency(itemsSubtotal)}</span>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-checkout"
              onClick={handleCheckout}
              disabled={isCartEmpty}
            >
              Proceed to Checkout
            </button>

            {!isCartEmpty && (
              <button
                type="button"
                className="btn btn-secondary btn-continue"
                onClick={() => navigate("/products")}
              >
                Continue Shopping
              </button>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Cart;