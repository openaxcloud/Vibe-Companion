import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  ChangeEvent,
  FormEvent,
} from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  InputAdornment,
  Chip,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Checkbox,
  ListItemText,
  DialogContentText,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import ImageIcon from "@mui/icons-material/Image";
import UploadFileIcon from "@mui/icons-material/UploadFile";

type ProductStatus = "active" | "inactive";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  categories: string[];
  images: string[];
  status: ProductStatus;
  sku: string;
}

interface ProductFormState {
  id?: string;
  name: string;
  description: string;
  price: string;
  stock: string;
  categories: string[];
  images: string[];
  status: ProductStatus;
  sku: string;
}

const DEFAULT_FORM_STATE: ProductFormState = {
  name: "",
  description: "",
  price: "",
  stock: "",
  categories: [],
  images: [],
  status: "active",
  sku: "",
};

const CATEGORY_OPTIONS: string[] = [
  "Electronics",
  "Clothing",
  "Home",
  "Sports",
  "Books",
  "Beauty",
];

const ImagePreview = styled("div")(({ theme }) => ({
  display: "flex",
  flexWrap: "wrap",
  gap: theme.spacing(1),
  marginTop: theme.spacing(1),
}));

const ImageThumbnail = styled("div")(({ theme }) => ({
  position: "relative",
  width: 64,
  height: 64,
  borderRadius: theme.shape.borderRadius,
  overflow: "hidden",
  border: `1px solid undefined`,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: theme.palette.background.default,
  img: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
}));

const RemoveImageButton = styled(IconButton)(({ theme }) => ({
  position: "absolute",
  top: -10,
  right: -10,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  "&:hover": {
    backgroundColor: theme.palette.background.paper,
  },
}));

const StatusChip: React.FC<{ status: ProductStatus }> = ({ status }) => {
  const color = status === "active" ? "success" : "default";
  const label = status === "active" ? "Active" : "Inactive";
  return <Chip size="small" color={color} label={label} />;
};

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(0);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);

  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState<boolean>(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [formState, setFormState] = useState<ProductFormState>(DEFAULT_FORM_STATE);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof ProductFormState, string>>>(
    {}
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      // Placeholder: simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      // Example static data, replace with real API integration
      const demoProducts: Product[] = [
        {
          id: "1",
          name: "Wireless Headphones",
          description: "Noise-cancelling wireless headphones with 20h battery.",
          price: 129.99,
          stock: 25,
          categories: ["Electronics"],
          images: [],
          status: "active",
          sku: "HEADPHONES-001",
        },
        {
          id: "2",
          name: "Running Shoes",
          description: "Lightweight running shoes for everyday training.",
          price: 89.5,
          stock: 50,
          categories: ["Sports", "Clothing"],
          images: [],
          status: "active",
          sku: "SHOES-002",
        },
      ];
      setProducts(demoProducts);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event.target.value);
    setPage(0);
  };

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter((p) => {
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.categories.some((c) => c.toLowerCase().includes(q)) ||
        p.sku.toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery]);

  const paginatedProducts = useMemo(
    () =>
      filteredProducts.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
      ),
    [filteredProducts, page, rowsPerPage]
  );

  const resetForm = () => {
    setFormState(DEFAULT_FORM_STATE);
    setFormErrors({});
    setSelectedProduct(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormState({
      id: product.id,
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      stock: product.stock.toString(),
      categories: product.categories,
      images: product.images,
      status: product.status,
      sku: product.sku,
    });
    setFormErrors({});
    setIsFormOpen(true);
  };

  const closeFormModal = () => {
    if (isSubmitting) return;
    setIsFormOpen(false);
    resetForm();
  };

  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteOpen(false);
    setSelectedProduct(null);
  };

  const validateForm = (): boolean => {
    const errors: Partial<Record<keyof ProductFormState, string>> = {};
    if (!formState.name.trim()) {
      errors.name = "Product name is required";
    }
    if (!formState.price.trim()) {
      errors.price = "Price is required";
    } else if (isNaN(Number(formState.price)) || Number(formState.price) < 0) {
      errors.price = "Price must be a non-negative number";
    }
    if (!formState.stock.trim()) {
      errors.stock = "Stock is required";
    } else if (
      !Number.isInteger(Number(formState.stock)) ||
      Number(formState.stock) < 0
    ) {
      errors.stock = "Stock must be a non-negative integer";
    }
    if (!formState.sku.trim()) {
      errors.sku = "SKU is required";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFormChange =
    (field: keyof ProductFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({ ...prev, [field]: value }));
      if (formErrors[field]) {
        setFormErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const handleStatusChange = (event: SelectChangeEvent<ProductStatus>) => {
    const value = event.target.value as ProductStatus;
    setFormState((prev) => ({ ...prev, status: value }));
  };

  const handleCategoriesChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value as string[];
    setFormState((prev) => ({ ...prev, categories: value