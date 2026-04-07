import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

interface OrderItem {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  imageUrl?: string | null;
}

interface Order {
  id: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  currency: string;
  items: OrderItem[];
}

interface OrdersResponse {
  orders: Order[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  PROCESSING: "bg-blue-100 text-blue-800 border border-blue-200",
  SHIPPED: "bg-purple-100 text-purple-800 border border-purple-200",
  DELIVERED: "bg-green-100 text-green-800 border border-green-200",
  CANCELLED: "bg-red-100 text-red-800 border border-red-200",
};

const formatCurrency = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `undefined undefined`;
  }
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [initialized, setInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/orders", {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (res.status === 401) {
        navigate("/login?redirect=/orders");
        return;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load orders");
      }

      const data: OrdersResponse = await res.json();
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error loading orders";
      setError(message);
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  };

  useEffect(() => {
    void fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [orders]
  );

  const hasOrders = initialized && sortedOrders.length > 0;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your Orders</h1>
          <p className="mt-1 text-sm text-gray-600">
            View your recent orders, their status, and totals. Click an order for full details.
          </p>
        </div>
        {hasOrders && (
          <button
            type="button"
            onClick={() => void fetchOrders()}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            Refresh
          </button>
        )}
      </div>

      {loading && !initialized && (
        <div className="mt-10 flex justify-center">
          <div className="flex items-center gap-2 text-gray-600">
            <svg
              className="h-5 w-5 animate-spin text-indigo-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <span className="text-sm">Loading your orders...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <div className="flex items-start">
            <svg
              className="mr-2 h-5 w-5 flex-shrink-0 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.5a.75.75 0 00-1.5 0v4.25a.75.75 0 001.5 0V6.5zM10 13.75a1 1 0 100 2 1 1 0 000-2z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p className="font-medium">Unable to load orders</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={() => void fetchOrders()}
                className="mt-2 inline-flex text-xs font-medium text-red-700 underline hover:text-red-900"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {initialized && !loading && !hasOrders && !error && (
        <div className="mt-10 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <svg
              className="h-6 w-6 text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.6}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 3h3l.879 2.637A2 2 0 008.735 7H19a1 1 0 01.962 1.273l-1.5 6A1 1 0 0117.5 15H8a2 2 0 01-1.962-1.51L4.2 4.5M10 19a1 1 0 11-2 0 1 1 0 012 0zm9 0a1 1 0 11-2.001-.001A1 1 0 0119 19z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900">No orders found</h2>
          <p className="mt-1 text-sm text-gray-600">
            You haven&apos;t placed any orders yet. When you do, they will appear here.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg