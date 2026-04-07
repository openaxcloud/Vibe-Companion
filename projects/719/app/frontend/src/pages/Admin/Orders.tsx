import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  FormControl,
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
} from "@mui/material";
import { DatePicker, LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { format } from "date-fns";

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
  customerEmail: string;
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
}

interface OrdersResponse {
  data: Order[];
  total: number;
}

type FetchStatus = "idle" | "loading" | "succeeded" | "failed";

const STATUS_OPTIONS: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const Orders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [fetchStatus, setFetchStatus] = useState<FetchStatus>("idle");
  const [updateStatusId, setUpdateStatusId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [fromDate, setFromDate] = useState<Date | null>(null);
  const [toDate, setToDate] = useState<Date | null>(null);

  const [localStatusChanges, setLocalStatusChanges] = useState<Record<string, OrderStatus>>({});

  const fetchOrders = async () => {
    setFetchStatus("loading");
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("page", (page + 1).toString());
      params.append("limit", rowsPerPage.toString());
      if (statusFilter !== "all") {
        params.append("status", statusFilter);
      }
      if (fromDate) {
        params.append("from", fromDate.toISOString());
      }
      if (toDate) {
        params.append("to", toDate.toISOString());
      }

      const response = await fetch(`/api/admin/orders?undefined`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch orders: undefined`);
      }

      const json: OrdersResponse = await response.json();
      setOrders(json.data);
      setTotal(json.total);
      setFetchStatus("succeeded");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      setFetchStatus("failed");
    }
  };

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, statusFilter, fromDate, toDate]);

  const handleChangePage = (_: React.MouseEvent<HTMLButtonElement> | null, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent<OrderStatus | "all">) => {
    setStatusFilter(event.target.value as OrderStatus | "all");
    setPage(0);
  };

  const handleStatusChange = (orderId: string, newStatus: OrderStatus) => {
    setLocalStatusChanges((prev) => ({
      ...prev,
      [orderId]: newStatus,
    }));
  };

  const handleUpdateStatus = async (orderId: string) => {
    const newStatus = localStatusChanges[orderId];
    if (!newStatus) return;
    setUpdateStatusId(orderId);
    setError(null);
    try {
      const response = await fetch(`/api/admin/orders/undefined/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update order status: undefined`);
      }

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus, updatedAt: new Date().toISOString() } : order
        )
      );
      setLocalStatusChanges((prev) => {
        const { [orderId]: _, ...rest } = prev;
        return rest;
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setUpdateStatusId(null);
    }
  };

  const isLoading = fetchStatus === "loading";

  const hasFilters = useMemo(
    () => statusFilter !== "all" || !!fromDate || !!toDate,
    [statusFilter, fromDate, toDate]
  );

  return (
    <Box display="flex" flexDirection="column" gap={2} p={3}>
      <Typography variant="h4" component="h1" gutterBottom>
        Orders
      </Typography>

      <Paper elevation={1}>
        <Toolbar sx={{ display: "flex", flexWrap: "wrap", gap: 2, p: 2 }}>
          <FormControl sx={{ minWidth: 160 }} size="small">
            <InputLabel id="status-filter-label">Status</InputLabel>
            <Select
              labelId="status-filter-label"
              id="status-filter"
              value={statusFilter}
              label="Status"
              onChange={handleStatusFilterChange}
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="From date"
              value={fromDate}
              onChange={(newValue) => setFromDate(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                } as any,
              }}
            />
            <DatePicker
              label="To date"
              value={toDate}
              onChange={(newValue) => setToDate(newValue)}
              slotProps={{
                textField: {
                  size: "small",
                } as any,
              }}
            />
          </LocalizationProvider>

          <Box flexGrow={1} />

          {hasFilters && (
            <Button
              variant="text"
              color="inherit"
              onClick={() => {
                setStatusFilter("all");
                setFromDate(null);
                setToDate(null);
                setPage(0);
              }}
            >
              Clear Filters
            </Button>
          )}

          <Button
            variant="outlined"
            color="primary"
            onClick={() => fetchOrders()}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : "Refresh"}
          </Button>
        </Toolbar>
      </Paper>

      {error && (
        <Box>
          <Typography color="error" variant="body2">
            {error}
          </Typography>
        </Box>
      )}

      <Paper elevation={1}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Email</TableCell>
                <TableCell align="right">Total</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Update Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {