import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type StatCard = {
  id: string;
  label: string;
  value: number | string;
  trend?: number;
  helperText?: string;
  linkTo?: string;
  linkLabel?: string;
};

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
  price: number;
  stock: number;
  sold: number;
};

type AdminDashboardProps = {
  isLoading?: boolean;
  error?: string | null;
  stats?: {
    totalRevenue: number;
    totalOrders: number;
    totalProducts: number;
    lowStockProducts: number;
    pendingOrders: number;
    dailyRevenueChange?: number;
    ordersChange?: number;
  } | null;
  recentOrders?: RecentOrder[];
  topProducts?: TopProduct[];
  onRefresh?: () => Promise<void> | void;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  isLoading: externalLoading = false,
  error: externalError = null,
  stats: externalStats = null,
  recentOrders: externalRecentOrders,
  topProducts: externalTopProducts,
  onRefresh,
}) => {
  const [internalLoading, setInternalLoading] = useState<boolean>(false);
  const [internalError, setInternalError] = useState<string | null>(null);

  const isLoading = internalLoading || externalLoading;
  const error = internalError || externalError;

  const [stats, setStats] = useState<AdminDashboardProps["stats"]>(externalStats);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[] | undefined>(
    externalRecentOrders
  );
  const [topProducts, setTopProducts] = useState<TopProduct[] | undefined>(
    externalTopProducts
  );

  useEffect(() => {
    if (externalStats) setStats(externalStats);
  }, [externalStats]);

  useEffect(() => {
    if (externalRecentOrders) setRecentOrders(externalRecentOrders);
  }, [externalRecentOrders]);

  useEffect(() => {
    if (externalTopProducts) setTopProducts(externalTopProducts);
  }, [externalTopProducts]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    try {
      setInternalError(null);
      setInternalLoading(true);
      await onRefresh();
    } catch (err) {
      setInternalError(
        err instanceof Error ? err.message : "Failed to refresh dashboard data"
      );
    } finally {
      setInternalLoading(false);
    }
  };

  const statCards: StatCard[] = useMemo(
    () => [
      {
        id: "revenue",
        label: "Total Revenue",
        value: stats ? currencyFormatter.format(stats.totalRevenue) : "--",
        trend: stats?.dailyRevenueChange,
        helperText: "Lifetime gross revenue",
        linkTo: "/admin/orders",
        linkLabel: "View orders",
      },
      {
        id: "orders",
        label: "Total Orders",
        value: stats ? stats.totalOrders : "--",
        trend: stats?.ordersChange,
        helperText: stats ? `undefined pending` : "",
        linkTo: "/admin/orders?status=pending",
        linkLabel: "Manage orders",
      },
      {
        id: "products",
        label: "Products",
        value: stats ? stats.totalProducts : "--",
        helperText: stats ? `undefined low in stock` : "",
        linkTo: "/admin/products",
        linkLabel: "Manage products",
      },
    ],
    [stats]
  );

  const getStatusBadgeClasses = (status: RecentOrder["status"]): string => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800 border border-yellow-200";
      case "processing":
        return "bg-blue-100 text-blue-800 border border-blue-200";
      case "shipped":
        return "bg-purple-100 text-purple-800 border border-purple-200";
      case "completed":
        return "bg-emerald-100 text-emerald-800 border border-emerald-200";
      case "cancelled":
        return "bg-red-100 text-red-800 border border-red-200";
      default:
        return "bg-slate-100 text-slate-800 border border-slate-200";
    }
  };

  const getStatusLabel = (status: RecentOrder["status"]): string => {
    switch (status) {
      case "pending":
        return "Pending";
      case "processing":
        return "Processing";
      case "shipped":
        return "Shipped";
      case "completed":
        return "Completed";
      case "cancelled":
        return "Cancelled";
      default:
        return status;
    }
  };

  const renderTrendBadge = (trend?: number) => {
    if (trend === undefined || trend === null) return null;
    const isPositive = trend >= 0;
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium undefined`}
      >
        <span
          className={`mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full undefined`}
        >
          <svg
            className={`h-3 w-3 undefined`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            {isPositive ? (
              <path
                fillRule="evenodd"
                d="M5.22 11.78a.75.75 0 001.06 0L10 8.06l3.72 3.72a.75.75 0 101.06-1.06l-4.25-4.25a.75.75 0 00-1.06 0L5.22 10.72a.75.75 0 000 1.06z"
                clipRule="evenodd"
              />
            ) : (
              <path
                fillRule="evenodd"
                d="M14.78 8.22a.75.75 0 00-1.06 0L10 11.94 6.28 8.22a.75.75 0 10-1.06 1.06l4.25 4.25a.75.75 0 001.06 0l4.25-4.25a.75.75 0 000-1.06z"
                clipRule="evenodd"
              />
            )}
          </svg>
        </span>
        {isPositive ? "+" : ""}
        {trend.toFixed(1)}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Overview of store performance and quick access to management
              tools.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/"
              className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
            >
              <svg
                className="-ml-0.5 mr-2 h-4 w-4 text-slate-500"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 9.414V17a1 1 0 001 1h3a1 1 0