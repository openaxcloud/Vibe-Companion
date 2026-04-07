import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  sku: string;
  price: number;
  active: boolean;
  stock: number;
};

type OrderStatus = "pending" | "processing" | "shipped" | "cancelled" | "completed";

type Order = {
  id: string;
  number: string;
  customerName: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
};

type InventoryAdjustmentType = "increase" | "decrease";

type InventoryAdjustment = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  change: number;
  type: InventoryAdjustmentType;
  note?: string;
  createdAt: string;
};

type DashboardTab = "products" | "orders" | "inventory";

type AdminDashboardProps = {
  isAdmin?: boolean;
};

const MOCK_PRODUCTS: Product[] = [
  {
    id: "p1",
    name: "Sample Product A",
    sku: "SKU-A",
    price: 29.99,
    active: true,
    stock: 120,
  },
  {
    id: "p2",
    name: "Sample Product B",
    sku: "SKU-B",
    price: 49.99,
    active: false,
    stock: 0,
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: "o1",
    number: "ORD-1001",
    customerName: "Jane Doe",
    total: 89.5,
    status: "pending",
    createdAt: new Date().toISOString(),
  },
  {
    id: "o2",
    number: "ORD-1002",
    customerName: "John Smith",
    total: 120.0,
    status: "processing",
    createdAt: new Date().toISOString(),
  },
];

const MOCK_ADJUSTMENTS: InventoryAdjustment[] = [
  {
    id: "a1",
    productId: "p1",
    productName: "Sample Product A",
    sku: "SKU-A",
    change: 10,
    type: "increase",
    note: "Initial stock",
    createdAt: new Date().toISOString(),
  },
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isAdmin = true }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<DashboardTab>("products");

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adjustments, setAdjustments] = useState<InventoryAdjustment[]>([]);

  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState<Omit<Product, "id">>({
    name: "",
    sku: "",
    price: 0,
    active: true,
    stock: 0,
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [orderStatusUpdating, setOrderStatusUpdating] = useState<string | null>(null);

  const [inventoryForm, setInventoryForm] = useState<{
    productId: string;
    type: InventoryAdjustmentType;
    change: number;
    note: string;
  }>({
    productId: "",
    type: "increase",
    change: 0,
    note: "",
  });

  useEffect(() => {
    if (!isAdmin) {
      navigate("/login", { replace: true });
      return;
    }
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        setProducts(MOCK_PRODUCTS);
        setOrders(MOCK_ORDERS);
        setAdjustments(MOCK_ADJUSTMENTS);
      } catch (e) {
        setError("Failed to load admin data.");
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [isAdmin, navigate]);

  const resetProductForm = () => {
    setEditingProduct(null);
    setProductForm({
      name: "",
      sku: "",
      price: 0,
      active: true,
      stock: 0,
    });
  };

  const handleProductFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setProductForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "price" || name === "stock"
          ? Number(value)
          : value,
    }));
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku,
      price: product.price,
      active: product.active,
      stock: product.stock,
    });
  };

  const handleDeleteProduct = (productId: string) => {
    if (!window.confirm("Delete this product? This action cannot be undone.")) {
      return;
    }
    setSaving(true);
    setError(null);
    setTimeout(() => {
      try {
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        if (editingProduct && editingProduct.id === productId) {
          resetProductForm();
        }
      } catch (e) {
        setError("Failed to delete product.");
      } finally {
        setSaving(false);
      }
    }, 300);
  };

  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.name.trim() || !productForm.sku.trim()) {
      setError("Product name and SKU are required.");
      return;
    }
    if (productForm.price < 0 || productForm.stock < 0) {
      setError("Price and stock must be non-negative.");
      return;
    }
    setSaving(true);
    setError(null);
    setTimeout(() => {
      try {
        if (editingProduct) {
          setProducts((prev) =>
            prev.map((p) =>
              p.id === editingProduct.id ? { ...editingProduct, ...productForm } : p
            )
          );
        } else {
          const newProduct: Product = {
            id: `p_undefined`,
            ...productForm,
          };
          setProducts((prev) => [newProduct, ...prev]);
        }
        resetProductForm();
      } catch (e) {
        setError("Failed to save product.");
      } finally {
        setSaving(false);
      }
    }, 400);
  };

  const handleOrderStatusChange = (orderId: string, status: OrderStatus) => {
    setOrderStatusUpdating(orderId);
    setError(null);
    setTimeout(() => {
      try {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
      } catch (e) {
        setError("Failed to update order status.");
      } finally {
        setOrderStatusUpdating(null);
      }
    }, 300);
  };

  const handleInventoryFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setInventoryForm((prev) => ({
      ...prev,
      [name]:
        name === "change"
          ? Number(value)
          : (value as InventoryAdjustmentType | string),
    }));
  };

  const handleSubmitInventoryAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inventoryForm.productId) {
      setError("Select a product for inventory adjustment.");
      return;
    }
    if (inventoryForm.change <= 0) {
      setError("Change amount must be greater than zero.");
      return;
    }
    const product = products.find((p) => p.id === inventoryForm.productId);
    if (!product) {
      setError("Selected product not found.");
      return;
    }
    const signedChange =
      inventoryForm.type === "increase"
        ? inventoryForm.change
        : -inventoryForm.change;
    const newStock = product.stock + signedChange;
    if (newStock < 0) {
      setError("Adjustment would result in negative stock.");
      return;
    }
    setSaving(true);
    setError(null);
    setTimeout(() => {
      try {
        const adjustment: InventoryAdjustment = {
          id: `a_undefined`,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          change: signedChange,
          type: inventoryForm.type,
          note: inventoryForm.note || undefined,
          createdAt: new Date().toISOString(),
        };
        setAdjustments((prev) => [adjustment, ...prev]);
        setProducts((prev) =>
          prev.map((p)