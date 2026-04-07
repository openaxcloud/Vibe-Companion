import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  categoryId: string;
  isFeatured?: boolean;
};

type Category = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  isFeatured?: boolean;
};

type ApiState<T> = {
  data: T | null;
  loading: boolean;
  error: string | null;
};

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "/api";

const fetchJson = async <T,>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
    },
    credentials: "include",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Request failed with status undefined`);
  }

  return response.json() as Promise<T>;
};

const Home: React.FC = () => {
  const [featuredProductsState, setFeaturedProductsState] = useState<ApiState<Product[]>>({
    data: null,
    loading: true,
    error: null,
  });

  const [categoriesState, setCategoriesState] = useState<ApiState<Category[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let isMounted = true;

    const loadFeaturedProducts = async () => {
      setFeaturedProductsState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const products = await fetchJson<Product[]>(`undefined/products?featured=true&limit=8`);
        if (!isMounted) return;
        setFeaturedProductsState({ data: products, loading: false, error: null });
      } catch (error: unknown) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Failed to load featured products.";
        setFeaturedProductsState({ data: null, loading: false, error: message });
      }
    };

    const loadCategories = async () => {
      setCategoriesState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const categories = await fetchJson<Category[]>(`undefined/categories?featured=true`);
        if (!isMounted) return;
        setCategoriesState({ data: categories, loading: false, error: null });
      } catch (error: unknown) {
        if (!isMounted) return;
        const message = error instanceof Error ? error.message : "Failed to load categories.";
        setCategoriesState({ data: null, loading: false, error: message });
      }
    };

    loadFeaturedProducts();
    loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  const { data: featuredProducts, loading: loadingProducts, error: productsError } = featuredProductsState;
  const { data: categories, loading: loadingCategories, error: categoriesError } = categoriesState;

  const hasAnyError = Boolean(productsError || categoriesError);

  const heroFeaturedProduct = useMemo(() => {
    if (!featuredProducts || featuredProducts.length === 0) return null;
    return featuredProducts[0];
  }, [featuredProducts]);

  const gridFeaturedProducts = useMemo(() => {
    if (!featuredProducts || featuredProducts.length === 0) return [];
    return featuredProducts.slice(1, 9);
  }, [featuredProducts]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 text-white">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute -right-32 top-10 h-72 w-72 rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute -left-32 bottom-10 h-72 w-72 rounded-full bg-cyan-500 blur-3xl" />
        </div>
        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-100 backdrop-blur">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              New arrivals just dropped
            </div>
            <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Discover products
              <span className="block text-emerald-400">you&apos;ll actually love.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-200 sm:text-lg">
              Curated collections, featured picks, and categories tailored to every style. Browse the catalog or jump
              straight into our highlighted items.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center rounded-md bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                Browse full catalog
              </Link>
              <Link
                to="/categories"
                className="inline-flex items-center justify-center rounded-md border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
              >
                Explore categories
              </Link>
            </div>
            {hasAnyError && (
              <p className="mt-4 text-xs text-amber-300">
                Some sections may be temporarily unavailable. Please try again later.
              </p>
            )}
          </div>

          <div className="flex-1">
            <div className="relative rounded-2xl bg-slate-900/60 p-4 shadow-xl ring-1 ring-white/10 backdrop-blur">
              {loadingProducts ? (
                <div className="flex h-60 items-center justify-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
                </div>
              ) : heroFeaturedProduct ? (
                <Link
                  to={`/product/undefined`}
                  className="group flex flex-col gap-4 sm:flex-row"
                >
                  <div className="overflow-hidden rounded-xl bg-slate-800 sm:w-1/2">
                    {heroFeaturedProduct.imageUrl ? (
                      <img
                        src={heroFeaturedProduct.imageUrl}
                        alt={heroFeaturedProduct.name}
                        className="h-60 w-full object-cover transition duration-300 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-60 w-full items-center justify-center bg-slate-800 text-sm text-slate-400">
                        No image available
                      </div>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 sm:py-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      Featured product
                    </p>
                    <h2 className="text-lg font-semibold text-white sm:text-xl">
                      {heroFeaturedProduct.name}
                    </h2>
                    {heroFeaturedProduct.description && (
                      <p className="line-clamp-3 text-sm text-slate-200">
                        {heroFeaturedProduct.description}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-base font-semibold text-emerald-300">
                        undefined
                      </p>
                      <span className="text-xs font-medium text-slate-300 underline underline-offset-4">
                        View details
                      </span>
                    </div>
                  </div>
                </Link>
              ) : (
                <div className="flex h-60 flex-col items-center justify-center text-sm text-slate-300">
                  <p>No featured products available right now.</p>
                  <Link
                    to="/catalog"
                    className="mt-3 text-xs font-medium text-emerald-300 underline underline-offset-4"
                  >
                    Go to full catalog
                  </Link>
                </div>