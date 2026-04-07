import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";

type KPIStat = {
  label: string;
  value: number | string;
  change: number;
  helperText?: string;
};

type LowStockItem = {
  id: string;
  name: string;
  sku: string;
  stock: number;
  threshold: number;
};

const mockKpiData: KPIStat[] = [
  {
    label: "Today’s Sales",
    value: "$4,320",
    change: 12.4,
    helperText: "vs yesterday",
  },
  {
    label: "Today’s Orders",
    value: 138,
    change: 5.8,
    helperText: "vs yesterday",
  },
  {
    label: "7-Day Revenue",
    value: "$29,840",
    change: 9.2,
    helperText: "vs last 7 days",
  },
  {
    label: "Active Products",
    value: 214,
    change: 0,
    helperText: "in catalog",
  },
];

const mockLowStockItems: LowStockItem[] = [
  {
    id: "1",
    name: "Organic Cotton T-Shirt - White / M",
    sku: "TS-ORG-WH-M",
    stock: 3,
    threshold: 10,
  },
  {
    id: "2",
    name: "Running Shoes - Black / 42",
    sku: "RS-BLK-42",
    stock: 5,
    threshold: 12,
  },
  {
    id: "3",
    name: "Leather Wallet - Brown",
    sku: "LW-BRN-STD",
    stock: 2,
    threshold: 8,
  },
  {
    id: "4",
    name: "Noise Cancelling Headphones",
    sku: "NC-HP-01",
    stock: 1,
    threshold: 5,
  },
];

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

  const lowStockSummary = useMemo(() => {
    const total = mockLowStockItems.length;
    const critical = mockLowStockItems.filter((item) => item.stock <= 2).length;
    return { total, critical };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-6 lg:px-10 lg:py-8">
      <header className="mb-8 flex flex-col gap-4 md:mb-10 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-500 md:text-base">
            Monitor sales performance and inventory at a glance.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 md:px-4 md:py-2 md:text-sm"
          >
            Manage Products
          </button>
          <button
            type="button"
            onClick={() => navigate("/admin/inventory")}
            className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 md:px-4 md:py-2 md:text-sm"
          >
            View Inventory
          </button>
        </div>
      </header>

      <main className="flex flex-col gap-8 lg:gap-10">
        {/* KPI Section */}
        <section aria-labelledby="kpi-heading">
          <div className="mb-4 flex items-center justify-between">
            <h2
              id="kpi-heading"
              className="text-base font-semibold text-slate-900 md:text-lg"
            >
              Key Performance
            </h2>
            <span className="text-xs text-slate-500 md:text-sm">
              Data shown is for today and the last 7 days
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {mockKpiData.map((kpi) => {
              const isNeutral = kpi.change === 0;
              const isPositive = kpi.change > 0;
              const changeColor = isNeutral
                ? "text-slate-500"
                : isPositive
                ? "text-emerald-600"
                : "text-rose-600";

              const badgeBg = isNeutral
                ? "bg-slate-100"
                : isPositive
                ? "bg-emerald-50"
                : "bg-rose-50";

              const sign = isNeutral ? "" : isPositive ? "+" : "";

              return (
                <article
                  key={kpi.label}
                  className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-200 hover:shadow-md md:p-5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 md:text-[0.7rem]">
                        {kpi.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-slate-900 md:text-2xl">
                        {kpi.value}
                      </p>
                    </div>
                    <div
                      className={`inline-flex items-center rounded-full px-2 py-1 text-[0.7rem] font-medium md:text-xs undefined undefined`}
                    >
                      {!isNeutral && (
                        <span
                          aria-hidden="true"
                          className="mr-0.5 text-[0.7rem]"
                        >
                          {isPositive ? "▲" : "▼"}
                        </span>
                      )}
                      <span>
                        {isNeutral ? "No change" : `undefinedundefined%`}
                      </span>
                    </div>
                  </div>
                  {kpi.helperText && (
                    <p className="mt-3 text-xs text-slate-500">
                      {kpi.helperText}
                    </p>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        {/* Charts Section */}
        <section
          aria-labelledby="charts-heading"
          className="grid gap-6 lg:grid-cols-3"
        >
          <div className="lg:col-span-2">
            <div className="mb-3 flex items-center justify-between">
              <h2
                id="charts-heading"
                className="text-base font-semibold text-slate-900 md:text-lg"
              >
                Sales Overview
              </h2>
              <span className="text-xs text-slate-500 md:text-sm">
                Last 7 days
              </span>
            </div>
            <div className="relative h-64 overflow-hidden rounded-xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:h-72 md:p-6">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_#e5e7eb,_transparent_60%),radial-gradient(circle_at_bottom,_#e5e7eb,_transparent_60%)] opacity-70" />
              <div className="relative flex h-full flex-col justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Sales chart placeholder
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Integrate with your preferred chart library (e.g. Recharts,
                    Chart.js) to visualize revenue and order trends.
                  </p>
                </div>
                <div className="mt-4 flex flex-1 items-center justify-center">
                  <div className="h-32 w-full max-w-xl rounded-lg border border-slate-300 bg-white/80 p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between text-[0.7rem] text-slate-500">
                      <span>Revenue</span>
                      <span>Orders</span>
                    </div>
                    <div className="h-20 rounded bg-[repeating-linear-gradient(to_right,_#e5e7eb,_#e5e7eb_1px,_transparent_1px,_transparent_12px)]" />
                  </div>
                </div>
                <p className="mt-4 text-[0.7rem] text-slate-500">
                  Tip: Overlay revenue and order count with dual-axis charts for
                  more insight.
                </p>
              </div>