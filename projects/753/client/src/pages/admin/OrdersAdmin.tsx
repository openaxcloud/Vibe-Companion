import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  SelectChangeEvent,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { Visibility, Refresh } from "@mui/icons-material";

type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED";

interface OrderItem {
  id: string;
  productName: string;
  sku?: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  number: string;
  customerName: string;
  customerEmail?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  total: number;
  currency?: string;
  items: OrderItem[];
  shippingAddress?: string;
  notes?: string;
}

interface OrdersResponse {
  data: Order[];
  total: number;
  page: number;
  pageSize: number;
}

const PAGE_SIZE = 10;

const statusOptions: { value: OrderStatus; label: string; color: "default" | "primary" | "success" | "warning" | "error" }[] =
  [
    { value: "PENDING", label: "Pending", color: "warning" },
    { value: "PROCESSING", label: "Processing", color: "primary" },
    { value: "SHIPPED", label: "Shipped", color: "primary" },
    { value: "DELIVERED", label: "Delivered", color: "success" },
    { value: "CANCELLED", label: "Cancelled", color: "error" },
  ];

const getStatusMeta = (
  status: OrderStatus
): { label: string; color: "default" | "primary" | "success" | "warning" | "error" } => {
  const meta = statusOptions.find((s) => s.value === status);
  return (
    meta || {
      value: status,
      label: status,
      color: "default",
    }
  );
};

async function fetchOrders(
  page: number,
  pageSize: number,
  search: string,
  status: OrderStatus | "ALL"
): Promise<OrdersResponse> {
  const params = new URLSearchParams();
  params.set("page", page.toString());
  params.set("pageSize", pageSize.toString());
  if (search) params.set("search", search);
  if (status !== "ALL") params.set("status", status);

  const res = await fetch(`/api/admin/orders?undefined`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch orders");
  }

  return res.json();
}

async function updateOrderStatus(
  orderId: string,
  status: OrderStatus
): Promise<Order> {
  const res = await fetch(`/api/admin/orders/undefined/status`, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    const message =
      errorBody?.message || `Failed to update order status (undefined)`;
    throw new Error(message);
  }

  return res.json();
}

async function fetchOrderDetails(orderId: string): Promise<Order> {
  const res = await fetch(`/api/admin/orders/undefined`, {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Failed to fetch order details");
  }

  return res.json();
}

const OrdersAdmin: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [search, setSearch] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">("ALL");
  const [loading, setLoading] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [detailsOpen, setDetailsOpen] = useState<boolean>(false);
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const [detailsLoading, setDetailsLoading] = useState<boolean>(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsOrder, setDetailsOrder] = useState<Order | null>(null);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / PAGE_SIZE)),
    [total]
  );

  const loadOrders = useCallback(
    async (opts?: { resetPage?: boolean }) => {
      try {
        setError(null);
        setLoading(true);

        const nextPage = opts?.resetPage ? 1 : page;
        const response = await fetchOrders(
          nextPage,
          PAGE_SIZE,
          search,
          statusFilter
        );
        setOrders(response.data);
        setTotal(response.total);
        setPage(response.page);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unexpected error loading orders";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [page, search, statusFilter]
  );

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleSearchSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSearch(searchInput.trim());
      setPage(1);
      loadOrders({ resetPage: true });
    },
    [searchInput, loadOrders]
  );

  const handleClearSearch = useCallback(() => {
    setSearchInput("");
    setSearch("");
    setPage(1);
    loadOrders({ resetPage: true });
  }, [loadOrders]);

  const handleStatusFilterChange = useCallback(
    (event: SelectChangeEvent<string>) => {
      const value = event.target.value as OrderStatus | "ALL";
      setStatusFilter(value);
      setPage(1);
      setTimeout(() => {
        loadOrders({ resetPage: true });
      }, 0);
    },
    [loadOrders]
  );

  const handlePageChange = useCallback(
    (_: React.ChangeEvent<unknown>, value: number) => {
      setPage(value);
      setTimeout(() => {
        loadOrders();
      }, 0);
    },
    [loadOrders]
  );

  const handleStatusChange = useCallback(
    async (orderId: string, status: OrderStatus) => {
      try {
        setUpdatingId(orderId);
        setError(null);
        const updatedOrder = await updateOrderStatus(orderId, status);
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, ...updatedOrder } : o))
        );
        if (detailsOrder && detailsOrder.id === orderId) {
          setDetailsOrder(updatedOrder);
        }
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error updating order status";
        setError(message);
      } finally {
        setUpdatingId(null);
      }
    },
    [detailsOrder]
  );

  const handleOpenDetails = useCallback(
    async (orderId: string) => {
      setDetailsOpen(true);
      setDetailsOrderId(orderId);
      setDetailsOrder(null);
      setDetailsError(null);
      setDetailsLoading(true);
      try {
        const order = await fetchOrderDetails(orderId);
        setDetailsOrder(order);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Unexpected error loading order details";
        setDetailsError(message);
      } finally {
        setDetailsLoading(false);
      }
    },
    []
  );

  const handleCloseDetails = useCallback(() => {
    setDetailsOpen(false);
    setDetailsOrderId(null);
    setDetailsOrder(null);
    setDetailsError(null);
    setDetailsLoading(false);
  }, []);

  const handleRefresh = useCallback(() => {
    loadOrders();
  }, [loadOrders]);

  const formatCurrency = useCallback((amount: number, currency?: string) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        currencyDisplay: "symbol",
      }).format(amount);
    } catch {
      return `undefined undefined`;
    }
  }, []);

  const formatDateTime = useCallback