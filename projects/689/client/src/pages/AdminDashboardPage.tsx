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
  IconButton,
  MenuItem,
  Select,
  SelectChangeEvent,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  Alert,
  Paper,
  FormControl,
  InputLabel,
  Stack,
} from "@mui/material";
import {
  Check as CheckIcon,
  Close as CloseIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface AdminOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  total: number;
  status: OrderStatus;
  itemsCount: number;
}

interface AdminProduct {
  id: string;
  name: string;
  sku: string;
  price: number;
  inventory: number;
  isActive: boolean;
  updatedAt: string;
}

interface ApiError {
  message: string;
  status?: number;
}

const ORDER_STATUSES: { value: OrderStatus; label: string; color: "default" | "primary" | "success" | "warning" | "error" | "info" }[] =
  [
    { value: "pending", label: "Pending", color: "warning" },
    { value: "processing", label: "Processing", color: "info" },
    { value: "shipped", label: "Shipped", color: "primary" },
    { value: "delivered", label: "Delivered", color: "success" },
    { value: "cancelled", label: "Cancelled", color: "error" },
  ];

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options && options.headers ? options.headers : {}),
    },
    ...options,
  });

  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const error: ApiError = {
      message: (body && body.message) || res.statusText || "Request failed",
      status: res.status,
    };
    throw error;
  }

  return body as T;
}

const AdminDashboardPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState<boolean>(false);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState<boolean>(false);
  const [productsError, setProductsError] = useState<string | null>(null);

  const [ordersPage, setOrdersPage] = useState<number>(0);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState<number>(10);

  const [productsPage, setProductsPage] = useState<number>(0);
  const [productsRowsPerPage, setProductsRowsPerPage] = useState<number>(10);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingInventoryValue, setEditingInventoryValue] = useState<string>("");
  const [savingInventory, setSavingInventory] = useState<boolean>(false);

  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [editingOrderStatus, setEditingOrderStatus] = useState<OrderStatus | "">("");
  const [savingOrderStatus, setSavingOrderStatus] = useState<boolean>(false);

  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info" | "warning">("info");

  const [confirmDialogOpen, setConfirmDialogOpen] = useState<boolean>(false);
  const [confirmDialogTitle, setConfirmDialogTitle] = useState<string>("");
  const [confirmDialogMessage, setConfirmDialogMessage] = useState<string>("");
  const [onConfirmCallback, setOnConfirmCallback] = useState<(() => void) | null>(null);

  const showSnackbar = useCallback((message: string, severity: "success" | "error" | "info" | "warning" = "info") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  }, []);

  const handleCloseSnackbar = useCallback((_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setSnackbarOpen(false);
  }, []);

  const openConfirmDialog = useCallback((title: string, message: string, onConfirm: () => void) => {
    setConfirmDialogTitle(title);
    setConfirmDialogMessage(message);
    setOnConfirmCallback(() => onConfirm);
    setConfirmDialogOpen(true);
  }, []);

  const handleConfirmDialogClose = useCallback(() => {
    setConfirmDialogOpen(false);
    setOnConfirmCallback(null);
  }, []);

  const handleConfirmDialogConfirm = useCallback(() => {
    if (onConfirmCallback) {
      onConfirmCallback();
    }
    handleConfirmDialogClose();
  }, [onConfirmCallback, handleConfirmDialogClose]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await apiFetch<AdminOrder[]>("/api/admin/orders");
      setOrders(data);
    } catch (err) {
      const e = err as ApiError;
      setOrdersError(e.message || "Failed to load orders");
      showSnackbar(e.message || "Failed to load orders", "error");
    } finally {
      setOrdersLoading(false);
    }
  }, [showSnackbar]);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    setProductsError(null);
    try {
      const data = await apiFetch<AdminProduct[]>("/api/admin/products");
      setProducts(data);
    } catch (err) {
      const e = err as ApiError;
      setProductsError(e.message || "Failed to load products");
      showSnackbar(e.message || "Failed to load products", "error");
    } finally {
      setProductsLoading(false);
    }
  }, [showSnackbar]);

  useEffect(() => {
    loadOrders();
    loadProducts();
  }, [loadOrders, loadProducts]);

  const handleOrdersPageChange = (_event: unknown, newPage: number) => {
    setOrdersPage(newPage);
  };

  const handleOrdersRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setOrdersRowsPerPage(parseInt(event.target.value, 10));
    setOrdersPage(0);
  };

  const handleProductsPageChange = (_event: unknown, newPage: number) => {
    setProductsPage(newPage);
  };

  const handleProductsRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setProductsRowsPerPage(parseInt(event.target.value, 10));
    setProductsPage(0);
  };

  const startEditingInventory = (product: AdminProduct) => {
    setEditingProductId(product.id);
    setEditingInventoryValue(String(product.inventory));
  };

  const cancelEditingInventory = () => {
    setEditingProductId(null);
    setEditingInventoryValue("");
  };

  const handleInventoryChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setEditingInventoryValue(event.target.value);
  };

  const saveInventory = async () => {
    if (!editingProductId) return;

    const parsed = parseInt(editingInventoryValue, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      showSnackbar("Inventory must be a non-negative integer", "warning");
      return;
    }

    setSavingInventory(true);
    try {
      const updated = await apiFetch<AdminProduct>(`/api/admin/products/undefined/inventory`, {
        method: "PATCH",
        body: JSON.stringify({ inventory: parsed }),
      });

      setProducts((