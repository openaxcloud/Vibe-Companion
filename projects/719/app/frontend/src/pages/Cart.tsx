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
  currency?: string;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
};

const formatCurrency = (value: number, currency: string = "USD"): string => {
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

const Cart: React.FC<CartProps> = ({
  items,
  currency = "USD",
  onUpdateQuantity,
  onRemoveItem,
}) => {
  const navigate = useNavigate();

  const handleDecrease = useCallback(
    (item: CartItem) => {
      const nextQty = item.quantity - 1;
      if (nextQty <= 0) {
        onRemoveItem(item.id);
      } else {
        onUpdateQuantity(item.id, nextQty);
      }
    },
    [onRemoveItem, onUpdateQuantity]
  );

  const handleIncrease = useCallback(
    (item: CartItem) => {
      const nextQty = item.quantity + 1;
      onUpdateQuantity(item.id, nextQty);
    },
    [onUpdateQuantity]
  );

  const handleChange = useCallback(
    (item: CartItem, value: string) => {
      const parsed = parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed <= 0) {
        onRemoveItem(item.id);
      } else {
        onUpdateQuantity(item.id, parsed);
      }
    },
    [onRemoveItem, onUpdateQuantity]
  );

  const handleProceedToCheckout = useCallback(() => {
    if (!items.length) return;
    navigate("/checkout");
  }, [items.length, navigate]);

  const subtotal = useMemo(
    () =>
      items.reduce((sum, item) => {
        return sum + item.price * item.quantity;
      }, 0),
    [items]
  );

  const isEmpty = items.length === 0;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={styles.heading}>Your Cart</h1>

        {isEmpty ? (
          <div style={styles.emptyState}>
            <p style={styles.emptyText}>Your cart is currently empty.</p>
            <button
              type="button"
              style={styles.continueButton}
              onClick={() => navigate("/products")}
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div style={styles.contentGrid}>
            <div style={styles.itemsColumn} aria-label="Shopping cart items">
              {items.map((item) => (
                <div key={item.id} style={styles.itemRow}>
                  {item.imageUrl && (
                    <div style={styles.itemImageWrapper}>
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={styles.itemImage}
                      />
                    </div>
                  )}
                  <div style={styles.itemDetails}>
                    <div style={styles.itemHeader}>
                      <span style={styles.itemName}>{item.name}</span>
                      <button
                        type="button"
                        style={styles.removeButton}
                        onClick={() => onRemoveItem(item.id)}
                        aria-label={`Remove undefined from cart`}
                      >
                        Remove
                      </button>
                    </div>
                    <div style={styles.itemMeta}>
                      <span style={styles.itemPrice}>
                        {formatCurrency(item.price, currency)}
                      </span>
                      <span style={styles.itemTotal}>
                        {formatCurrency(item.price * item.quantity, currency)}
                      </span>
                    </div>
                    <div style={styles.quantityRow}>
                      <span style={styles.quantityLabel}>Quantity</span>
                      <div style={styles.quantityControls}>
                        <button
                          type="button"
                          style={styles.quantityButton}
                          onClick={() => handleDecrease(item)}
                          aria-label={`Decrease quantity of undefined`}
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={item.quantity}
                          onChange={(e) =>
                            handleChange(item, e.target.value.trim())
                          }
                          style={styles.quantityInput}
                          aria-label={`Quantity of undefined`}
                        />
                        <button
                          type="button"
                          style={styles.quantityButton}
                          onClick={() => handleIncrease(item)}
                          aria-label={`Increase quantity of undefined`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside style={styles.summaryColumn} aria-label="Order summary">
              <h2 style={styles.summaryHeading}>Order Summary</h2>
              <div style={styles.summaryRow}>
                <span style={styles.summaryLabel}>Subtotal</span>
                <span style={styles.summaryValue}>
                  {formatCurrency(subtotal, currency)}
                </span>
              </div>
              <p style={styles.summaryNote}>
                Taxes and shipping calculated at checkout.
              </p>
              <button
                type="button"
                style={{
                  ...styles.checkoutButton,
                  ...(isEmpty ? styles.checkoutButtonDisabled : {}),
                }}
                onClick={handleProceedToCheckout}
                disabled={isEmpty}
              >
                Proceed to Checkout
              </button>
              <button
                type="button"
                style={styles.secondaryButton}
                onClick={() => navigate("/products")}
              >
                Continue Shopping
              </button>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
};

type StyleObject = React.CSSProperties;

const styles: { [key: string]: StyleObject } = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#f9fafb",
    padding: "32px 16px",
    boxSizing: "border-box",
  },
  container: {
    maxWidth: "960px",
    margin: "0 auto",
    backgroundColor: "#ffffff",
    borderRadius: 8,
    boxShadow: "0 10px 25px rgba(15, 23, 42, 0.08)",
    padding: 24,
  },
  heading: {
    fontSize: 28,
    fontWeight: 700,
    margin: "0 0 24px",
    color: "#111827",
  },
  emptyState: {
    padding: "40px 16px",
    textAlign: "center",
  },
  emptyText: {
    margin: "0 0 24px",
    fontSize: 16,
    color: "#4b5563",
  },
  continueButton: {
    border: "none",
    borderRadius: 6,
    padding: "10px 18px",
    backgroundColor: "#111827",
    color: "#ffffff",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 500,
  },
  contentGrid: {
    display: "grid",
    gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)",
    gap: 24,
  },
  itemsColumn: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  itemRow: {
    display: "flex",
    gap: 16,
    borderRadius: 8,
    border: "1px solid #e5e7eb",
    padding: 12,
    backgroundColor: "#f9fafb",
  },
  itemImageWrapper: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: "hidden",
    flexShrink: 0,
    backgroundColor: "#e5e7eb",
  },
  itemImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },
  itemDetails: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  itemHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  itemName: {
    fontSize: 16,
    fontWeight: 600,
    color: "#111827",
  },
  removeButton: {
    border: "none",
    background: "none",
    color: "#9ca3af",
    fontSize: 12,
    cursor: "pointer",
    padding: 0,
  },
  itemMeta: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    fontSize: 14,
    color: "#4b5563",
  },
  itemPrice: {
    fontWeight: 500,
  },
  itemTotal: {