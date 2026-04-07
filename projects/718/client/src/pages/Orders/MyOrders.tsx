import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Chip,
  CircularProgress,
  TablePagination,
  Toolbar,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Button,
  Stack,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import RefreshIcon from "@mui/icons-material/Refresh";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import dayjs from "dayjs";

type OrderStatus =
  | "PENDING"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED";

interface OrderItemSummary {
  id: string;
  name: string;
  quantity: number;
}

interface OrderSummary {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: OrderStatus;
  total: number;
  currency: string;
  itemCount: number;
  itemsPreview: OrderItemSummary[];
}

interface FetchOrdersResponse {
  data: OrderSummary[];
  total: number;
}

interface StatusMeta {
  label: string;
  color:
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "info"
    | "success"
    | "warning";
}

const STATUS_META: Record<OrderStatus, StatusMeta> = {
  PENDING: { label: "Pending", color: "warning" },
  PROCESSING: { label: "Processing", color: "info" },
  SHIPPED: { label: "Shipped", color: "primary" },
  DELIVERED: { label: "Delivered", color: "success" },
  CANCELLED: { label: "Cancelled", color: "default" },
  REFUNDED: { label: "Refunded", color: "secondary" },
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `undefined undefined`;
  }
};

const getStatusChip = (status: OrderStatus) => {
  const meta = STATUS_META[status];
  return <Chip label={meta.label} color={meta.color} size="small" />;
};

const simulateFetchOrders = async (
  page: number,
  pageSize: number,
  query: string,
  statusFilter: OrderStatus | "ALL"
): Promise<FetchOrdersResponse> => {
  const total = 87;
  const startIdx = page * pageSize;
  const endIdx = Math.min(startIdx + pageSize, total);

  const baseStatuses: OrderStatus[] = [
    "PENDING",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ];

  const allOrders: OrderSummary[] = Array.from({ length: total }).map(
    (_, index) => {
      const status = baseStatuses[index % baseStatuses.length];
      const id = `order-undefined`;
      const amount = 20 + (index % 15) * 3.5;
      const createdAt = dayjs()
        .subtract(index, "day")
        .hour(9 + (index % 8))
        .minute((index * 7) % 60)
        .second(0)
        .toISOString();
      const itemsPreview: OrderItemSummary[] = [
        {
          id: `undefined-item-1`,
          name: `Product undefined`,
          quantity: 1 + (index % 3),
        },
        {
          id: `undefined-item-2`,
          name: `Accessory undefined`,
          quantity: 1,
        },
      ];

      return {
        id,
        orderNumber: `#undefined`,
        createdAt,
        status,
        total: amount,
        currency: "USD",
        itemCount: itemsPreview.reduce(
          (sum, item) => sum + item.quantity,
          0
        ),
        itemsPreview,
      };
    }
  );

  let filtered = allOrders;

  if (statusFilter !== "ALL") {
    filtered = filtered.filter((o) => o.status === statusFilter);
  }

  if (query.trim()) {
    const q = query.trim().toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.itemsPreview.some((item) =>
          item.name.toLowerCase().includes(q)
        )
    );
  }

  const finalTotal = filtered.length;
  const start = Math.min(startIdx, finalTotal);
  const end = Math.min(start + pageSize, finalTotal);
  const pageData = filtered.slice(start, end);

  await new Promise((resolve) => setTimeout(resolve, 500));

  return { data: pageData, total: finalTotal };
};

const MyOrders: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(
    Number(searchParams.get("page") ?? 0)
  );
  const [pageSize, setPageSize] = useState<number>(
    Number(searchParams.get("pageSize") ?? PAGE_SIZE_OPTIONS[0])
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    searchParams.get("q") ?? ""
  );
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "ALL">(
    (searchParams.get("status") as OrderStatus | "ALL") || "ALL"
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useMemo(() => searchQuery, [searchQuery]);

  const updateSearchParams = (
    next: Partial<{
      page: number;
      pageSize: number;
      q: string;
      status: string;
    }>
  ) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next.page !== undefined) {
      params.set("page", String(next.page));
    }
    if (next.pageSize !== undefined) {
      params.set("pageSize", String(next.pageSize));
    }
    if (next.q !== undefined) {
      if (next.q.trim()) params.set("q", next.q.trim());
      else params.delete("q");
    }
    if (next.status !== undefined) {
      if (next.status === "ALL") params.delete("status");
      else params.set("status", next.status);
    }

    setSearchParams(params, { replace: true });
  };

  useEffect(() => {
    let isActive = true;
    const controller = new AbortController();

    const loadOrders = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await simulateFetchOrders(
          page,
          pageSize,
          debouncedQuery,
          statusFilter
        );
        if (!isActive) return;
        setOrders(response.data);
        setTotal(response.total);
      } catch (err) {
        if (!isActive) return;
        setError("Failed to load orders. Please try again.");
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadOrders();

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [page, pageSize, debouncedQuery, statusFilter]);

  const handleChangePage = (
    _event: React.MouseEvent<HTMLButtonElement> | null,
    newPage: number
  ) => {
    setPage(newPage);
    updateSearchParams({ page: newPage });
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newSize = parseInt(event.target.value, 10);
    setPageSize(newSize);
    setPage(0);
    updateSearchParams({ page: 0, pageSize: newSize });
  };

  const handleSearchChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value;
    setSearchQuery(value);
    setPage(0);
    updateSearchParams({ page: 0, q: value });
  };

  const handleStatusFilterChange = (
    event: React.ChangeEvent<{