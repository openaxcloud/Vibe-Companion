import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  TextField,
  CircularProgress,
  Tooltip,
  Snackbar,
  Alert,
  Button,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";

type OrderStatus = "pending" | "processing" | "shipped" | "delivered" | "cancelled";

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  customerName: string;
  email: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  items: OrderItem[];
}

interface StatusOption {
  value: OrderStatus | "all";
  label: string;
  color: "default" | "primary" | "success" | "error" | "warning" | "info";
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: "all", label: "All statuses", color: "default" },
  { value: "pending", label: "Pending", color: "warning" },
  { value: "processing", label: "Processing", color: "info" },
  { value: "shipped", label: "Shipped", color: "primary" },
  { value: "delivered", label: "Delivered", color: "success" },
  { value: "cancelled", label: "Cancelled", color: "error" },
];

const STATUS_LABEL_MAP: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR_MAP: Record<OrderStatus, StatusOption["color"]> = {
  pending: "warning",
  processing: "info",
  shipped: "primary",
  delivered: "success",
  cancelled: "error",
};

const MOCK_ORDERS: Order[] = [
  {
    id: "ORD-1001",
    customerName: "Alice Johnson",
    email: "alice.johnson@example.com",
    total: 149.99,
    status: "pending",
    createdAt: "2025-12-10T09:15:00Z",
    items: [
      { id: "1", name: "Wireless Headphones", quantity: 1, price: 99.99 },
      { id: "2", name: "USB-C Cable", quantity: 2, price: 25 },
    ],
  },
  {
    id: "ORD-1002",
    customerName: "Bob Smith",
    email: "bob.smith@example.com",
    total: 79.5,
    status: "processing",
    createdAt: "2025-12-09T14:30:00Z",
    items: [
      { id: "3", name: "Bluetooth Speaker", quantity: 1, price: 49.5 },
      { id: "4", name: "Phone Case", quantity: 1, price: 30 },
    ],
  },
  {
    id: "ORD-1003",
    customerName: "Carol Davis",
    email: "carol.davis@example.com",
    total: 249.0,
    status: "shipped",
    createdAt: "2025-12-08T11:05:00Z",
    items: [
      { id: "5", name: "Gaming Keyboard", quantity: 1, price: 129.0 },
      { id: "6", name: "Gaming Mouse", quantity: 1, price: 120.0 },
    ],
  },
  {
    id: "ORD-1004",
    customerName: "David Martinez",
    email: "david.martinez@example.com",
    total: 59.99,
    status: "delivered",
    createdAt: "2025-12-07T08:45:00Z",
    items: [{ id: "7", name: "Smartwatch Band", quantity: 2, price: 29.995 }],
  },
  {
    id: "ORD-1005",
    customerName: "Emily Clark",
    email: "emily.clark@example.com",
    total: 199.99,
    status: "cancelled",
    createdAt: "2025-12-06T16:20:00Z",
    items: [{ id: "8", name: "4K Monitor Stand", quantity: 1, price: 199.99 }],
  },
];

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const [editStatusId, setEditStatusId] = useState<string | null>(null);
  const [editStatusValue, setEditStatusValue] = useState<OrderStatus | "">("");

  const [snackbarOpen, setSnackbarOpen] = useState<boolean>(false);
  const [snackbarMessage, setSnackbarMessage] = useState<string>("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error" | "info">("info");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setOrders(MOCK_ORDERS);
    } catch (error) {
      setSnackbarSeverity("error");
      setSnackbarMessage("Failed to load orders.");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleStatusFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as OrderStatus | "all";
    setStatusFilter(value);
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleChangePage = (_: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleEditStatusClick = (orderId: string, currentStatus: OrderStatus) => {
    setEditStatusId(orderId);
    setEditStatusValue(currentStatus);
  };

  const handleCancelEditStatus = () => {
    setEditStatusId(null);
    setEditStatusValue("");
  };

  const handleEditStatusValueChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as OrderStatus;
    setEditStatusValue(value);
  };

  const handleSaveStatus = async (orderId: string) => {
    if (!editStatusValue) return;
    setUpdatingId(orderId);
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                status: editStatusValue,
              }
            : order
        )
      );
      setSnackbarSeverity("success");
      setSnackbarMessage(`Order undefined status updated to undefined.`);
      setSnackbarOpen(true);
      setEditStatusId(null);
      setEditStatusValue("");
    } catch (error) {
      setSnackbarSeverity("error");
      setSnackbarMessage("Failed to update order status.");
      setSnackbarOpen(true);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSnackbarClose = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === "clickaway") return;
    setSnackbarOpen(false);
  };

  const filteredOrders = useMemo(() => {
    let result = [...orders];

    if (statusFilter !== "all") {
      result = result.filter((order) => order.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      result = result.filter(
        (order) =>
          order.id.toLowerCase().