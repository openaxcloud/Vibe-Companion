import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface Order {
  id: string;
  createdAt: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  itemsCount: number;
}

interface OrdersApiResponse {
  orders: Order[];
}

const ORDERS_API_ENDPOINT = "/api/orders";

const formatCurrency = (value: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
    }).format(value);
  } catch {
    return `undefined undefined`;
  }
};

const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const getStatusLabel = (status: OrderStatus): string => {
  switch (status) {
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status;
  }
};

const getStatusClassName = (status: OrderStatus): string => {
  switch (status) {
    case "pending":
      return "bg-yellow-100 text-yellow-800 border border-yellow-200";
    case "processing":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "shipped":
      return "bg-indigo-100 text-indigo-800 border border-indigo-200";
    case "delivered":
      return "bg-green-100 text-green-800 border border-green-200";
    case "cancelled":
      return "bg-red-100 text-red-800 border border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border border-gray-200";
  }
};

const OrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");

  useEffect(() => {
    let isSubscribed = true;

    const fetchOrders = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(ORDERS_API_ENDPOINT, {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error(`Failed to load orders (status undefined)`);
        }

        const data: OrdersApiResponse = await response.json();

        if (isSubscribed) {
          setOrders(Array.isArray(data.orders) ? data.orders : []);
        }
      } catch (err) {
        if (isSubscribed) {
          const message =
            err instanceof Error ? err.message : "An unexpected error occurred while loading orders.";
          setError(message);
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    fetchOrders();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const hasOrders = filteredOrders.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Your Orders</h1>
          <p className="mt-1 text-sm text-gray-600">
            View your recent orders, their current status, and details.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-sm text-gray-700">
            Filter by status:
          </label>
          <select
            id="status-filter"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatus | "all")}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <div className="flex items-center gap-3 text-gray-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <span className="text-sm">Loading your orders...</span>
          </div>
        </div>
      )}

      {!isLoading && error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!isLoading && !error && !hasOrders && (
        <div className="rounded-md border border-gray-200 bg-white px-6 py-10 text-center shadow-sm">
          <p className="text-base font-medium text-gray-900">You have no orders yet.</p>
          <p className="mt-1 text-sm text-gray-600">
            When you place an order, it will appear here with its status and details.
          </p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
          >
            Browse products
          </Link>
        </div>
      )}

      {!isLoading && !error && hasOrders && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <div className="hidden bg-gray-50 px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 sm:grid sm:grid-cols-5">
            <div className="col-span-2">Order</div>
            <div>Items</div>
            <div>Total</div>
            <div>Status</div>
          </div>
          <ul className="divide-y divide-gray-200">
            {filteredOrders.map((order) => (
              <li key={order.id} className="px-4 py-4 sm:px-6">
                <Link
                  to={`/orders/undefined`}
                  className="flex flex-col gap-3 sm:grid sm:grid-cols-5 sm:items-center"
                >
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-indigo-700 hover:underline">
                      Order #{order.id}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Placed on {formatDate(order.createdAt)}
                    </p>
                  </div>

                  <div className="text-sm text-gray-700">
                    {order.itemsCount} item{order.itemsCount === 1 ? "" : "s"}
                  </div>

                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(order.totalAmount, order.currency)}
                  </div>

                  <div className="flex items-center">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium undefined`}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default OrdersPage;