import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  price: number;
  currency: string;
  inStock: boolean;
  stockQuantity?: number;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type AddToCartPayload = {
  productId: string;
  quantity: number;
};

const fetchProductById = async (id: string): Promise<Product> => {
  const response = await fetch(`/api/products/undefined`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch product: undefined`);
  }

  const data = (await response.json()) as Product;
  return data;
};

const addToCartRequest = async (payload: AddToCartPayload): Promise<CartItem> => {
  const response = await fetch("/api/cart", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Failed to add to cart: undefined`);
  }

  const data = (await response.json()) as CartItem;
  return data;
};

const formatCurrency = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `undefined undefined`;
  }
};

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const maxQuantity = product?.stockQuantity && product.stockQuantity > 0 ? product.stockQuantity : 99;

  const loadProduct = useCallback(async () => {
    if (!id) {
      setError("Product ID is missing.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setProduct(null);
    try {
      const fetchedProduct = await fetchProductById(id);
      setProduct(fetchedProduct);
      setQuantity(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error while fetching product.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  const handleDecrease = () => {
    setQuantity((prev) => (prev > 1 ? prev - 1 : prev));
    setCartMessage(null);
  };

  const handleIncrease = () => {
    setQuantity((prev) => {
      const next = prev + 1;
      return next > maxQuantity ? prev : next;
    });
    setCartMessage(null);
  };

  const handleQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const numeric = parseInt(value, 10);
    if (Number.isNaN(numeric)) {
      setQuantity(1);
    } else if (numeric < 1) {
      setQuantity(1);
    } else if (numeric > maxQuantity) {
      setQuantity(maxQuantity);
    } else {
      setQuantity(numeric);
    }
    setCartMessage(null);
  };

  const handleAddToCart = async () => {
    if (!product || !id) return;
    if (!product.inStock || product.stockQuantity === 0) {
      setCartMessage("This product is currently out of stock.");
      return;
    }

    setIsAdding(true);
    setError(null);
    setCartMessage(null);

    try {
      await addToCartRequest({
        productId: id,
        quantity,
      });
      setCartMessage("Product added to cart.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error while adding to cart.";
      setError(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleBack = () => {
    navigate(-1);
  };

  if (isLoading) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-loading">
          <p>Loading product details...</p>
        </div>
      </main>
    );
  }

  if (error && !product) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-error">
          <p role="alert">{error}</p>
          <button type="button" onClick={loadProduct}>
            Retry
          </button>
          <button type="button" onClick={handleBack}>
            Go Back
          </button>
        </div>
      </main>
    );
  }

  if (!product) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-error">
          <p role="alert">Product not found.</p>
          <button type="button" onClick={handleBack}>
            Go Back
          </button>
        </div>
      </main>
    );
  }

  const isOutOfStock = !product.inStock || product.stockQuantity === 0;

  return (
    <main className="product-detail-page">
      <button type="button" className="product-detail-back" onClick={handleBack}>
        ← Back
      </button>
      <section className="product-detail-container">
        <div className="product-detail-image-wrapper">
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              className="product-detail-image"
              loading="lazy"
            />
          ) : (
            <div className="product-detail-image-placeholder" aria-label="No product image available" />
          )}
        </div>
        <div className="product-detail-info">
          <h1 className="product-detail-title">{product.name}</h1>
          <p className="product-detail-price">
            {formatCurrency(product.price, product.currency)}
          </p>
          <p className="product-detail-status">
            {isOutOfStock ? "Out of stock" : "In stock"}
            {product.stockQuantity && product.stockQuantity > 0
              ? ` • undefined available`
              : null}
          </p>
          {product.description && (
            <p className="product-detail-description">{product.description}</p>
          )}

          <div className="product-detail-actions">
            <div className="product-detail-quantity">
              <label htmlFor="product-quantity">Quantity</label>
              <div className="product-detail-quantity-control">
                <button
                  type="button"
                  onClick={handleDecrease}
                  disabled={quantity <= 1 || isOutOfStock}
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <input
                  id="product-quantity"
                  type="number"
                  min={1}
                  max={maxQuantity}
                  value={quantity}
                  onChange={handleQuantityChange}
                  disabled={isOutOfStock}
                />
                <button
                  type="button"
                  onClick={handleIncrease}
                  disabled={quantity >= maxQuantity || isOutOfStock}
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              {product.stockQuantity && product.stockQuantity > 0 && (
                <small className="product-detail-quantity-note">
                  Max {product.stockQuantity} per order.
                </small>
              )}
            </div>

            <button
              type="button"
              className="product-detail-add-to-cart"
              onClick={handleAddToCart}
              disabled={isOutOfStock || isAdding}
            >
              {isOutOfStock ? "Out of Stock" : isAdding ? "Adding..." : "Add to Cart"}
            </button>
          </div>

          {cartMessage && !error && (
            <p className="product-detail-cart-message" role="status">
              {cartMessage}
            </p>
          )}
          {error && (
            <p className="product-detail-error-message" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </main>
  );
};

export default ProductDetail;