import React, { useCallback, useEffect, useMemo, useState } from "react";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  items: OrderItem[];
}

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
}

interface ApiOrderResponse {
  orders: Order[];
}

interface ApiInventoryResponse {
  inventory: InventoryItem[];
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "#f97316",
  processing: "#3b82f6",
  shipped: "#0ea5e9",
  delivered: "#16a34a",
  cancelled: "#ef4444",
};

const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [loadingInventory, setLoadingInventory] = useState<boolean>(false);
  const [errorOrders, setErrorOrders] = useState<string | null>(null);
  const [errorInventory, setErrorInventory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoadingOrders(true);
    setErrorOrders(null);
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) {
        throw new Error(`Failed to fetch orders (undefined)`);
      }
      const data: ApiOrderResponse = await res.json();
      setOrders(data.orders);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error loading orders";
      setErrorOrders(message);
    } finally {
      setLoadingOrders(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setLoadingInventory(true);
    setErrorInventory(null);
    try {
      const res = await fetch("/api/admin/inventory");
      if (!res.ok) {
        throw new Error(`Failed to fetch inventory (undefined)`);
      }
      const data: ApiInventoryResponse = await res.json();
      setInventory(data.inventory);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error loading inventory";
      setErrorInventory(message);
    } finally {
      setLoadingInventory(false);
    }
  }, []);

  useEffect(() => {
    void fetchOrders();
    void fetchInventory();
  }, [fetchOrders, fetchInventory]);

  const handleStatusFilterChange = (value: string) => {
    if (value === "all") {
      setStatusFilter("all");
    } else if (["pending", "processing", "shipped", "delivered", "cancelled"].includes(value)) {
      setStatusFilter(value as OrderStatus);
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, newStatus: OrderStatus) => {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/undefined/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        throw new Error(`Failed to update order status (undefined)`);
      }
      const updatedOrder: Order = await res.json();
      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? updatedOrder : order))
      );
    } catch (err: unknown) {
      // In production, replace with proper toast/notification system
      // eslint-disable-next-line no-alert
      alert(
        err instanceof Error
          ? `Error updating order: undefined`
          : "Unknown error updating order"
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders
      .filter((order) => {
        if (statusFilter !== "all" && order.status !== statusFilter) {
          return false;
        }
        if (!searchTerm.trim()) {
          return true;
        }
        const term = searchTerm.toLowerCase();
        return (
          order.id.toLowerCase().includes(term) ||
          order.customerName.toLowerCase().includes(term) ||
          order.customerEmail.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, statusFilter, searchTerm]);

  const getStatusOptionsForOrder = (currentStatus: OrderStatus): OrderStatus[] => {
    const base: OrderStatus[] = ["pending", "processing", "shipped", "delivered", "cancelled"];
    if (currentStatus === "cancelled" || currentStatus === "delivered") {
      return [currentStatus];
    }
    return base;
  };

  const formatCurrency = (value: number): string =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(value);

  const formatDateTime = (value: string): string =>
    new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <div
      style={{
        padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundColor: "#f3f4f6",
        minHeight: "100vh",
        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "24px",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: "24px",
              fontWeight: 600,
              margin: 0,
              color: "#111827",
            }}
          >
            Admin Dashboard
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#6b7280", fontSize: "14px" }}>
            Manage orders and monitor inventory
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void fetchOrders();
            void fetchInventory();
          }}
          style={{
            borderRadius: "9999px",
            border: "1px solid #d1d5db",
            padding: "6px 14px",
            backgroundColor: "#ffffff",
            color: "#111827",
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Refresh
        </button>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "3fr 2fr",
          gap: "24px",
          alignItems: "flex-start",
        }}
      >
        {/* Orders Section */}
        <section
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
            padding: "16px 16px 8px 16px",
          }}
        >
          <div
            style={{
              paddingBottom: "12px",
              borderBottom: "1px solid #e5e7eb",
              marginBottom: "12px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <h2
              style={{
                fontSize: "16px",
                fontWeight: 600,
                margin: 0,
                color: "#111827",
              }}
            >
              Orders
            </h2>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                placeholder="Search by ID, name, email"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  padding: "6px 10