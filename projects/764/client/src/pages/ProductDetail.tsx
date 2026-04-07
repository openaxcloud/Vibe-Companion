import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

type ProductImage = {
  id: string | number;
  url: string;
  alt?: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  price: number;
  currency?: string;
  inStock: boolean;
  stockQuantity?: number;
  images: ProductImage[];
  sku?: string;
  category?: string;
  brand?: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type AddToCartPayload = {
  product: Product;
  quantity: number;
};

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Noise-Cancelling Headphones",
    description: "Premium over-ear wireless headphones with active noise cancellation.",
    longDescription:
      "Experience immersive sound with these premium wireless noise-cancelling headphones. Featuring adaptive ANC, 30 hours of battery life, quick charging, and a comfortable over-ear design. Perfect for work, travel, and everyday listening.",
    price: 249.99,
    currency: "USD",
    inStock: true,
    stockQuantity: 14,
    sku: "HD-ANC-001",
    category: "Audio",
    brand: "Acme Audio",
    images: [
      {
        id: "1-main",
        url: "https://via.placeholder.com/800x600?text=Headphones+Front",
        alt: "Wireless Noise-Cancelling Headphones - Front View",
      },
      {
        id: "1-side",
        url: "https://via.placeholder.com/800x600?text=Headphones+Side",
        alt: "Wireless Noise-Cancelling Headphones - Side View",
      },
      {
        id: "1-case",
        url: "https://via.placeholder.com/800x600?text=Headphones+Case",
        alt: "Wireless Noise-Cancelling Headphones - Case",
      },
    ],
  },
  {
    id: "2",
    name: "Smartwatch Pro",
    description: "Advanced smartwatch with fitness tracking and LTE connectivity.",
    longDescription:
      "Stay connected and on top of your health with the Smartwatch Pro. Features continuous heart-rate monitoring, GPS, LTE connectivity, and a stunning AMOLED display. Water-resistant and built for an active lifestyle.",
    price: 349.0,
    currency: "USD",
    inStock: false,
    stockQuantity: 0,
    sku: "SW-PRO-002",
    category: "Wearables",
    brand: "Acme Tech",
    images: [
      {
        id: "2-main",
        url: "https://via.placeholder.com/800x600?text=Smartwatch+Front",
        alt: "Smartwatch Pro - Front View",
      },
      {
        id: "2-strap",
        url: "https://via.placeholder.com/800x600?text=Smartwatch+Strap",
        alt: "Smartwatch Pro - Strap Options",
      },
    ],
  },
];

const fetchProductById = async (id: string): Promise<Product | null> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  const product = mockProducts.find((p) => p.id === id);
  return product ?? null;
};

const addToCartApi = async (payload: AddToCartPayload): Promise<CartItem> => {
  await new Promise((resolve) => setTimeout(resolve, 200));
  return {
    productId: payload.product.id,
    quantity: payload.quantity,
  };
};

const formatPrice = (amount: number, currency: string = "USD"): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
  const [addToCartError, setAddToCartError] = useState<string | null>(null);
  const [addToCartSuccess, setAddToCartSuccess] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      if (!id) {
        setLoadError("Product not found.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError(null);

      try {
        const result = await fetchProductById(id);
        if (!isMounted) return;

        if (!result) {
          setLoadError("Product not found.");
        } else {
          setProduct(result);
          setSelectedImageIndex(0);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError("An error occurred while loading the product.");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed <= 0) {
      setQuantity(1);
      return;
    }
    setQuantity(parsed);
  };

  const handleDecreaseQuantity = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : 1));
  };

  const handleIncreaseQuantity = () => {
    if (!product || (product.stockQuantity && quantity >= product.stockQuantity)) return;
    setQuantity((prev) => prev + 1);
  };

  const handleAddToCart = async () => {
    if (!product || !product.inStock) return;

    setIsAddingToCart(true);
    setAddToCartError(null);
    setAddToCartSuccess(null);

    try {
      const maxQty = product.stockQuantity ?? Number.MAX_SAFE_INTEGER;
      const safeQty = Math.min(quantity, maxQty);
      await addToCartApi({ product, quantity: safeQty });
      setAddToCartSuccess("Added to cart.");
    } catch (error) {
      setAddToCartError("Unable to add item to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const stockLabel = useMemo(() => {
    if (!product) return "";
    if (!product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0)) {
      return "Out of stock";
    }
    if (product.stockQuantity !== undefined) {
      if (product.stockQuantity <= 5) return `Only undefined left in stock`;
      return `In stock (undefined available)`;
    }
    return "In stock";
  }, [product]);

  const stockStatusClassName = useMemo(() => {
    if (!product) return "";
    if (!product.inStock || (product.stockQuantity !== undefined && product.stockQuantity <= 0)) {
      return "text-red-600";
    }
    if (product.stockQuantity !== undefined && product.stockQuantity <= 5) {
      return "text-amber-600";
    }
    return "text-emerald-600";
  }, [product]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (loadError || !product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow rounded-lg p-6 text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Product unavailable</h1>
          <p className="text-sm text-gray-600 mb-6">{loadError || "We couldn't find this product."}</p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-