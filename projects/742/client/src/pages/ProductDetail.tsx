import React, { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

type ColorOption = {
  id: string;
  name: string;
  value: string;
  hex: string;
};

type SizeOption = {
  id: string;
  name: string;
  value: string;
  inStock: boolean;
};

type ProductImage = {
  id: string;
  url: string;
  alt: string;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  shortDescription: string;
  longDescription: string;
  images: ProductImage[];
  colors: ColorOption[];
  sizes: SizeOption[];
  inStock: boolean;
  stockQuantity: number;
  badges?: string[];
};

type CartItem = {
  productId: string;
  name: string;
  price: number;
  currency: string;
  quantity: number;
  color?: ColorOption;
  size?: SizeOption;
  image?: ProductImage;
};

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Classic Cotton T-Shirt",
    slug: "classic-cotton-tshirt",
    price: 29.99,
    currency: "USD",
    shortDescription: "Soft, breathable cotton t-shirt perfect for everyday wear.",
    longDescription:
      "This classic cotton t-shirt is crafted from 100% premium cotton for a soft and breathable feel. Designed with a timeless crew neck and a regular fit, it's perfect for layering or wearing on its own. The fabric is pre-washed to minimize shrinkage and maintain its shape wash after wash.\n\nFeatures:\n- 100% premium cotton\n- Pre-washed for softness and minimal shrinkage\n- Classic crew neck\n- Regular fit\n- Machine washable",
    images: [
      {
        id: "img-1",
        url: "https://images.pexels.com/photos/1002638/pexels-photo-1002638.jpeg",
        alt: "White cotton t-shirt on hanger",
      },
      {
        id: "img-2",
        url: "https://images.pexels.com/photos/1002633/pexels-photo-1002633.jpeg",
        alt: "Folded cotton t-shirts in different colors",
      },
      {
        id: "img-3",
        url: "https://images.pexels.com/photos/1002634/pexels-photo-1002634.jpeg",
        alt: "Cotton t-shirt close-up fabric texture",
      },
    ],
    colors: [
      { id: "white", name: "White", value: "white", hex: "#FFFFFF" },
      { id: "black", name: "Black", value: "black", hex: "#111827" },
      { id: "navy", name: "Navy", value: "navy", hex: "#1F2937" },
    ],
    sizes: [
      { id: "s", name: "S", value: "S", inStock: true },
      { id: "m", name: "M", value: "M", inStock: true },
      { id: "l", name: "L", value: "L", inStock: false },
      { id: "xl", name: "XL", value: "XL", inStock: true },
    ],
    inStock: true,
    stockQuantity: 42,
    badges: ["Best Seller", "Free Shipping"],
  },
];

const formatPrice = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$undefined`;
  }
};

const ProductDetail: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();

  const product: Product | undefined = useMemo(() => {
    if (!productId) return mockProducts[0];
    return (
      mockProducts.find((p) => p.id === productId || p.slug === productId) ||
      mockProducts[0]
    );
  }, [productId]);

  const [selectedImageId, setSelectedImageId] = useState<string | null>(
    product?.images?.[0]?.id ?? null
  );
  const [selectedColorId, setSelectedColorId] = useState<string | null>(
    product?.colors?.[0]?.id ?? null
  );
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(
    product?.sizes?.find((s) => s.inStock)?.id ?? null
  );
  const [quantity, setQuantity] = useState<number>(1);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<boolean>(false);

  const activeImage: ProductImage | undefined = useMemo(() => {
    if (!product) return undefined;
    return (
      product.images.find((img) => img.id === selectedImageId) ||
      product.images[0]
    );
  }, [product, selectedImageId]);

  const stockStatusLabel = useMemo(() => {
    if (!product) return "";
    if (!product.inStock || product.stockQuantity === 0) return "Out of stock";
    if (product.stockQuantity < 5) return "Only a few left";
    return "In stock";
  }, [product]);

  const stockStatusClass = useMemo(() => {
    if (!product || !product.inStock || product.stockQuantity === 0) {
      return "text-red-600 bg-red-50";
    }
    if (product.stockQuantity < 5) {
      return "text-amber-700 bg-amber-50";
    }
    return "text-emerald-700 bg-emerald-50";
  }, [product]);

  const handleChangeQuantity = useCallback(
    (value: number) => {
      if (!product) return;
      if (value < 1) value = 1;
      if (value > product.stockQuantity) value = product.stockQuantity;
      setQuantity(value);
    },
    [product]
  );

  const handleAddToCart = useCallback(async () => {
    if (!product) return;
    setError(null);
    setAddSuccess(false);

    if (!selectedColorId && product.colors.length > 0) {
      setError("Please select a color.");
      return;
    }
    if (!selectedSizeId && product.sizes.length > 0) {
      setError("Please select a size.");
      return;
    }
    if (!product.inStock || product.stockQuantity === 0) {
      setError("This product is currently out of stock.");
      return;
    }
    if (quantity < 1) {
      setError("Quantity must be at least 1.");
      return;
    }

    const color = product.colors.find((c) => c.id === selectedColorId);
    const size = product.sizes.find((s) => s.id === selectedSizeId);

    const cartItem: CartItem = {
      productId: product.id,
      name: product.name,
      price: product.price,
      currency: product.currency,
      quantity,
      color,
      size,
      image: activeImage,
    };

    try {
      setIsAdding(true);
      // Placeholder for integration with real cart service
      console.info("Adding to cart:", cartItem);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setAddSuccess(true);
      setTimeout(() => setAddSuccess(false), 2000);
    } catch (e) {
      console.error(e);
      setError("Unable to add to cart. Please try again.");
    } finally {
      setIsAdding(false);
    }
  }, [product, selectedColorId, selectedSizeId, quantity, activeImage]);

  if (!product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="text-lg font-semibold text-gray-900">
            Product not found
          </p>
          <p className="mt-2 text-gray-600">
            The product you are looking for does not exist or has been removed.
          </p>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="mt-4 inline-flex items-center rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Browse products
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 text-sm text-gray-500">
          <button
            type="