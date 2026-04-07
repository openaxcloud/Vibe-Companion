import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type CartItem = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  stock: number;
};

type CartPageProps = {
  initialCartItems?: CartItem[];
  taxRate?: number; // decimal (e.g. 0.07 for 7%)
  currency?: string;
  onCheckout?: (payload: {
    items: CartItem[];
    subtotal: number;
    tax: number;
    total: number;
  }) => Promise<void> | void;
};

const DEFAULT_TAX_RATE = 0.07;
const DEFAULT_CURRENCY = "USD";

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const CartPage: React.FC<CartPageProps> = ({
  initialCartItems,
  taxRate = DEFAULT_TAX_RATE,
  currency = DEFAULT_CURRENCY,
  onCheckout,
}) => {
  const navigate = useNavigate();
  const [cartItems, setCartItems] = useState<CartItem[]>(initialCartItems || []);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mock: hydrate from localStorage on mount if no initial items are provided
  useEffect(() => {
    if (!initialCartItems) {
      try {
        const raw = window.localStorage.getItem("cart:items");
        if (raw) {
          const parsed: CartItem[] = JSON.parse(raw);
          setCartItems(parsed);
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [initialCartItems]);

  useEffect(() => {
    try {
      window.localStorage.setItem("cart:items", JSON.stringify(cartItems));
    } catch {
      // ignore storage errors
    }
  }, [cartItems]);

  const handleIncrement = useCallback(
    (id: string) => {
      setCartItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, item.stock),
              }
            : item
        )
      );
    },
    [setCartItems]
  );

  const handleDecrement = useCallback(
    (id: string) => {
      setCartItems((prev) =>
        prev
          .map((item) =>
            item.id === id
              ? {
                  ...item,
                  quantity: Math.max(item.quantity - 1, 1),
                }
              : item
          )
          .filter((item) => item.quantity > 0)
      );
    },
    [setCartItems]
  );

  const handleRemove = useCallback(
    (id: string) => {
      setCartItems((prev) => prev.filter((item) => item.id !== id));
    },
    [setCartItems]
  );

  const handleQuantityChange = useCallback(
    (id: string, value: string) => {
      const numeric = parseInt(value, 10);
      if (Number.isNaN(numeric)) return;
      setCartItems((prev) =>
        prev
          .map((item) =>
            item.id === id
              ? {
                  ...item,
                  quantity: Math.min(Math.max(numeric, 1), item.stock),
                }
              : item
          )
          .filter((item) => item.quantity > 0)
      );
    },
    [setCartItems]
  );

  const { subtotal, tax, total, isValid } = useMemo(() => {
    const validItems = cartItems.filter((item) => item.quantity > 0 && item.stock > 0);
    const subtotalValue = validItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const taxValue = subtotalValue * taxRate;
    const totalValue = subtotalValue + taxValue;

    const valid =
      validItems.length > 0 &&
      validItems.every(
        (item) =>
          item.quantity > 0 &&
          item.quantity <= item.stock &&
          Number.isFinite(item.price) &&
          item.price >= 0
      );

    return {
      subtotal: subtotalValue,
      tax: taxValue,
      total: totalValue,
      isValid: valid,
    };
  }, [cartItems, taxRate]);

  const handleCheckout = useCallback(async () => {
    if (!isValid || cartItems.length === 0) return;
    setError(null);
    setIsCheckingOut(true);
    try {
      const payload = { items: cartItems, subtotal, tax, total };
      if (onCheckout) {
        await onCheckout(payload);
      } else {
        // default behavior: navigate to a checkout route with state
        navigate("/checkout", {
          state: payload,
        });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An error occurred during checkout.";
      setError(message);
    } finally {
      setIsCheckingOut(false);
    }
  }, [cartItems, isValid, navigate, onCheckout, subtotal, tax, total]);

  const handleContinueShopping = useCallback(() => {
    navigate("/products");
  }, [navigate]);

  const isCartEmpty = cartItems.length === 0;

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        padding: "24px 16px 48px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#111827",
      }}
    >
      <header style={{ marginBottom: "24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>Shopping Cart</h1>
        <button
          type="button"
          onClick={handleContinueShopping}
          style={{
            border: "none",
            background: "transparent",
            color: "#2563EB",
            fontSize: "0.95rem",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Continue shopping
        </button>
      </header>

      {isCartEmpty ? (
        <div
          style={{
            borderRadius: "0.75rem",
            border: "1px dashed #D1D5DB",
            padding: "40px 24px",
            textAlign: "center",
            backgroundColor: "#F9FAFB",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: "1.05rem" }}>Your cart is empty.</p>
          <button
            type="button"
            onClick={handleContinueShopping}
            style={{
              marginTop: "8px",
              padding: "8px 16px",
              borderRadius: "999px",
              border: "1px solid #2563EB",
              background: "#2563EB",
              color: "#FFFFFF",
              fontWeight: 500,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Browse products
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(260px, 1fr)",
            gap: "24px",
            alignItems: "flex-start",
          }}
        >
          <section
            aria-label="Cart items"
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "0.75rem",
              border: "1px solid #E5E7EB",
              padding: "16px",
            }}
          >
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {cartItems.map((item) => {
                const lineTotal = item.price * item.quantity;
                const isOutOfStock = item.stock <= 0;
                const quantityTooHigh = item.quantity > item.stock;

                return (
                  <li
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: "16px",
                      padding: "12px 0",
                      borderBottom: "1px solid #E5E7EB",
                    }}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={{
                          width: "72px",
                          height: "72px",
                          objectFit: "cover",
                          borderRadius: "0.5rem",
                          border: "1px solid #E5E7EB",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        style={{
                          width: "72px",
                          height: "72px",
                          borderRadius: "0.5rem",
                          border: "1px solid #E5E7EB