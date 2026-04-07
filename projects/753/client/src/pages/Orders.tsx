import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

type OrderStatus = "processing" | "shipped" | "delivered" | "cancelled";

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string; // ISO string
  total: number;
  currency: string;
  status: OrderStatus;
  itemCount: number;
}

interface OrdersResponse {
  orders: Order[];
}

const mockOrders: Order[] = [
  {
    id: "1",
    orderNumber: "ORD-20487",
    createdAt: "2025-11-12T14:23:00.000Z",
    total: 129.99,
    currency: "USD",
    status: "delivered",
    itemCount: 3,
  },
  {
    id: "2",
    orderNumber: "ORD-20488",
    createdAt: "2025-11-18T09:05:00.000Z",
    total: 59.5,
    currency: "USD",
    status: "shipped",
    itemCount: 1,
  },
  {
    id: "3",
    orderNumber: "ORD-20489",
    createdAt: "2025-11-20T19:30:00.000Z",
    total: 220.0,
    currency: "USD",
    status: "processing",
    itemCount: 5,
  },
  {
    id: "4",
    orderNumber: "ORD-20410",
    createdAt: "2025-10-01T10:15:00.000Z",
    total: 75.2,
    currency: "USD",
    status: "cancelled",
    itemCount: 2,
  },
];

const fetchOrders = async (): Promise<OrdersResponse> => {
  // Replace with real API integration
  await new Promise((resolve) => setTimeout(resolve, 350));
  return { orders: mockOrders };
};

const formatCurrency = (value: number, currency: string) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(value);

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));

const statusConfig: Record<
  OrderStatus,
  {
    label: string;
    className: string;
    dotClassName: string;
  }
> = {
  processing: {
    label: "Processing",
    className:
      "bg-blue-50 text-blue-700 ring-1 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-200 dark:ring-blue-900",
    dotClassName: "bg-blue-500",
  },
  shipped: {
    label: "Shipped",
    className:
      "bg-amber-50 text-amber-700 ring-1 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900",
    dotClassName: "bg-amber-500",
  },
  delivered: {
    label: "Delivered",
    className:
      "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900",
    dotClassName: "bg-emerald-500",
  },
  cancelled: {
    label: "Cancelled",
    className:
      "bg-rose-50 text-rose-700 ring-1 ring-rose-100 dark:bg-rose-950/40 dark:text-rose-200 dark:ring-rose-900",
    dotClassName: "bg-rose-500",
  },
};

const useQuery = () => {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
};

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();
  const query = useQuery();

  const statusFilter = (query.get("status") as OrderStatus | null) || "all";

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchOrders();
        if (!isMounted) return;
        setOrders(
          data.orders.slice().sort((a, b) => {
            const da = new Date(a.createdAt).getTime();
            const db = new Date(b.createdAt).getTime();
            return db - da;
          })
        );
      } catch (e) {
        if (!isMounted) return;
        setError("Unable to load orders. Please try again.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredOrders = useMemo(() => {
    if (statusFilter === "all") return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const handleStatusFilterChange = (value: string) => {
    const params = new URLSearchParams(query.toString());
    if (value === "all") {
      params.delete("status");
    } else {
      params.set("status", value);
    }
    navigate({ search: params.toString() ? `?undefined` : "" }, { replace: true });
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 sm:text-2xl">
            Order History
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            View your past orders, track shipment status, and open order details.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value)}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm outline-none ring-0 transition hover:bg-slate-50 focus:border-slate-400 focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 dark:focus:border-slate-500 dark:focus:ring-slate-800"
          >
            <option value="all">All</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </header>

      <section className="flex-1">
        {loading ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400 sm:p-8">
            Loading your orders...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700 shadow-sm dark:border-rose-900/70 dark:bg-rose-950/60 dark:text-rose-200 sm:p-5">
            {error}
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400 sm:p-8">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              No orders found.
            </p>
            <p className="mt-1">
              {statusFilter === "all"
                ? "You don’t have any orders yet."
                : "There are no orders with this status."}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-s