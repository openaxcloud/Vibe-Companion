import React, { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

type OrderStatus = "PENDING" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  orderNumber: string;
  createdAt: string;
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  items: OrderItem[];
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

interface AccountPageProps {}

async function fetchCurrentUserProfile(): Promise<UserProfile> {
  const res = await fetch("/api/me", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load profile");
  }

  return res.json();
}

async function fetchUserOrders(): Promise<Order[]> {
  const res = await fetch("/api/orders", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to load orders");
  }

  return res.json();
}

const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(amount);

const formatDateTime = (value: string): string =>
  new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const statusLabel: Record<OrderStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const statusColorClass: Record<OrderStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED: "bg-indigo-100 text-indigo-800",
  DELIVERED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

const AccountPage: React.FC<AccountPageProps> = () => {
  const navigate = useNavigate();

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError: isProfileError,
    error: profileError,
  } = useQuery<UserProfile, Error>({
    queryKey: ["currentUserProfile"],
    queryFn: fetchCurrentUserProfile,
    staleTime: 5 * 60 * 1000,
  });

  const {
    data: orders,
    isLoading: isOrdersLoading,
    isError: isOrdersError,
    error: ordersError,
  } = useQuery<Order[], Error>({
    queryKey: ["currentUserOrders"],
    queryFn: fetchUserOrders,
    staleTime: 60 * 1000,
  });

  const handleOrderClick = useCallback(
    (orderId: string) => {
      navigate(`/orders/undefined`);
    },
    [navigate]
  );

  const renderProfileSection = () => {
    if (isProfileLoading) {
      return (
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-32 bg-slate-200 rounded" />
          <div className="h-6 w-48 bg-slate-200 rounded" />
          <div className="h-4 w-64 bg-slate-200 rounded" />
          <div className="h-4 w-40 bg-slate-200 rounded" />
        </div>
      );
    }

    if (isProfileError || !profile) {
      return (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="font-medium">Unable to load profile</div>
          <div className="mt-1 text-rose-700">
            {(profileError && profileError.message) || "Please try again later."}
          </div>
        </div>
      );
    }

    return (
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Account</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your profile and view your recent orders.</p>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Profile</h2>
              <p className="mt-1 text-sm text-slate-600">Basic information associated with your account.</p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Name</div>
              <div className="mt-1 text-sm text-slate-900">{profile.name}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</div>
              <div className="mt-1 text-sm text-slate-900">{profile.email}</div>
            </div>
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Member since</div>
              <div className="mt-1 text-sm text-slate-900">
                {new Intl.DateTimeFormat(undefined, {
                  year: "numeric",
                  month: "long",
                  day: "2-digit",
                }).format(new Date(profile.createdAt))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderOrdersSection = () => {
    if (isOrdersLoading) {
      return (
        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Recent orders</h2>
              <p className="mt-1 text-sm text-slate-600">Loading your orders...</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {[1, 2, 3].map((skeleton) => (
              <div key={skeleton} className="flex animate-pulse items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                <div className="space-y-2">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-24 rounded bg-slate-200" />
                </div>
                <div className="space-y-2 text-right">
                  <div className="h-4 w-20 rounded bg-slate-200" />
                  <div className="h-6 w-20 rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    if (isOrdersError) {
      return (
        <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <div className="font-medium">Unable to load orders</div>
          <div className="mt-1 text-rose-700">
            {(ordersError && ordersError.message) || "Please try again later."}
          </div>
        </div>
      );
    }

    const hasOrders = orders && orders.length > 0;

    return (
      <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Recent orders</h2>
            <p className="mt-1 text-sm text-slate-600">
              {hasOrders ? "Select an order to view its details." : "You have no orders yet."}
            </p>
          </div>
        </div>

        {hasOrders && (
          <div className="mt-6 space-y-3">
            {orders!.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => handleOrderClick(order.id)}
                className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white