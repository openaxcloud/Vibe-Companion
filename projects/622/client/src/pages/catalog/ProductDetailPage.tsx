import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  inStock: boolean;
  imageUrl: string;
  gallery?: string[];
};

type CartItem = {
  productId: string;
  quantity: number;
};

type ProductDetailPageProps = {
  products?: Product[];
  onAddToCart?: (item: CartItem) => void;
  fetchProductById?: (id: string) => Promise<Product | null>;
  fetchRelatedProducts?: (product: Product) => Promise<Product[]>;
};

const mockProducts: Product[] = [
  {
    id: "1",
    name: "Wireless Headphones",
    description:
      "High-quality wireless headphones with noise cancellation and 20 hours of battery life.",
    price: 149.99,
    category: "Audio",
    inStock: true,
    imageUrl:
      "https://images.pexels.com/photos/3394663/pexels-photo-3394663.jpeg?auto=compress&cs=tinysrgb&w=800",
    gallery: [
      "https://images.pexels.com/photos/3394663/pexels-photo-3394663.jpeg?auto=compress&cs=tinysrgb&w=800",
      "https://images.pexels.com/photos/159643/headphones-music-earphones-wire-159643.jpeg?auto=compress&cs=tinysrgb&w=800"
    ]
  },
  {
    id: "2",
    name: "Bluetooth Speaker",
    description:
      "Portable Bluetooth speaker with rich bass and splash resistance.",
    price: 89.99,
    category: "Audio",
    inStock: true,
    imageUrl:
      "https://images.pexels.com/photos/63703/pexels-photo-63703.jpeg?auto=compress&cs=tinysrgb&w=800"
  },
  {
    id: "3",
    name: "Smartwatch",
    description:
      "Track your fitness, manage notifications, and monitor your heart rate.",
    price: 199.99,
    category: "Wearables",
    inStock: false,
    imageUrl:
      "https://images.pexels.com/photos/267394/pexels-photo-267394.jpeg?auto=compress&cs=tinysrgb&w=800"
  }
];

const defaultFetchProductById = async (id: string): Promise<Product | null> => {
  const product = mockProducts.find((p) => p.id === id);
  return new Promise((resolve) => {
    setTimeout(() => resolve(product ?? null), 300);
  });
};

const defaultFetchRelatedProducts = async (
  product: Product
): Promise<Product[]> => {
  const related = mockProducts.filter(
    (p) => p.category === product.category && p.id !== product.id
  );
  return new Promise((resolve) => {
    setTimeout(() => resolve(related), 200);
  });
};

const ProductDetailPage: React.FC<ProductDetailPageProps> = ({
  products,
  onAddToCart,
  fetchProductById = defaultFetchProductById,
  fetchRelatedProducts = defaultFetchRelatedProducts
}) => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [related, setRelated] = useState<Product[]>([]);
  const [loadingProduct, setLoadingProduct] = useState<boolean>(true);
  const [loadingRelated, setLoadingRelated] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImage, setActiveImage] = useState<string | null>(null);

  const resolvedProduct = useMemo(() => {
    if (!productId) return null;
    if (products && products.length > 0) {
      return products.find((p) => p.id === productId) ?? null;
    }
    return product;
  }, [productId, products, product]);

  useEffect(() => {
    if (!productId) {
      setError("Product not found.");
      setLoadingProduct(false);
      return;
    }

    setLoadingProduct(true);
    setError(null);

    if (products && products.length > 0) {
      const found = products.find((p) => p.id === productId) ?? null;
      setProduct(found);
      setLoadingProduct(false);
      if (found) {
        setLoadingRelated(true);
        fetchRelatedProducts(found)
          .then(setRelated)
          .finally(() => setLoadingRelated(false));
      }
      return;
    }

    fetchProductById(productId)
      .then((data) => {
        if (!data) {
          setError("Product not found.");
          setProduct(null);
          return;
        }
        setProduct(data);
        setLoadingRelated(true);
        fetchRelatedProducts(data)
          .then(setRelated)
          .finally(() => setLoadingRelated(false));
      })
      .catch(() => {
        setError("Unable to load product details.");
      })
      .finally(() => {
        setLoadingProduct(false);
      });
  }, [productId, products, fetchProductById, fetchRelatedProducts]);

  useEffect(() => {
    if (resolvedProduct) {
      const initialImage =
        resolvedProduct.gallery && resolvedProduct.gallery.length > 0
          ? resolvedProduct.gallery[0]
          : resolvedProduct.imageUrl;
      setActiveImage(initialImage);
    }
  }, [resolvedProduct]);

  const handleAddToCart = () => {
    if (!resolvedProduct || !resolvedProduct.inStock) return;
    const safeQuantity = Math.max(1, Math.min(quantity, 99));
    if (onAddToCart) {
      onAddToCart({ productId: resolvedProduct.id, quantity: safeQuantity });
    } else {
      const existingRaw = window.localStorage.getItem("cart");
      const existing: CartItem[] = existingRaw ? JSON.parse(existingRaw) : [];
      const idx = existing.findIndex((i) => i.productId === resolvedProduct.id);
      if (idx >= 0) {
        existing[idx].quantity += safeQuantity;
      } else {
        existing.push({ productId: resolvedProduct.id, quantity: safeQuantity });
      }
      window.localStorage.setItem("cart", JSON.stringify(existing));
    }
  };

  const handleQuantityChange = (value: number) => {
    if (Number.isNaN(value)) return;
    const clamped = Math.max(1, Math.min(value, 99));
    setQuantity(clamped);
  };

  if (loadingProduct) {
    return (
      <div className="product-detail-page">
        <div className="container">
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error || !resolvedProduct) {
    return (
      <div className="product-detail-page">
        <div className="container">
          <p>{error || "Product not found."}</p>
          <button
            type="button"
            onClick={() => navigate("/catalog")}
            className="btn btn-secondary"
          >
            Back to Catalog
          </button>
        </div>
      </div>
    );
  }

  const isAvailable = resolvedProduct.inStock;

  return (
    <div className="product-detail-page">
      <div className="container">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="btn btn-link back-button"
        >
          ← Back
        </button>

        <div className="product-detail-layout">
          <div className="product-images">
            <div className="main-image-wrapper">
              {activeImage && (
                <img
                  src={activeImage}
                  alt={resolvedProduct.name}
                  className="main-image"
                />
              )}
            </div>
            {(resolvedProduct.gallery && resolvedProduct.gallery.length > 1) ||
            resolvedProduct.imageUrl ? (
              <div className="thumbnail-row">
                {(resolvedProduct.gallery && resolvedProduct.gallery.length > 0
                  ? resolvedProduct.gallery
                  : [resolvedProduct.imageUrl]
                ).map((img) => (
                  <button
                    type="button"
                    key={img}
                    className={`thumbnail-buttonundefined`}
                    onClick={() => setActiveImage(img)}
                  >
                    <img src={img} alt={resolvedProduct.name} />
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="product-info">
            <h1 className="product-title">{resolvedProduct.name}</h1>
            <p className="product-category">Category: {resolvedProduct.category}</p>
            <p className="product-price">
              undefined
            </p>
            <p
              className={`product-availabilityundefined`}
            >
              {isAvailable ? "In stock" : "Out of stock"}
            </