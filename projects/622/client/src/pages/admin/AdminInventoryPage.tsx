import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
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
  Tooltip,
  Typography,
  Paper,
  FormControl,
  InputLabel,
} from "@mui/material";
import { Check, Clear, Edit, Save, Cancel, Sync, ErrorOutline } from "@mui/icons-material";

type InventoryProduct = {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  stock: number;
  isActive: boolean;
  updatedAt?: string;
};

type InventoryUpdatePayload = {
  stock?: number;
  isActive?: boolean;
};

type SortDirection = "asc" | "desc";

type SortField = "name" | "sku" | "stock" | "category" | "updatedAt";

type FetchStatus = "idle" | "loading" | "succeeded" | "failed";

type ApiError = {
  message: string;
  status?: number;
};

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const AdminInventoryPage: React.FC = () => {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<ApiError | null>(null);

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(25);

  const [search, setSearch] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editingStock, setEditingStock] = useState<number | "">("");
  const [savingRowIds, setSavingRowIds] = useState<Set<string>>(new Set());
  const [togglingRowIds, setTogglingRowIds] = useState<Set<string>>(new Set());

  const fetchProducts = useCallback(async () => {
    try {
      setStatus("loading");
      setError(null);

      const params = new URLSearchParams();
      if (search.trim()) params.append("search", search.trim());
      if (categoryFilter !== "all") params.append("category", categoryFilter);
      if (activeFilter !== "all") params.append("isActive", activeFilter);

      const response = await fetch(`/api/admin/inventory?undefined`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        const message = `Failed to load inventory (undefined)`;
        setStatus("failed");
        setError({ message, status: response.status });
        return;
      }

      const data: InventoryProduct[] = await response.json();
      setProducts(data);
      setStatus("succeeded");
    } catch (err) {
      setStatus("failed");
      setError({
        message: err instanceof Error ? err.message : "Unknown error occurred",
      });
    }
  }, [search, categoryFilter, activeFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
  };

  const handleCategoryFilterChange = (event: SelectChangeEvent<string>) => {
    setCategoryFilter(event.target.value);
    setPage(0);
  };

  const handleActiveFilterChange = (event: SelectChangeEvent<string>) => {
    setActiveFilter(event.target.value);
    setPage(0);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedProducts = useMemo(() => {
    const copy = [...products];
    copy.sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "sku":
          aVal = a.sku.toLowerCase();
          bVal = b.sku.toLowerCase();
          break;
        case "stock":
          aVal = a.stock;
          bVal = b.stock;
          break;
        case "category":
          aVal = (a.category || "").toLowerCase();
          bVal = (b.category || "").toLowerCase();
          break;
        case "updatedAt":
          aVal = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          bVal = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      if (aVal === bVal) return 0;
      if (aVal == null) return -1 * dir;
      if (bVal == null) return 1 * dir;
      if (aVal < bVal) return -1 * dir;
      return 1 * dir;
    });
    return copy;
  }, [products, sortField, sortDirection]);

  const paginatedProducts = useMemo(
    () =>
      sortedProducts.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [sortedProducts, page, rowsPerPage]
  );

  const startEditRow = (product: InventoryProduct) => {
    setEditingRowId(product.id);
    setEditingStock(product.stock);
  };

  const cancelEditRow = () => {
    setEditingRowId(null);
    setEditingStock("");
  };

  const handleStockChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === "") {
      setEditingStock("");
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num) && num >= 0) {
      setEditingStock(num);
    }
  };

  const updateProduct = async (id: string, payload: InventoryUpdatePayload) => {
    try {
      const response = await fetch(`/api/admin/inventory/undefined`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(
          text || `Failed to update inventory item (undefined)`
        );
      }

      const updated: InventoryProduct = await response.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...updated } : p))
      );
      return updated;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown error updating product";
      setError({ message });
      throw err;
    }
  };

  const saveRowEdit = async (product: InventoryProduct) => {
    if (editingStock === "" || editingStock === product.stock) {
      cancelEditRow();
      return;
    }
    const id = product.id;
    setSavingRowIds((prev) => new Set(prev).add(id));
    try {
      await updateProduct(id, { stock: editingStock as number });
      cancelEditRow();
    } catch {
      // error already set in updateProduct
    } finally {
      setSavingRowIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleActive = async (product: InventoryProduct) => {
    const id = product.id;
    const newState = !product.isActive;
    setTogglingRowIds((prev) => new Set