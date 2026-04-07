import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

type OrderItem = {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
};

type OrderSummary = {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  currency: string;
  email: string;
  placedAt: string;
};

type LocationState = {
  order?: OrderSummary;
  orderId?: string;
};

const formatCurrency = (amount: number, currency: string = "USD"): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$undefined`;
  }
};

const formatDate = (isoDate: string): string => {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

const mockFetchOrder = async (orderId: string): Promise<OrderSummary> => {
  await new Promise((resolve) => setTimeout(resolve, 600));
  const now = new Date().toISOString();
  return {
    id: orderId,
    email: "customer@example.com",
    placedAt: now,
    currency: "USD",
    items: [
      {
        id: "item-1",
        name: "Premium Wireless Headphones",
        quantity: 1,
        price: 199.99,
        imageUrl:
          "https://via.placeholder.com/80x80.png?text=Headphones",
      },
      {
        id: "item-2",
        name: "USB-C Charging Cable",
        quantity: 2,
        price: 14.99,
        imageUrl:
          "https://via.placeholder.com/80x80.png?text=Cable",
      },
    ],
    subtotal: 229.97,
    tax: 18.40,
    shipping: 5.99,
    total: 254.36,
  };
};

const OrderConfirmationPage: React.FC = () => {
  const { orderId: orderIdParam } = useParams<{ orderId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { state } = location as { state: LocationState | null };
  const [order, setOrder] = useState<OrderSummary | null>(
    state?.order ?? null
  );
  const [isLoading, setIsLoading] = useState<boolean>(!state?.order && !!orderIdParam);
  const [error, setError] = useState<string | null>(null);

  const orderId = useMemo<string | undefined>(() => {
    if (state?.order?.id) return state.order.id;
    if (state?.orderId) return state.orderId;
    if (orderIdParam) return orderIdParam;
    return undefined;
  }, [state, orderIdParam]);

  useEffect(() => {
    let isMounted = true;

    const loadOrder = async () => {
      if (!orderId || order) return;

      setIsLoading(true);
      setError(null);

      try {
        const data = await mockFetchOrder(orderId);
        if (!isMounted) return;
        setOrder(data);
      } catch (e) {
        if (!isMounted) return;
        setError("Unable to load your order details. Please try again.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (!order && orderId) {
      loadOrder();
    } else if (!order && !orderId) {
      setError("Missing order information.");
      setIsLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [orderId, order]);

  const handleBackToShop = () => {
    navigate("/", { replace: true });
  };

  const handleViewOrderHistory = () => {
    navigate("/account/orders");
  };

  const renderItems = () => {
    if (!order || !order.items.length) {
      return (
        <p className="text-sm text-gray-500">
          No items found for this order.
        </p>
      );
    }

    return (
      <ul className="divide-y divide-gray-200">
        {order.items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between py-4"
          >
            <div className="flex items-center space-x-4">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-16 w-16 rounded-md object-cover border border-gray-200"
                />
              )}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {item.name}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Qty: {item.quantity}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {formatCurrency(item.price * item.quantity, order.currency)}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {formatCurrency(item.price, order.currency)} each
              </p>
            </div>
          </li>
        ))}
      </ul>
    );
  };

  const renderSummary = () => {
    if (!order) return null;

    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">
          Order summary
        </h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-gray-600">Subtotal</dt>
            <dd className="font-medium text-gray-900">
              {formatCurrency(order.subtotal, order.currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-600">Tax</dt>
            <dd className="font-medium text-gray-900">
              {formatCurrency(order.tax, order.currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-gray-600">Shipping</dt>
            <dd className="font-medium text-gray-900">
              {order.shipping === 0
                ? "Free"
                : formatCurrency(order.shipping, order.currency)}
            </dd>
          </div>
          <div className="border-t border-gray-200 pt-3 mt-3 flex items-center justify-between">
            <dt className="text-sm font-semibold text-gray-900">
              Total
            </dt>
            <dd className="text-base font-bold text-gray-900">
              {formatCurrency(order.total, order.currency)}
            </dd>
          </div>
        </dl>
      </div>
    );
  };

  const renderHeader = () => {
    const email = order?.email;
    const placedAt = order?.placedAt;

    return (
      <div className="text-center">
        <svg
          className="mx-auto h-12 w-12 text-green-500"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2"
            className="text-green-500/20"
          />
          <path
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12.5l2.5 2.5L16 9"
          />
        </svg>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight text-gray-900">
          Thank you for your order
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Your order has been placed successfully.
        </p>

        {orderId && (
          <p className="mt-1 text-xs text-gray-500">
            Order ID:{" "}
            <span className="font-mono font-medium text-gray-800">
              {orderId}
            </span>
          </p>
        )}

        {placedAt && (
          <p className="mt-1 text-xs text-gray-500">
            Placed on {formatDate(placedAt)}
          </p>
        )}

        {email && (
          <p className="mt-3 text-sm text-gray