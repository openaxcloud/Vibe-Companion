import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";

type ProductDetailRouteParams = {
  id: string;
};

type ProductImage = {
  id: string | number;
  url: string;
  alt?: string;
};

type Product = {
  id: string | number;
  name: string;
  description: string;
  price: number;
  currency: string;
  images: ProductImage[];
  inStock: boolean;
  stockQuantity: number;
};

type AddToCartPayload = {
  productId: Product["id"];
  quantity: number;
};

type ProductDetailProps = {
  fetchProductById?: (id: string | number) => Promise<Product>;
  onAddToCart?: (payload: AddToCartPayload) => Promise<void> | void;
};

const mockFetchProductById = async (id: string | number): Promise<Product> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return {
    id,
    name: "Sample Product Name",
    description:
      "This is a detailed description of the product. It highlights key features, materials, sizing information, and any other relevant details a customer might want to know before purchasing.",
    price: 129.99,
    currency: "USD",
    images: [
      {
        id: 1,
        url: "https://via.placeholder.com/800x800?text=Main+Image",
        alt: "Sample product main image",
      },
      {
        id: 2,
        url: "https://via.placeholder.com/800x800?text=Side+View",
        alt: "Sample product side view",
      },
      {
        id: 3,
        url: "https://via.placeholder.com/800x800?text=Back+View",
        alt: "Sample product back view",
      },
      {
        id: 4,
        url: "https://via.placeholder.com/800x800?text=Detail",
        alt: "Sample product detail view",
      },
    ],
    inStock: true,
    stockQuantity: 12,
  };
};

const formatPrice = (price: number, currency: string): string => {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(price);
  } catch {
    return `$undefined`;
  }
};

const ProductDetail: React.FC<ProductDetailProps> = ({
  fetchProductById = mockFetchProductById,
  onAddToCart,
}) => {
  const { id } = useParams<ProductDetailRouteParams>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cartSuccessMessage, setCartSuccessMessage] = useState<string | null>(
    null
  );

  useEffect(() => {
    let isMounted = true;

    const loadProduct = async () => {
      if (!id) {
        setError("Product not found.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const loadedProduct = await fetchProductById(id);
        if (!isMounted) return;

        setProduct(loadedProduct);
        setActiveImageIndex(0);
        setQuantity(loadedProduct.inStock && loadedProduct.stockQuantity > 0 ? 1 : 0);
      } catch (e) {
        if (!isMounted) return;
        setError("Unable to load product details. Please try again later.");
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
  }, [id, fetchProductById]);

  useEffect(() => {
    if (!cartSuccessMessage) return;
    const timeout = setTimeout(() => {
      setCartSuccessMessage(null);
    }, 2500);
    return () => clearTimeout(timeout);
  }, [cartSuccessMessage]);

  const handleQuantityChange = (value: number) => {
    if (!product || !product.inStock) return;
    const min = 1;
    const max = Math.max(1, product.stockQuantity);
    const clamped = Math.min(Math.max(value, min), max);
    setQuantity(clamped);
  };

  const incrementQuantity = () => {
    if (!product || !product.inStock) return;
    handleQuantityChange(quantity + 1);
  };

  const decrementQuantity = () => {
    if (!product || !product.inStock) return;
    handleQuantityChange(quantity - 1);
  };

  const handleAddToCart = async () => {
    if (!product || !product.inStock || quantity < 1) return;
    if (!onAddToCart) {
      setCartSuccessMessage("Added to cart (demo only, no backend wired).");
      return;
    }

    try {
      setIsAddingToCart(true);
      await onAddToCart({ productId: product.id, quantity });
      setCartSuccessMessage("Added to cart.");
    } catch {
      setError("Unable to add to cart. Please try again.");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const mainImage = useMemo<ProductImage | null>(() => {
    if (!product || !product.images.length) return null;
    return product.images[activeImageIndex] || product.images[0];
  }, [product, activeImageIndex]);

  const isOutOfStock = useMemo<boolean>(() => {
    if (!product) return false;
    return !product.inStock || product.stockQuantity <= 0;
  }, [product]);

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-gray-600">
          <div className="h-10 w-10 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">Loading product details...</span>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white shadow-sm rounded-lg p-6 border border-gray-200 text-center">
          <div className="text-red-500 mb-2 text-sm font-semibold uppercase tracking-wide">
            Error
          </div>
          <div className="text-gray-800 font-medium mb-2">
            {error || "Product not found."}
          </div>
          <p className="text-gray-500 text-sm mb-6">
            The product you are looking for may have been removed or is temporarily
            unavailable.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center justify-center px-4 py-2 rounded-md border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Go Back
            </button>
            <Link
              to="/"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Go to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="max-w-6xl mx-auto px-4 pt-6 md:pt-10">
        <nav className="text-xs text-gray-500 mb-4" aria-label="Breadcrumb">
          <ol className="flex items-center gap-1 flex-wrap">
            <li>
              <Link
                to="/"
                className="hover:text-gray-700 transition-colors cursor-pointer"
              >
                Home
              </Link>
            </li>
            <li className="mx-1 text-gray-400">/</li>
            <li>
              <span className="text-gray-700 font-medium line-clamp-1">
                {product.name}
              </span>
            </li>
          </ol>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          <section aria-label="Product image gallery">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-3">
              {mainImage ? (
                <img