import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Toolbar,
  InputAdornment,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  SelectChangeEvent,
  Snackbar,
  Alert,
  CircularProgress,
  Stack,
} from "@mui/material";
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
} from "@mui/icons-material";

type ProductStatus = "active" | "inactive";

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  status: ProductStatus;
  inventory: number;
  createdAt: string;
  updatedAt: string;
}

interface ProductFormState {
  id?: string;
  name: string;
  sku: string;
  price: string;
  status: ProductStatus;
  inventory: string;
}

interface ApiError {
  message: string;
  status?: number;
}

const DEFAULT_FORM_STATE: ProductFormState = {
  name: "",
  sku: "",
  price: "",
  status: "active",
  inventory: "",
};

const ProductsAdmin: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | ProductStatus>("");

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formState, setFormState] = useState<ProductFormState>(
    DEFAULT_FORM_STATE
  );
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductFormState, string>>>(
    {}
  );

  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);

  const showError = (message: string, status?: number) => {
    setError({ message, status });
  };

  const showSuccess = (message: string) => {
    setSuccessMessage(message);
  };

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/products", {
        credentials: "include",
      });
      if (!response.ok) {
        const text = await response.text();
        throw { message: text || "Failed to fetch products", status: response.status };
      }
      const data: Product[] = await response.json();
      setProducts(data);
    } catch (err: any) {
      const apiError: ApiError = {
        message: err?.message || "Unable to load products",
        status: err?.status,
      };
      setError(apiError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const handleStatusFilterChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as "" | ProductStatus;
    setStatusFilter(value);
    setPage(0);
  };

  const filteredProducts = useMemo(() => {
    return products
      .filter((product) => {
        if (statusFilter && product.status !== statusFilter) return false;
        if (!searchQuery.trim()) return true;
        const query = searchQuery.toLowerCase();
        return (
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [products, searchQuery, statusFilter]);

  const paginatedProducts = useMemo(() => {
    const start = page * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredProducts.slice(start, end);
  }, [filteredProducts, page, rowsPerPage]);

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const openCreateDialog = () => {
    setFormState(DEFAULT_FORM_STATE);
    setFormErrors({});
    setIsFormOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setFormState({
      id: product.id,
      name: product.name,
      sku: product.sku,
      price: product.price.toString(),
      status: product.status,
      inventory: product.inventory.toString(),
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const closeFormDialog = () => {
    if (saving) return;
    setIsFormOpen(false);
    setFormErrors({});
  };

  const validateForm = (state: ProductFormState): boolean => {
    const errors: Partial<Record<keyof ProductFormState, string>> = {};

    if (!state.name.trim()) {
      errors.name = "Name is required";
    }

    if (!state.sku.trim()) {
      errors.sku = "SKU is required";
    }

    if (!state.price.trim()) {
      errors.price = "Price is required";
    } else if (Number.isNaN(Number(state.price)) || Number(state.price) < 0) {
      errors.price = "Price must be a non-negative number";
    }

    if (!state.inventory.trim()) {
      errors.inventory = "Inventory is required";
    } else if (
      !Number.isInteger(Number(state.inventory)) ||
      Number(state.inventory) < 0
    ) {
      errors.inventory = "Inventory must be a non-negative integer";
    }

    if (!state.status) {
      errors.status = "Status is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormInputChange =
    (field: keyof ProductFormState) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setFormState((prev) => ({ ...prev, [field]: event.target.value }));
      if (formErrors[field]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const handleStatusChange = (event: SelectChangeEvent<ProductStatus>) => {
    const value = event.target.value as ProductStatus;
    setFormState((prev) => ({ ...prev, status: value }));
    if (formErrors.status) {
      setFormErrors((prev) => ({ ...prev, status: undefined }));
    }
  };

  const handleSubmitForm = async () => {
    if (!validateForm(formState)) return;

    setSaving(true);
    setError(null);

    const payload = {
      name: formState.name.trim(),
      sku: formState.sku.trim(),
      price: Number(formState.price),
      status: formState.status,
      inventory: Number(formState.inventory),
    };

    const isEdit = Boolean(formState.id);

    try {
      const response = await fetch(
        isEdit ? `/api/admin/products/undefined` : "/api/admin/products",
        {
          method: isEdit ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw {
          message: text || `Failed to undefined product`,
          status: response.status,
        };
      }

      const savedProduct: Product = await response.json();

      setProducts((prev) => {
        if (isEdit) {
          return prev.map((p) => (p.id === savedProduct.id ? savedProduct : p));
        }
        return [savedProduct, ...prev];
      });

      showSuccess(`Product undefined successfully`);
      setIsFormOpen(false);
      setFormState(DEFAULT_FORM_STATE);
      setFormErrors({});
    } catch (err: any) {
      const apiError: ApiError = {
        message:
          err?.message ||