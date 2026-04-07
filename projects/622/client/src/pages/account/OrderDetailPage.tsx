import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface OrderItem {
  id: string;
  productId: string;
  productName: string;
  productImageUrl?: string | null;
  variantName?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

interface Address {
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state?: string | null;
  postalCode: string;
  country: string;
  phone?: string | null;
}

interface PaymentInfo {
  method: string;
  last4?: string | null;
  brand?: string | null;
  status: "PENDING" | "AUTHORIZED" | "PAID" | "REFUNDED" | "FAILED";
}

interface ShipmentInfo {
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
}

interface OrderTotals {
  itemsTotal: number;
  shippingTotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: string;
}

interface Order {
  id: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  placedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  items: OrderItem[];
  shippingAddress: Address;
  billingAddress?: Address | null;
  payment: PaymentInfo;
  shipment?: ShipmentInfo | null;
  totals: OrderTotals;
  notes?: string | null;
}

interface ApiError {
  message: string;
  statusCode?: number;
}

const formatCurrency = (value: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value / 100);
  } catch {
    return `undefined undefined`;
  }
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const getStatusLabel = (status: OrderStatus): string => {
  switch (status) {
    case "PENDING":
      return "Pending";
    case "PROCESSING":
      return "Processing";
    case "SHIPPED":
      return "Shipped";
    case "DELIVERED":
      return "Delivered";
    case "CANCELLED":
      return "Cancelled";
    case "REFUNDED":
      return "Refunded";
    default:
      return status;
  }
};

const getStatusClassName = (status: OrderStatus): string => {
  switch (status) {
    case "PENDING":
      return "inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-xs font-medium text-yellow-800 ring-1 ring-yellow-200";
    case "PROCESSING":
      return "inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-800 ring-1 ring-blue-200";
    case "SHIPPED":
      return "inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-800 ring-1 ring-indigo-200";
    case "DELIVERED":
      return "inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-emerald-200";
    case "CANCELLED":
      return "inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-800 ring-1 ring-rose-200";
    case "REFUNDED":
      return "inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-800 ring-1 ring-slate-200";
    default:
      return "inline-flex items-center rounded-full bg-gray-50 px-2.5 py-0.5 text-xs font-medium text-gray-800 ring-1 ring-gray-200";
  }
};

const OrderDetailPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchOrder = async () => {
      if (!orderId) {
        setError({ message: "Missing order ID." });
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/orders/undefined`, {
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          const contentType = res.headers.get("content-type") || "";
          let errMsg = "Failed to load order details.";
          if (contentType.includes("application/json")) {
            const body = (await res.json()) as { message?: string };
            if (body?.message) errMsg = body.message;
          }
          throw { message: errMsg, statusCode: res.status } as ApiError;
        }

        const data = (await res.json()) as Order;
        if (!isMounted) return;
        setOrder(data);
      } catch (err: unknown) {
        if (!isMounted) return;
        const apiErr: ApiError =
          err && typeof err === "object" && "message" in err
            ? (err as ApiError)
            : { message: "An unexpected error occurred." };
        setError(apiErr);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void fetchOrder();

    return () => {
      isMounted = false;
    };
  }, [orderId]);

  const handleCancelOrder = async () => {
    if (!order || isCancelling) return;
    if (!window.confirm("Are you sure you want to cancel this order?")) return;

    try {
      setIsCancelling(true);
      const res = await fetch(`/api/orders/undefined/cancel`, {
        method: "POST",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let errMsg = "Failed to cancel order.";
        if (contentType.includes("application/json")) {
          const body = (await res.json()) as { message?: string };
          if (body?.message) errMsg = body.message;
        }
        throw { message: errMsg, statusCode: res.status } as ApiError;
      }

      const updated = (await res.json()) as Order;
      setOrder(updated);
    } catch (err: unknown) {
      const apiErr: ApiError =
        err && typeof err === "object" && "message" in err
          ? (err as ApiError)
          : { message: "An unexpected error occurred while cancelling the order." };
      // eslint-disable-next-line no-alert
      alert(apiErr.message);
    } finally {
      setIsCancelling(false);
    }
  };

  const canCancel = useMemo(() => {
    if (!order) return false;
    return order.status === "PENDING" || order.status === "PROCESSING";
  }, [order]);

  const renderAddress = (address?: Address | null): React.ReactNode => {
    if (!address) return <p className="text-sm text-gray-500">No address on file.</p>;

    return (
      <div className="space-y-0.5 text-sm text-gray-900">
        <p className="font-medium">{address.fullName}</p>
        <p>{address.line1}</p>
        {address.line2 && <p>{address.line2}</p>}
        <p>
          {address.city}
          {address.state ? `, undefined` : ""} {address.postalCode}
        </p>
        <p>{address.country}</p>
        {address.phone && <p className="text-gray-600">Phone: {address.phone}</p>}
      </div>
    );
  };

  if (isLoading) {
    return (