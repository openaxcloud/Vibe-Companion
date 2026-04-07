import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

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
  stock: number;
  sku?: string;
  category?: string;
  tags?: string[];
};

type CartItem = {
  productId: string | number;
  quantity: number;
};

type FetchStatus = "idle" | "loading" | "success" | "error";

const fetchProductById = async (id: string): Promise<Product> => {
  // Replace with actual API call
  const response = await fetch(`/api/products/undefined`);
  if (!response.ok) {
    throw new Error("Failed to load product");
  }
  const data = await response.json();
  return data as Product;
};

const addToCartApi = async (item: CartItem): Promise<void> => {
  // Replace with actual API call or global cart context dispatch
  const response = await fetch("/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  if (!response.ok) {
    throw new Error("Failed to add to cart");
  }
};

const formatPrice = (value: number, currency: string): string =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);

const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [status, setStatus] = useState<FetchStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);
  const [quantity, setQuantity] = useState<number>(1);

  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      navigate("/404", { replace: true });
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setError(null);

    fetchProductById(id)
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        setStatus("success");
        setSelectedImageIndex(0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "Unable to load product details"
        );
      });

    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const isOutOfStock = useMemo(
    () => (product ? product.stock <= 0 : true),
    [product]
  );

  const handleSelectImage = useCallback((index: number) => {
    setSelectedImageIndex(index);
  }, []);

  const handleQuantityChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(event.target.value, 10);
      if (Number.isNaN(value)) {
        setQuantity(1);
        return;
      }
      if (!product) {
        setQuantity(1);
        return;
      }
      const clamped = Math.min(Math.max(value, 1), Math.max(product.stock, 1));
      setQuantity(clamped);
    },
    [product]
  );

  const handleAddToCart = useCallback(async () => {
    if (!product || isOutOfStock || quantity <= 0) return;

    setIsAdding(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      await addToCartApi({ productId: product.id, quantity });
      setAddSuccess("Added to cart");
    } catch (err: unknown) {
      setAddError(
        err instanceof Error ? err.message : "Unable to add to cart"
      );
    } finally {
      setIsAdding(false);
    }
  }, [product, isOutOfStock, quantity]);

  if (status === "loading" || status === "idle") {
    return (
      <div className="page product-detail-page">
        <div className="page-inner">
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (status === "error" || !product) {
    return (
      <div className="page product-detail-page">
        <div className="page-inner">
          <p className="error-message">
            {error || "Product not found or failed to load."}
          </p>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-secondary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const mainImage = product.images[selectedImageIndex] ?? product.images[0];

  return (
    <div className="page product-detail-page">
      <div className="page-inner product-detail-layout">
        <div className="product-gallery">
          {mainImage && (
            <div className="product-main-image-wrapper">
              <img
                src={mainImage.url}
                alt={mainImage.alt || product.name}
                className="product-main-image"
              />
              {isOutOfStock && (
                <div className="product-badge product-badge-out-of-stock">
                  Out of stock
                </div>
              )}
            </div>
          )}
          {product.images.length > 1 && (
            <div className="product-thumbnails">
              {product.images.map((img, index) => (
                <button
                  key={img.id ?? img.url}
                  type="button"
                  className={
                    index === selectedImageIndex
                      ? "thumbnail-button thumbnail-button-active"
                      : "thumbnail-button"
                  }
                  onClick={() => handleSelectImage(index)}
                >
                  <img
                    src={img.url}
                    alt={img.alt || `undefined thumbnail undefined`}
                    className="thumbnail-image"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="product-info">
          <h1 className="product-title">{product.name}</h1>

          <div className="product-price-row">
            <span className="product-price">
              {formatPrice(product.price, product.currency)}
            </span>
          </div>

          {product.sku && (
            <div className="product-meta">
              <span className="product-sku-label">SKU:</span>
              <span className="product-sku-value">{product.sku}</span>
            </div>
          )}

          {product.category && (
            <div className="product-meta">
              <span className="product-category-label">Category:</span>
              <span className="product-category-value">
                {product.category}
              </span>
            </div>
          )}

          {product.tags && product.tags.length > 0 && (
            <div className="product-tags">
              {product.tags.map((tag) => (
                <span key={tag} className="product-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="product-description">
            <p>{product.description}</p>
          </div>

          <div className="product-purchase-section">
            <div className="product-stock-info">
              {isOutOfStock ? (
                <span className="stock-label stock-label-out">
                  Currently out of stock
                </span>
              ) : product.stock <= 5 ? (
                <span className="stock-label stock-label-low">
                  Only {product.stock} left in stock
                </span>
              ) : (
                <span className="stock-label stock-label-in">
                  In stock ({product.stock})
                </span>
              )}
            </div>

            <div className="product-quantity-row">
              <label htmlFor="quantity" className="quantity-label">
                Quantity
              </label>
              <input
                id="quantity"
                type="number"
                min={1}
                max={Math.max(product.stock, 1)}
                value={quantity}
                onChange={handleQuantityChange}
                disabled={isOutOfStock || isAdding}
                className="quantity-input"
              />
            </div>

            <button
              type="button"
              className="btn btn-primary add-to-cart-button"
              onClick={handleAddToCart}
              disabled={isOutOfStock || isAdding}
            >
              {isOutOfStock
                ? "Out of stock"
                : isAdding
                ? "Adding..."
                : "Add to cart"}
            </button>

            {addSuccess && (