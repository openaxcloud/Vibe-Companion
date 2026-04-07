import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  currency: string;
  createdAt: string;
}

interface OrdersResponse {
  orders: Order[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-800 border-indigo-200",
  delivered: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
};

const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(amount);
  } catch {
    return `undefined undefined`;
  }
};

const formatDateTime = (iso: string): string => {
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
  const [error, setError] = useState<string | null>(null);
  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/orders", {
        method: "GET",
        headers: {
          "Accept": "application/json",
        },
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error(`Failed to load orders (status undefined)`);
      }

      const data: OrdersResponse | Order[] = await res.json();
      const normalizedOrders = Array.isArray(data) ? data : data.orders;
      setOrders(normalizedOrders);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load orders. Please try again.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders, refreshIndex]);

  const handleRetry = () => {
    setRefreshIndex((i) => i + 1);
  };

  const hasOrders = useMemo(() => orders.length > 0, [orders]);

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:mb-8 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl">Your Orders</h1>
          <p className="mt-1 text-sm text-gray-600">
            View the status and details of your recent purchases.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={loading}
          className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <>
              <svg
                className="-ml-0.5 mr-2 h-4 w-4 animate-spin text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
              Refreshing...
            </>
          ) : (
            <>
              <svg
                className="-ml-0.5 mr-2 h-4 w-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M4.5 4.5v5h5m10 10v-5h-5m5-5A8.5 8.5 0 0012 3.5 8.46 8.46 0 006.25 6M18 18A8.5 8.5 0 016 18.25"
                />
              </svg>
              Refresh
            </>
          )}
        </button>
      </div>

      {loading && !hasOrders && !error && (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="flex flex-col items-center text-gray-600">
            <svg
              className="mb-4 h-8 w-8 animate-spin text-gray-400"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
            <p className="text-sm">Loading your orders...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-start">
            <svg
              className="mr-2 h-5 w-5 text-red-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M12 9v4m0 4h.01M5.07 19h13.86a1 1 0 00.87-1.5L12.87 5.5a1 1 0 00-1.74 0L4.2 17.5A1 1 0 005.07 19z"
              />
            </svg>
            <div>
              <p className="font-medium">Unable to load orders</p>
              <p className="mt-1">{error}</p>
              <button
                type="button"
                onClick={handleRetry}
                className="mt-2 inline-flex text-xs font-medium text-red-700 underline hover:text-red-800"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !hasOrders && (
        <div className="flex flex-1 items-center justify-center py-16">
          <div className="flex flex-col items-center text-center">
            <svg
              className="mb-4 h-10 w-10 text-gray-300"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 6h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V6z"