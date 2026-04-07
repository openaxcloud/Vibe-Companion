import React, { useMemo } from "react";
import { Link } from "react-router-dom";

type Product = {
  id: string;
  name: string;
  price: number;
  imageUrl: string;
  category: string;
  badge?: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
};

const featuredProducts: Product[] = [
  {
    id: "prod-1",
    name: "Minimalist Desk Lamp",
    price: 59.99,
    imageUrl:
      "https://images.pexels.com/photos/8216513/pexels-photo-8216513.jpeg?auto=compress&cs=tinysrgb&w=1200",
    category: "Home & Office",
    badge: "Bestseller",
  },
  {
    id: "prod-2",
    name: "Wireless Noise-Cancelling Headphones",
    price: 199.0,
    imageUrl:
      "https://images.pexels.com/photos/3394664/pexels-photo-3394664.jpeg?auto=compress&cs=tinysrgb&w=1200",
    category: "Audio",
    badge: "New",
  },
  {
    id: "prod-3",
    name: "Ergonomic Work Chair",
    price: 289.5,
    imageUrl:
      "https://images.pexels.com/photos/789822/pexels-photo-789822.jpeg?auto=compress&cs=tinysrgb&w=1200",
    category: "Home & Office",
  },
  {
    id: "prod-4",
    name: "Smart Home Speaker",
    price: 129.99,
    imageUrl:
      "https://images.pexels.com/photos/1072851/pexels-photo-1072851.jpeg?auto=compress&cs=tinysrgb&w=1200",
    category: "Smart Home",
  },
];

const categories: Category[] = [
  {
    id: "cat-1",
    name: "Home & Office",
    description: "Elevate your workspace with thoughtful, ergonomic essentials.",
    imageUrl:
      "https://images.pexels.com/photos/667838/pexels-photo-667838.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    id: "cat-2",
    name: "Audio",
    description: "Crisp sound, all-day comfort, and wireless freedom.",
    imageUrl:
      "https://images.pexels.com/photos/3394663/pexels-photo-3394663.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    id: "cat-3",
    name: "Smart Home",
    description: "Connect, automate, and control your home with ease.",
    imageUrl:
      "https://images.pexels.com/photos/10292304/pexels-photo-10292304.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
  {
    id: "cat-4",
    name: "Lifestyle",
    description: "Everyday essentials designed for modern living.",
    imageUrl:
      "https://images.pexels.com/photos/3965556/pexels-photo-3965556.jpeg?auto=compress&cs=tinysrgb&w=1200",
  },
];

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

const Home: React.FC = () => {
  const heroHighlightProduct = useMemo<Product | null>(
    () => featuredProducts[0] ?? null,
    []
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-40 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-sky-400/10 blur-3xl" />
        </div>

        <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-16 sm:py-20 lg:flex-row lg:items-center lg:py-24">
          <div className="flex-1 space-y-8">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200 backdrop-blur-sm">
              <span className="inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              New season, new arrivals
            </p>

            <div className="space-y-4">
              <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
                Curated products
                <span className="block text-emerald-300">
                  for everyday living.
                </span>
              </h1>
              <p className="max-w-xl text-balance text-sm text-slate-200 sm:text-base">
                Discover thoughtfully selected essentials that blend form and
                function. Designed to fit the way you live, work, and unwind.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/catalog"
                className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Shop the collection
                <span className="ml-2 inline-block text-lg leading-none">
                  →
                </span>
              </Link>
              <Link
                to="/catalog?filter=featured"
                className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900/40 px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Browse featured
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] font-semibold text-emerald-200">
                  ✓
                </span>
                <span>Free shipping over $75</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] font-semibold text-emerald-200">
                  ✓
                </span>
                <span>30-day returns</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/20 text-[10px] font-semibold text-emerald-200">
                  ✓
                </span>
                <span>Secure checkout</span>
              </div>
            </div>
          </div>

          <div className="flex-1">
            <div className="mx-auto max-w-md rounded-3xl border border-slate-800/60 bg-slate-900/60 p-4 shadow-xl shadow-black/40 backdrop-blur">
              <div className="relative overflow-hidden rounded-2xl bg-slate-900">
                {heroHighlightProduct && (
                  <>
                    <div className="aspect-[4/3] w-full overflow-hidden bg-slate-900">
                      <img
                        src={heroHighlightProduct.imageUrl}
                        alt={heroHighlightProduct.name}
                        className="h-full w-full object-cover transition-transform duration-700 hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                    <div className="absolute left-4 top-4 rounded-full bg-black/60 px-3 py-1 text-xs font-medium text-slate-50 backdrop-blur">
                      Featured pick
                    </div>
                    {heroHighlightProduct.badge && (
                      <div className="absolute right-4 top-4 rounded-full bg-emerald-