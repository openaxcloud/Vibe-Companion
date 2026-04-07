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
  slug?: string;
  description: string;
  price: number;
  currency: string;
  inStock: boolean;
  stockQuantity?: number;
  images: ProductImage[];
  thumbnailUrl?: string;
  categoryId?: string;
  categoryName?: string;
};

type RelatedProduct = Product;

type CartItem = {
  productId: string;
  quantity: number;
};

type ProductDetailPageProps = {
  fetchProductById?: (id: string) => Promise<Product>;
  fetchRelatedProducts?: (productId: string) => Promise<RelatedProduct[]>;
  addToCart?: (item: CartItem) => Promise<void> | void;
  formatPrice?: (price: number, currency: string) => string;
};

const mockProduct: Product = {
  id: "1",
  name: "Sample Product",
  description:
    "This is a detailed description of the sample product. It highlights key features, materials, sizing, and usage suggestions so customers can make an informed decision.",
  price: 49.99,
  currency: "USD",
  inStock: true,
  stockQuantity: 14,
  images: [
    {
      id: "img1",
      url: "https://via.placeholder.com/800x800.png?text=Product+Image+1",
      alt: "Sample product image 1",
    },
    {
      id: "img2",
      url: "https://via.placeholder.com/800x800.png?text=Product+Image+2",
      alt: "Sample product image 2",
    },
    {
      id: "img3",
      url: "https://via.placeholder.com/800x800.png?text=Product+Image+3",
      alt: "Sample product image 3",
    },
  ],
  thumbnailUrl: "https://via.placeholder.com/400x400.png?text=Product+Thumb",
  categoryId: "cat1",
  categoryName: "Category Name",
};

const mockRelatedProducts: RelatedProduct[] = [
  {
    id: "2",
    name: "Related Product 1",
    description: "Short description for related product 1.",
    price: 39.99,
    currency: "USD",
    inStock: true,
    images: [
      {
        id: "r1i1",
        url: "https://via.placeholder.com/400x400.png?text=Related+1",
        alt: "Related product 1",
      },
    ],
    thumbnailUrl: "https://via.placeholder.com/400x400.png?text=Related+1",
    categoryId: "cat1",
    categoryName: "Category Name",
    stockQuantity: 8,
  },
  {
    id: "3",
    name: "Related Product 2",
    description: "Short description for related product 2.",
    price: 59.99,
    currency: "USD",
    inStock: false,
    images: [
      {
        id: "r2i1",
        url: "https://via.placeholder.com/400x400.png?text=Related+2",
        alt: "Related product 2",
      },
    ],
    thumbnailUrl: "https://via.placeholder.com/400x400.png?text=Related+2",
    categoryId: "cat1",
    categoryName: "Category Name",
    stockQuantity: 0,
  },
];

const defaultFetchProductById = async (id: string): Promise<Product> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return { ...mockProduct, id };
};

const defaultFetchRelatedProducts = async (
  productId: string
): Promise<RelatedProduct[]> => {
  await new Promise((resolve) => setTimeout(resolve, 300));
  return mockRelatedProducts.map((p) => ({
    ...p,
    description: p.description || "",
  }));
};

const defaultAddToCart = async (item: CartItem): Promise<void> => {
  // Placeholder implementation; in a real app this would integrate with global cart state / API
  // eslint-disable-next-line no-console
  console.log("Added to cart:", item);
};

const defaultFormatPrice = (price: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    }).format(price);
  } catch {
    return `undefined undefined`;
  }
};

const ProductDetail: React.FC<ProductDetailPageProps> = ({
  fetchProductById = defaultFetchProductById,
  fetchRelatedProducts = defaultFetchRelatedProducts,
  addToCart = defaultAddToCart,
  formatPrice = defaultFormatPrice,
}) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<RelatedProduct[]>([]);
  const [loadingProduct, setLoadingProduct] = useState<boolean>(true);
  const [loadingRelated, setLoadingRelated] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);
  const [isAddingToCart, setIsAddingToCart] = useState<boolean>(false);

  useEffect(() => {
    if (!id) {
      navigate("/404", { replace: true });
      return;
    }

    let isCancelled = false;

    const loadProduct = async () => {
      setLoadingProduct(true);
      setError(null);
      try {
        const data = await fetchProductById(id);
        if (isCancelled) return;
        setProduct(data);
        setSelectedImageIndex(0);
      } catch {
        if (isCancelled) return;
        setError("Failed to load product details. Please try again later.");
      } finally {
        if (!isCancelled) {
          setLoadingProduct(false);
        }
      }
    };

    loadProduct();

    return () => {
      isCancelled = true;
    };
  }, [id, fetchProductById, navigate]);

  useEffect(() => {
    if (!id) return;

    let isCancelled = false;

    const loadRelated = async () => {
      setLoadingRelated(true);
      try {
        const data = await fetchRelatedProducts(id);
        if (isCancelled) return;
        setRelatedProducts(data);
      } catch {
        if (isCancelled) return;
        // Fail silently for related products
        setRelatedProducts([]);
      } finally {
        if (!isCancelled) {
          setLoadingRelated(false);
        }
      }
    };

    loadRelated();

    return () => {
      isCancelled = true;
    };
  }, [id, fetchRelatedProducts]);

  const handleQuantityChange = (nextValue: number) => {
    if (nextValue < 1) {
      setQuantity(1);
      return;
    }
    if (product && typeof product.stockQuantity === "number") {
      const clamped = Math.min(nextValue, product.stockQuantity);
      setQuantity(clamped);
      return;
    }
    setQuantity(nextValue);
  };

  const incrementQuantity = () => {
    handleQuantityChange(quantity + 1);
  };

  const decrementQuantity = () => {
    handleQuantityChange(quantity - 1);
  };

  const handleAddToCart = async () => {
    if (!product || !product.inStock || quantity <= 0) return;

    try {
      setIsAddingToCart(true);
      await addToCart({ productId: product.id, quantity });
    } catch {
      // In a real app, surface error via toast or UI message
      // eslint-disable-next-line no-console
      console.error("Failed to add to cart");
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const currentImage: ProductImage | null = useMemo(() => {
    if (!product || !product.images || product.images.length === 0) return null;
    if (selectedImageIndex < 0 || selectedImageIndex >= product.images.length) {
      return product.images[0];
    }
    return product.images[selectedImageIndex];
  }, [product, selectedImageIndex]);

  const hasThumbnails = product?.images && product.images.length > 1;

  if (loadingProduct) {
    return (
      <div className="page page-product-detail">
        <div className="container">
          <div className="product-detail loading-state">
            <div className="product-detail__images skeleton"></div>
            <div className="product-detail__info skeleton"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page page-product-detail">
        <div className="container">