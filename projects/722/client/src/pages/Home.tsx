import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  price: number;
  originalPrice?: number;
  category: string;
  isFeatured?: boolean;
  rating?: number;
  reviewCount?: number;
};

type CategorySummary = {
  name: string;
  slug: string;
  imageUrl?: string;
  productCount: number;
};

type FetchState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const API_BASE_URL =
  (import.meta as any).env?.VITE_API_BASE_URL || process.env.REACT_APP_API_BASE_URL || "";

const FEATURED_LIMIT = 8;

const Home: React.FC = () => {
  const [productsState, setProductsState] = useState<FetchState<Product[]>>({
    data: null,
    loading: false,
    error: null,
  });

  const [categoriesState, setCategoriesState] = useState<FetchState<CategorySummary[]>>({
    data: null,
    loading: false,
    error: null,
  });

  const [heroLoading, setHeroLoading] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const fetchProducts = async () => {
      setProductsState((prev) => ({ ...prev, loading: true, error: null }));
      setHeroLoading(true);
      try {
        const res = await fetch(`undefined/api/products?limit=50`);
        if (!res.ok) {
          throw new Error(`Failed to fetch products (undefined)`);
        }
        const json = (await res.json()) as Product[];
        if (!cancelled) {
          setProductsState({ data: json, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setProductsState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      } finally {
        if (!cancelled) {
          setHeroLoading(false);
        }
      }
    };

    const fetchCategories = async () => {
      setCategoriesState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(`undefined/api/categories/summary`);
        if (!res.ok) {
          throw new Error(`Failed to fetch categories (undefined)`);
        }
        const json = (await res.json()) as CategorySummary[];
        if (!cancelled) {
          setCategoriesState({ data: json, loading: false, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          setCategoriesState({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    };

    fetchProducts();
    fetchCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const featuredProducts = useMemo(() => {
    if (!productsState.data) return [];
    const featured = productsState.data.filter((p) => p.isFeatured);
    if (featured.length >= FEATURED_LIMIT) {
      return featured.slice(0, FEATURED_LIMIT);
    }
    const rest = productsState.data.filter((p) => !p.isFeatured);
    return [...featured, ...rest].slice(0, FEATURED_LIMIT);
  }, [productsState.data]);

  const heroProduct = useMemo(() => {
    if (!productsState.data || productsState.data.length === 0) return null;
    const featured = productsState.data.find((p) => p.isFeatured);
    return featured || productsState.data[0];
  }, [productsState.data]);

  const renderPrice = (product: Product) => {
    const { price, originalPrice } = product;
    const hasDiscount = originalPrice && originalPrice > price;
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-semibold text-gray-900">
          undefined
        </span>
        {hasDiscount && (
          <span className="text-sm text-gray-500 line-through">
            undefined
          </span>
        )}
      </div>
    );
  };

  const renderRating = (product: Product) => {
    if (!product.rating || !product.reviewCount) return null;
    const fullStars = Math.round(product.rating);
    return (
      <div className="flex items-center gap-1 text-xs text-amber-500">
        <span aria-hidden="true">
          {"★".repeat(fullStars)}
          {"☆".repeat(5 - fullStars)}
        </span>
        <span className="text-gray-600">
          {product.rating.toFixed(1)} ({product.reviewCount})
        </span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="relative isolate overflow-hidden bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-10 pb-16 sm:pt-16 sm:pb-24 lg:flex lg:items-center lg:gap-x-10">
          <div className="mx-auto max-w-2xl lg:mx-0 lg:flex-auto">
            <div className="inline-flex items-center gap-x-2 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 mb-4">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              New arrivals are here
              <Link
                to="/products?sort=newest"
                className="inline-flex items-center text-emerald-600 hover:text-emerald-700"
              >
                Shop now
                <span className="ml-1" aria-hidden="true">
                  →
                </span>
              </Link>
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Discover products you&apos;ll love.
            </h1>
            <p className="mt-4 text-base text-gray-600 sm:text-lg">
              Handpicked collections across categories. High-quality products,
              transparent pricing, and fast delivery—curated for modern living.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/products"
                className="inline-flex items-center justify-center rounded-md bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                Browse all products
              </Link>
              <Link
                to="/categories"
                className="inline-flex items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                Explore categories
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 text-xs text-gray-600 sm:text-sm max-w-md">
              <div>
                <dt className="font-semibold text-gray-900">Free shipping</dt>
                <dd>On orders over $75 in contiguous US.</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">Easy returns</dt>
                <dd>30-day hassle-free returns.</dd>
              </div>
              <div>
                <dt className="font-semibold text-gray-900">Secure checkout</dt>
                <dd>Trusted payment providers.</dd>
              </div>
            </dl>
          </div>

          <div className="mt-10 lg:mt-0 lg:flex-1">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-gray-100 shadow-lg">
              {heroLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-300 border-t-emerald-500" />
                </div>
              )}
              {heroProduct && (
                <Link to={`/products/undefined`} className="group block h-full w-full">
                  {heroProduct.imageUrl ? (
                    <img
                      src={heroProduct.imageUrl}
                      alt={heroProduct.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200">
                      <span className="text-sm font