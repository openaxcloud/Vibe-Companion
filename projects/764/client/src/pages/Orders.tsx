import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl?: string;
}

interface Order {
  id: string;
  number: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  total: number;
  currency: string;
  items: OrderItem[];
}

interface AuthContextValue {
  isAuthenticated: boolean;
  loading: boolean;
  userId?: string;
  token?: string;
}

interface OrdersApiResponse {
  orders: Order[];
}

const useAuth = (): AuthContextValue => {
  // Placeholder hook; in a real app, replace with your auth context/logic
  const [loading] = useState<boolean>(false);
  const [isAuthenticated] = useState<boolean>(true);
  const [userId] = useState<string | undefined>("user_123");
  const [token] = useState<string | undefined>("mock-token");
  return { isAuthenticated, loading, userId, token };
};

const fetchOrders = async (token?: string): Promise<OrdersApiResponse> => {
  // Replace with real API call. Using mock data for now.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const mock: OrdersApiResponse = {
    orders: [
      {
        id: "1",
        number: "ORD-001",
        createdAt: "2025-10-01T10:24:00.000Z",
        updatedAt: "2025-10-02T15:30:00.000Z",
        status: "processing",
        total: 129.98,
        currency: "USD",
        items: [
          {
            id: "sku-1",
            name: "Wireless Headphones",
            quantity: 1,
            price: 89.99,
            imageUrl: "https://via.placeholder.com/64",
          },
          {
            id: "sku-2",
            name: "USB-C Charging Cable",
            quantity: 2,
            price: 19.99,
            imageUrl: "https://via.placeholder.com/64",
          },
        ],
      },
      {
        id: "2",
        number: "ORD-002",
        createdAt: "2025-09-20T09:15:00.000Z",
        updatedAt: "2025-09-24T12:00:00.000Z",
        status: "delivered",
        total: 59.99,
        currency: "USD",
        items: [
          {
            id: "sku-3",
            name: "Bluetooth Speaker",
            quantity: 1,
            price: 59.99,
            imageUrl: "https://via.placeholder.com/64",
          },
        ],
      },
      {
        id: "3",
        number: "ORD-003",
        createdAt: "2025-09-10T13:42:00.000Z",
        updatedAt: "2025-09-11T08:10:00.000Z",
        status: "cancelled",
        total: 39.99,
        currency: "USD",
        items: [
          {
            id: "sku-4",
            name: "Wireless Mouse",
            quantity: 1,
            price: 39.99,
            imageUrl: "https://via.placeholder.com/64",
          },
        ],
      },
    ],
  };
  void token;
  return mock;
};

const formatCurrency = (value: number, currency: string): string =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(value);

const formatDate = (iso: string): string =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

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

const getStatusColorClass = (status: OrderStatus): string => {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "processing":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "shipped":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "delivered":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "cancelled":
      return "bg-rose-100 text-rose-800 border-rose-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const Orders: React.FC = () => {
  const { isAuthenticated, loading: authLoading, token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const navigate = useNavigate();

  useEffect(() => {
    if (!isAuthenticated || authLoading) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchOrders(token);
        if (!cancelled) {
          setOrders(res.orders);
          if (res.orders.length > 0 && !selectedOrderId) {
            setSelectedOrderId(res.orders[0].id);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load orders. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, authLoading, token, selectedOrderId]);

  const selectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId]
  );

  if (!authLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const handleOrderClick = (orderId: string) => {
    setSelectedOrderId(orderId);
  };

  const handleViewDetailsMobile = (orderId: string) => {
    setSelectedOrderId(orderId);
    const el = document.getElementById("order-detail-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleBackToListMobile = () => {
    const el = document.getElementById("orders-list-panel");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleGoToShop = () => {
    navigate("/shop");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 lg:py-10">
        <header className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 sm:text-3xl">Your Orders</h1>
            <p className="mt-1 text-sm text-slate-600">
              View your recent orders, track their status, and review item details.
            </p>
          </div>
        </header>

        {authLoading || loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex items-center gap-3 text-slate-500">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
              <span className="text-sm">Loading your orders…</span>
            </div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-s