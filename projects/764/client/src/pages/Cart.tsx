import React, { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type CartItem = {
  id: string;
  name: string;
  description?: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  maxQuantity?: number;
};

type CartSummary = {
  subtotal: number;
  tax: number;
  total: number;
  itemCount: number;
};

const TAX_RATE = 0.07;

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);

const Cart: React.FC = () => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: "1",
      name: "Sample Product A",
      description: "A short description of product A.",
      price: 29.99,
      quantity: 2,
      imageUrl: "https://via.placeholder.com/80x80.png?text=Product+A",
      maxQuantity: 10,
    },
    {
      id: "2",
      name: "Sample Product B",
      description: "A short description of product B.",
      price: 49.5,
      quantity: 1,
      imageUrl: "https://via.placeholder.com/80x80.png?text=Product+B",
      maxQuantity: 5,
    },
  ]);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const calculateSummary = useCallback(
    (items: CartItem[]): CartSummary => {
      const subtotal = items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
      const tax = subtotal * TAX_RATE;
      const total = subtotal + tax;
      const itemCount = items.reduce((count, item) => count + item.quantity, 0);

      return { subtotal, tax, total, itemCount };
    },
    []
  );

  const summary = useMemo(() => calculateSummary(cartItems), [cartItems, calculateSummary]);

  const handleQuantityChange = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setCartItems(prev =>
      prev.map(item =>
        item.id === id
          ? {
              ...item,
              quantity: item.maxQuantity
                ? Math.min(quantity, item.maxQuantity)
                : quantity,
            }
          : item
      )
    );
  };

  const handleRemoveItem = (id: string) => {
    setCartItems(prev => prev.filter(item => item.id !== id));
  };

  const handleClearCart = () => {
    setCartItems([]);
  };

  const handleProceedToCheckout = async () => {
    if (!cartItems.length || isProcessing) return;
    try {
      setIsProcessing(true);
      // Simulate an async operation (e.g., API call to create checkout session)
      await new Promise(resolve => setTimeout(resolve, 500));
      navigate("/checkout", { state: { cartItems, summary } });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!cartItems.length) {
    return (
      <div className="cart-page">
        <h1 className="cart-title">Your Cart</h1>
        <div className="cart-empty">
          <p>Your shopping cart is currently empty.</p>
          <button
            type="button"
            className="cart-empty-cta"
            onClick={() => navigate("/products")}
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1 className="cart-title">Your Cart</h1>
      <div className="cart-layout">
        <section className="cart-items-section">
          <header className="cart-items-header">
            <span className="cart-items-header-product">Product</span>
            <span className="cart-items-header-qty">Quantity</span>
            <span className="cart-items-header-price">Price</span>
            <span className="cart-items-header-total">Total</span>
          </header>

          <ul className="cart-items-list">
            {cartItems.map(item => (
              <li key={item.id} className="cart-item-row">
                <div className="cart-item-product">
                  {item.imageUrl && (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="cart-item-image"
                    />
                  )}
                  <div className="cart-item-details">
                    <div className="cart-item-name">{item.name}</div>
                    {item.description && (
                      <div className="cart-item-description">
                        {item.description}
                      </div>
                    )}
                    <button
                      type="button"
                      className="cart-item-remove"
                      onClick={() => handleRemoveItem(item.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="cart-item-qty">
                  <button
                    type="button"
                    className="cart-item-qty-btn"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity - 1)
                    }
                    disabled={item.quantity <= 1}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    className="cart-item-qty-input"
                    min={1}
                    max={item.maxQuantity ?? undefined}
                    value={item.quantity}
                    onChange={e =>
                      handleQuantityChange(item.id, Number(e.target.value))
                    }
                  />
                  <button
                    type="button"
                    className="cart-item-qty-btn"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity + 1)
                    }
                    disabled={
                      typeof item.maxQuantity === "number" &&
                      item.quantity >= item.maxQuantity
                    }
                  >
                    +
                  </button>
                </div>

                <div className="cart-item-price">
                  {formatCurrency(item.price)}
                </div>

                <div className="cart-item-line-total">
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </li>
            ))}
          </ul>

          <div className="cart-actions">
            <button
              type="button"
              className="cart-continue-shopping"
              onClick={() => navigate("/products")}
            >
              Continue Shopping
            </button>
            <button
              type="button"
              className="cart-clear"
              onClick={handleClearCart}
            >
              Clear Cart
            </button>
          </div>
        </section>

        <aside className="cart-summary-section">
          <h2 className="cart-summary-title">Order Summary</h2>
          <div className="cart-summary-row">
            <span>Items ({summary.itemCount})</span>
            <span>{formatCurrency(summary.subtotal)}</span>
          </div>
          <div className="cart-summary-row">
            <span>Estimated Tax</span>
            <span>{formatCurrency(summary.tax)}</span>
          </div>
          <div className="cart-summary-divider" />
          <div className="cart-summary-row cart-summary-total">
            <span>Total</span>
            <span>{formatCurrency(summary.total)}</span>
          </div>
          <button
            type="button"
            className="cart-checkout-btn"
            onClick={handleProceedToCheckout}
            disabled={isProcessing || !cartItems.length}
          >
            {isProcessing ? "Processing..." : "Proceed to Checkout"}
          </button>
          <p className="cart-summary-note">
            Taxes and any applicable shipping will be finalized at checkout.
          </p>
        </aside>
      </div>
    </div>
  );
};

export default Cart;