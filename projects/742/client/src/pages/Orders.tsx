import React, { useCallback, useEffect, useMemo, useState } from "react";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  items?: OrderItem[];
  notes?: string;
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
  pending: "#fbbf24",
  processing: "#3b82f6",
  shipped: "#6366f1",
  delivered: "#16a34a",
  cancelled: "#ef4444",
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value);

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
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
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [refreshIndex, setRefreshIndex] = useState<number>(0);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/orders", {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders (status undefined)`);
      }

      const data: OrdersResponse | Order[] = await response.json();
      const normalizedOrders: Order[] = Array.isArray(data)
        ? data
        : Array.isArray((data as OrdersResponse).orders)
        ? (data as OrdersResponse).orders
        : [];

      setOrders(
        normalizedOrders
          .slice()
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          )
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error while fetching orders";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders, refreshIndex]);

  const handleRefresh = useCallback(() => {
    setRefreshIndex((prev) => prev + 1);
  }, []);

  const handleRowClick = useCallback((order: Order) => {
    setSelectedOrder(order);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  const hasOrders = useMemo(() => orders.length > 0, [orders]);

  return (
    <div
      style={{
        padding: "24px",
        maxWidth: "1120px",
        margin: "0 auto",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "24px",
              fontWeight: 600,
              color: "#111827",
            }}
          >
            Your Orders
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "14px",
              color: "#6b7280",
            }}
          >
            View the status and details of your recent orders.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          style={{
            padding: "8px 14px",
            fontSize: "14px",
            borderRadius: "6px",
            border: "1px solid #d1d5db",
            backgroundColor: "#ffffff",
            color: "#111827",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span>Refresh</span>
        </button>
      </header>

      {loading && (
        <div
          style={{
            padding: "40px 16px",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          Loading orders...
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            marginBottom: "16px",
            padding: "12px 16px",
            borderRadius: "8px",
            backgroundColor: "#fef2f2",
            color: "#b91c1c",
            fontSize: "14px",
            border: "1px solid #fecaca",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: "4px" }}>Error</div>
          <div>{error}</div>
        </div>
      )}

      {!loading && !error && !hasOrders && (
        <div
          style={{
            padding: "40px 16px",
            textAlign: "center",
            color: "#6b7280",
            fontSize: "14px",
            borderRadius: "12px",
            border: "1px dashed #e5e7eb",
            backgroundColor: "#f9fafb",
          }}
        >
          You have no orders yet.
        </div>
      )}

      {!loading && !error && hasOrders && (
        <div
          style={{
            borderRadius: "12px",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            backgroundColor: "#ffffff",
          }}
        >
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "14px",
            }}
          >
            <thead
              style={{
                backgroundColor: "#f9fafb",
                borderBottom: "1px solid #e5e7eb",
              }}
            >
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 16px",
                    fontWeight: 500,
                    color: "#6b7280",
                  }}
                >
                  Order ID
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 16px",
                    fontWeight: 500,
                    color: "#6b7280",
                  }}
                >
                  Date
                </th>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 16px",
                    fontWeight: 500,
                    color: "#6b7280",
                  }}
                >
                  Status
                </th>
                <th
                  style={{
                    textAlign: "right",
                    padding: "10px 16px",
                    fontWeight: 500,
                    color: "#6b7280",
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const statusColor = STATUS_COLORS[order.status];
                return (
                  <tr
                    key={order.id}
                    onClick={() => handleRowClick(order)}
                    style={{
                      cursor: "pointer",
                      borderBottom: "1px solid #f3f4f6",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 16px",
                        color: "#111827",
                        fontFamily: "monospace",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {order.id}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                        color: "#4b5563",
                      }}
                    >
                      {formatDateTime(order.createdAt)}
                    </td>
                    <td
                      style={{
                        padding: "10px 16px",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          backgroundColor: "#f3f4f6",
                          color: "#111827",
                          fontSize: "12px",
                          fontWeight: 500,
                        }}
                      >
                        <span
                          style={{
                            width: "8px",