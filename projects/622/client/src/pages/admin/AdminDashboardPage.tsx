import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type RecentOrder = {
  id: string;
  customerName: string;
  total: number;
  status: "pending" | "processing" | "shipped" | "completed" | "cancelled";
  createdAt: string;
};

type TopProduct = {
  id: string;
  name: string;
  sku: string;
  totalSold: number;
  revenue: number;
};

type LowInventoryItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
};

type AdminDashboardMetrics = {
  totalRevenue: number;
  totalOrders: number;
  pendingOrders: number;
  totalCustomers: number;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
  lowInventoryItems: LowInventoryItem[];
};

const mockMetrics: AdminDashboardMetrics = {
  totalRevenue: 45230.75,
  totalOrders: 812,
  pendingOrders: 27,
  totalCustomers: 389,
  recentOrders: [
    {
      id: "ORD-1024",
      customerName: "Alice Johnson",
      total: 129.99,
      status: "processing",
      createdAt: "2025-12-10T10:15:00Z",
    },
    {
      id: "ORD-1023",
      customerName: "Michael Chen",
      total: 59.5,
      status: "pending",
      createdAt: "2025-12-10T09:42:00Z",
    },
    {
      id: "ORD-1022",
      customerName: "Sarah Williams",
      total: 249.0,
      status: "shipped",
      createdAt: "2025-12-10T09:05:00Z",
    },
    {
      id: "ORD-1021",
      customerName: "David Brown",
      total: 89.99,
      status: "completed",
      createdAt: "2025-12-09T18:21:00Z",
    },
    {
      id: "ORD-1020",
      customerName: "Emily Davis",
      total: 42.75,
      status: "cancelled",
      createdAt: "2025-12-09T17:10:00Z",
    },
  ],
  topProducts: [
    {
      id: "PROD-001",
      name: "Wireless Noise-Cancelling Headphones",
      sku: "WH-1000",
      totalSold: 324,
      revenue: 29160,
    },
    {
      id: "PROD-002",
      name: "4K Ultra HD Monitor 27\"",
      sku: "MON-27-4K",
      totalSold: 198,
      revenue: 47520,
    },
    {
      id: "PROD-003",
      name: "Mechanical Keyboard RGB",
      sku: "KB-MECH-RGB",
      totalSold: 415,
      revenue: 24900,
    },
    {
      id: "PROD-004",
      name: "USB-C Docking Station",
      sku: "DOCK-USBC",
      totalSold: 152,
      revenue: 18240,
    },
    {
      id: "PROD-005",
      name: "Ergonomic Office Chair",
      sku: "CHAIR-ERGO",
      totalSold: 87,
      revenue: 34800,
    },
  ],
  lowInventoryItems: [
    {
      id: "PROD-010",
      name: "Wireless Mouse",
      sku: "MOUSE-WL",
      stock: 8,
      threshold: 15,
    },
    {
      id: "PROD-011",
      name: "Laptop Stand",
      sku: "STAND-LAP",
      stock: 4,
      threshold: 10,
    },
    {
      id: "PROD-012",
      name: "USB-C Cable 1m",
      sku: "USBC-1M",
      stock: 12,
      threshold: 25,
    },
  ],
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const formatDateTime = (value: string): string => {
  const date = new Date(value);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getStatusBadgeClasses = (status: RecentOrder["status"]): string => {
  switch (status) {
    case "pending":
      return "inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800";
    case "processing":
      return "inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800";
    case "shipped":
      return "inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800";
    case "completed":
      return "inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800";
    case "cancelled":
      return "inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800";
    default:
      return "inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800";
  }
};

const AdminDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const metrics = useMemo<AdminDashboardMetrics>(() => mockMetrics, []);

  const handleViewOrdersClick = () => {
    navigate("/admin/orders");
  };

  const handleViewInventoryClick = () => {
    navigate("/admin/inventory");
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              Overview of store performance, orders, and inventory health.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleViewOrdersClick}
              className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Go to Orders
            </button>
            <button
              type="button"
              onClick={handleViewInventoryClick}
              className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Manage Inventory
            </button>
          </div>
        </header>

        <main className="space-y-8">
          {/* KPI Cards */}
          <section aria-labelledby="dashboard-kpis">
            <h2 id="dashboard-kpis" className="sr-only">
              Key metrics
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                <div className="p-4">
                  <dt className="text-sm font-medium text-gray-500">
                    Total Revenue
                  </dt>
                  <dd className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-gray-900">
                      {formatCurrency(metrics.totalRevenue)}
                    </span>
                  </dd>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                <div className="p-4">
                  <dt className="text-sm font-medium text-gray-500">
                    Total Orders
                  </dt>
                  <dd className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-semibold text-gray-900">
                      {metrics.totalOrders.toLocaleString()}
                    </span>
                  </dd>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg bg-white shadow-sm">
                <div className="p-4">
                  <dt className="text-sm font-medium text-gray-500">
                    Pending