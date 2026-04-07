import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Toolbar,
  Typography,
  Stack,
  Chip,
  Snackbar,
  Alert,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
}

interface Order {
  id: string;
  customerName: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  items: OrderItem[];
}

interface Product {
  id: string;
  name: string;
  sku: string;
  stock: number;
  price: number;
  isActive: boolean;
}

interface ApiError {
  message: string;
  status?: number;
}

const ORDER_STATUS_OPTIONS: { value: OrderStatus; label: string; color: "default" | "primary" | "success" | "warning" | "error" }[] =
  [
    { value: "pending", label: "Pending", color: "warning" },
    { value: "processing", label: "Processing", color: "primary" },
    { value: "shipped", label: "Shipped", color: "primary" },
    { value: "delivered", label: "Delivered", color: "success" },
    { value: "cancelled", label: "Cancelled", color: "error" },
  ];

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const formatDateTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleString();
};

const getStatusMeta = (status: OrderStatus) =>
  ORDER_STATUS_OPTIONS.find((s) => s.value === status) ?? ORDER_STATUS_OPTIONS[0];

const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingProductId, setUpdatingProductId] = useState<string | null>(null);

  const [orderStatusDrafts, setOrderStatusDrafts] = useState<Record<string, OrderStatus>>({});
  const [inventoryDrafts, setInventoryDrafts] = useState<Record<string, number>>({});
  const [editingInventory, setEditingInventory] = useState<Record<string, boolean>>({});

  const [ordersPage, setOrdersPage] = useState<number>(0);
  const [ordersRowsPerPage, setOrdersRowsPerPage] = useState<number>(10);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState<OrderStatus | "all">("all");

  const [productsPage, setProductsPage] = useState<number>(0);
  const [productsRowsPerPage, setProductsRowsPerPage] = useState<number>(10);
  const [productSearch, setProductSearch] = useState<string>("");

  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info">("info");

  const [apiError, setApiError] = useState<ApiError | null>(null);

  const showSnackbar = (message: string, severity: "success" | "error" | "info" = "info") => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const handleSnackbarClose = () => setSnackbarOpen(false);

  const fetchOrders = async () => {
    try {
      setLoadingOrders(true);
      setApiError(null);
      const res = await fetch("/api/admin/orders");
      if (!res.ok) {
        const text = await res.text();
        throw { message: text || "Failed to fetch orders", status: res.status } as ApiError;
      }
      const data: Order[] = await res.json();
      setOrders(data);
      const initialDrafts: Record<string, OrderStatus> = {};
      data.forEach((o) => {
        initialDrafts[o.id] = o.status;
      });
      setOrderStatusDrafts(initialDrafts);
    } catch (error: any) {
      const err: ApiError = {
        message: error?.message || "Unknown error while fetching orders",
        status: error?.status,
      };
      setApiError(err);
      showSnackbar(err.message, "error");
    } finally {
      setLoadingOrders(false);
    }
  };

  const fetchProducts = async () => {
    try {
      setLoadingProducts(true);
      setApiError(null);
      const res = await fetch("/api/admin/products");
      if (!res.ok) {
        const text = await res.text();
        throw { message: text || "Failed to fetch products", status: res.status } as ApiError;
      }
      const data: Product[] = await res.json();
      setProducts(data);
      const initialDrafts: Record<string, number> = {};
      data.forEach((p) => {
        initialDrafts[p.id] = p.stock;
      });
      setInventoryDrafts(initialDrafts);
    } catch (error: any) {
      const err: ApiError = {
        message: error?.message || "Unknown error while fetching products",
        status: error?.status,
      };
      setApiError(err);
      showSnackbar(err.message, "error");
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, []);

  const handleOrderStatusChange = (orderId: string, event: SelectChangeEvent) => {
    const value = event.target.value as OrderStatus;
    setOrderStatusDrafts((prev) => ({ ...prev, [orderId]: value }));
  };

  const handleSaveOrderStatus = async (orderId: string) => {
    const newStatus = orderStatusDrafts[orderId];
    const originalOrder = orders.find((o) => o.id === orderId);
    if (!originalOrder) return;
    if (newStatus === originalOrder.status) {
      showSnackbar("No status change to save.", "info");
      return;
    }

    try {
      setUpdatingOrderId(orderId);
      const res = await fetch(`/api/admin/orders/undefined/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw { message: text || "Failed to update order status", status: res.status } as ApiError;
      }
      const updated: Order = await res.json();
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
      setOrderStatusDrafts((prev) => ({ ...prev, [orderId]: updated.status }));
      showSnackbar("Order status updated.", "success");
    } catch (error: any) {
      const err: ApiError = {
        message: error?.message || "Unknown error while updating order status",
        status: error?.status,
      };
      showSnackbar(err.message, "error");
      setApiError(err);
      const originalStatus = originalOrder.status;
      setOrderStatusDrafts((prev) => ({ ...prev, [orderId]: originalStatus }));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleInventoryDraftChange = (productId: string, value: string) => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      setInventoryDrafts((prev) => ({ ...prev, [productId]: 0 }));
    } else if (parsed < 0) {
      setInventoryDrafts((prev) => ({ ...prev, [productId]: 0 }));
    } else {
      setInventoryDrafts((prev) => ({ ...prev, [productId]: parsed }));
    }
  };

  const handleSaveInventory = async (productId: string) => {
    const newStock = inventoryDrafts[productId];
    const originalProduct = products.find((p) => p.id === productId);
    if (!originalProduct) return;
    if (newStock === originalProduct.stock) {
      show