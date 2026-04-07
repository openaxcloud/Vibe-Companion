import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  IconButton,
  InputAdornment,
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
  Typography,
  FormControl,
  InputLabel,
  Chip,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

type OrderStatus =
  | "pending"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refunded";

interface AdminOrderItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface AdminOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  status: OrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: AdminOrderItem[];
}

interface FetchOrdersResponse {
  orders: AdminOrder[];
  total: number;
  page: number;
  limit: number;
}

interface UpdateOrderStatusResponse {
  order: AdminOrder;
}

const STATUS_OPTIONS: { value: OrderStatus | "all"; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const STATUS_CHIP_COLOR: Record<OrderStatus, "default" | "primary" | "success" | "warning" | "error" | "info"> = {
  pending: "warning",
  processing: "info",
  shipped: "primary",
  delivered: "success",
  cancelled: "error",
  refunded: "default",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

const AdminOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(
    async (opts?: { resetPage?: boolean }) => {
      try {
        setLoading(true);
        setError(null);

        const currentPage = opts?.resetPage ? 0 : page;

        const params = new URLSearchParams();
        params.set("page", (currentPage + 1).toString());
        params.set("limit", rowsPerPage.toString());

        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }

        if (searchQuery.trim()) {
          params.set("search", searchQuery.trim());
        }

        const response = await fetch(`/api/admin/orders?undefined`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("Failed to load orders");
        }

        const data: FetchOrdersResponse = await response.json();
        setOrders(data.orders);
        setTotal(data.total);
        if (opts?.resetPage) {
          setPage(0);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error occurred");
      } finally {
        setLoading(false);
      }
    },
    [page, rowsPerPage, statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as OrderStatus | "all";
    setStatusFilter(value);
    setPage(0);
  };

  const handleSearchInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(event.target.value);
  };

  const handleSearchSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput);
    setPage(0);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setPage(0);
  };

  const handleRefresh = () => {
    fetchOrders();
  };

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingOrderId(orderId);
      setError(null);

      const response = await fetch(`/api/admin/orders/undefined/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update order status");
      }

      const data: UpdateOrderStatusResponse = await response.json();

      setOrders((prev) =>
        prev.map((order) => (order.id === orderId ? data.order : order))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const isLoadingInitial = loading && orders.length === 0;

  const isEmpty = !loading && orders.length === 0;

  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (statusFilter !== "all") {
      parts.push(`Status: undefined`);
    }
    if (searchQuery.trim()) {
      parts.push(`Search: "undefined"`);
    }
    if (!parts.length) return "Manage and track all customer orders";
    return parts.join(" • ");
  }, [statusFilter, searchQuery]);

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          mb: 3,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" gutterBottom>
            Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
          <form onSubmit={handleSearchSubmit}>
            <TextField
              size="small"
              variant="outlined"
              placeholder="Search by customer or order ID"
              value={searchInput}
              onChange={handleSearchInputChange}
              sx={{ minWidth: 280 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </form>

          {searchQuery && (
            <Tooltip title="Clear search">
              <IconButton onClick={handleClearSearch} size="small">
                <ErrorOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              value={statusFilter}
              label="Status"
              onChange={handleStatusFilterChange}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <